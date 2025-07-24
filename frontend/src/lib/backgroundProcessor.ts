// Background Processing System for Non-blocking Operations
import { useCallback, useRef, useEffect, useState } from 'react';

export interface BackgroundTask<T = any, R = any> {
  id: string;
  name: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  processor: (data: T, signal: AbortSignal, progress?: (percent: number) => void) => Promise<R>;
  data: T;
  retries?: number;
  timeout?: number;
  onProgress?: (percent: number) => void;
  onComplete?: (result: R) => void;
  onError?: (error: Error) => void;
  dependencies?: string[];
  estimatedDuration?: number;
  createdAt: number;
}

export interface TaskResult<R = any> {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: R;
  error?: Error;
  progress: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

class BackgroundProcessorService {
  private tasks = new Map<string, BackgroundTask>();
  private results = new Map<string, TaskResult>();
  private queue: string[] = [];
  private running = new Set<string>();
  private workers = new Map<string, AbortController>();
  private maxConcurrentTasks = navigator.hardwareConcurrency || 4;
  private listeners = new Set<(results: Map<string, TaskResult>) => void>();
  private scheduler: NodeJS.Timeout | null = null;
  private idleCallback: number | null = null;

  constructor() {
    this.startScheduler();
  }

  // Add task to queue
  addTask<T, R>(task: Omit<BackgroundTask<T, R>, 'id' | 'createdAt'>): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullTask: BackgroundTask<T, R> = {
      ...task,
      id,
      createdAt: Date.now(),
    };

    this.tasks.set(id, fullTask);
    this.results.set(id, {
      id,
      status: 'pending',
      progress: 0,
    });

    // Insert task based on priority
    this.insertTaskByPriority(id);
    this.notifyListeners();
    this.processNext();

    return id;
  }

  // Insert task in queue based on priority
  private insertTaskByPriority(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const priorityWeight = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1,
    };

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const queuedTask = this.tasks.get(this.queue[i]);
      if (!queuedTask) continue;

      if (priorityWeight[task.priority] > priorityWeight[queuedTask.priority]) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, taskId);
  }

  // Cancel task
  cancelTask(taskId: string): boolean {
    const result = this.results.get(taskId);
    if (!result) return false;

    if (result.status === 'running') {
      const controller = this.workers.get(taskId);
      if (controller) {
        controller.abort();
        this.workers.delete(taskId);
      }
      this.running.delete(taskId);
    }

    // Remove from queue if pending
    const queueIndex = this.queue.indexOf(taskId);
    if (queueIndex > -1) {
      this.queue.splice(queueIndex, 1);
    }

    this.results.set(taskId, {
      ...result,
      status: 'cancelled',
      endTime: Date.now(),
      duration: result.startTime ? Date.now() - result.startTime : 0,
    });

    this.notifyListeners();
    this.processNext();
    return true;
  }

  // Get task result
  getResult(taskId: string): TaskResult | null {
    return this.results.get(taskId) || null;
  }

  // Get all results
  getAllResults(): Map<string, TaskResult> {
    return new Map(this.results);
  }

  // Clear completed tasks
  clearCompleted(): void {
    for (const [id, result] of this.results) {
      if (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
        this.results.delete(id);
        this.tasks.delete(id);
      }
    }
    this.notifyListeners();
  }

  // Subscribe to result changes
  subscribe(listener: (results: Map<string, TaskResult>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Process next task in queue
  private processNext(): void {
    if (this.running.size >= this.maxConcurrentTasks || this.queue.length === 0) {
      return;
    }

    const taskId = this.queue.shift();
    if (!taskId) return;

    const task = this.tasks.get(taskId);
    if (!task) return;

    // Check dependencies
    if (task.dependencies && !this.areDependenciesMet(task.dependencies)) {
      // Re-queue task
      this.queue.push(taskId);
      return;
    }

    this.runTask(taskId, task);
  }

  // Check if dependencies are met
  private areDependenciesMet(dependencies: string[]): boolean {
    return dependencies.every(depId => {
      const result = this.results.get(depId);
      return result && result.status === 'completed';
    });
  }

  // Run task
  private async runTask(taskId: string, task: BackgroundTask): Promise<void> {
    const controller = new AbortController();
    this.workers.set(taskId, controller);
    this.running.add(taskId);

    const result = this.results.get(taskId)!;
    this.results.set(taskId, {
      ...result,
      status: 'running',
      startTime: Date.now(),
    });

    this.notifyListeners();

    try {
      // Set timeout if specified
      let timeoutId: NodeJS.Timeout | null = null;
      if (task.timeout) {
        timeoutId = setTimeout(() => {
          controller.abort();
        }, task.timeout);
      }

      // Progress callback
      const progressCallback = (percent: number) => {
        const currentResult = this.results.get(taskId)!;
        this.results.set(taskId, {
          ...currentResult,
          progress: Math.max(0, Math.min(100, percent)),
        });
        this.notifyListeners();
        task.onProgress?.(percent);
      };

      // Execute task
      const taskResult = await task.processor(task.data, controller.signal, progressCallback);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Task completed successfully
      const endTime = Date.now();
      this.results.set(taskId, {
        ...result,
        status: 'completed',
        result: taskResult,
        progress: 100,
        endTime,
        duration: endTime - (result.startTime || endTime),
      });

      task.onComplete?.(taskResult);
    } catch (error) {
      const taskError = error as Error;
      const endTime = Date.now();

      // Check if it was aborted
      if (controller.signal.aborted) {
        this.results.set(taskId, {
          ...result,
          status: 'cancelled',
          error: new Error('Task was cancelled'),
          endTime,
          duration: endTime - (result.startTime || endTime),
        });
      } else {
        // Task failed - check for retries
        const currentRetries = (result as any).retries || 0;
        const maxRetries = task.retries || 0;

        if (currentRetries < maxRetries) {
          // Retry task
          this.results.set(taskId, {
            ...result,
            status: 'pending',
            progress: 0,
            retries: currentRetries + 1,
          });
          
          // Re-queue with delay
          setTimeout(() => {
            this.insertTaskByPriority(taskId);
            this.processNext();
          }, Math.pow(2, currentRetries) * 1000); // Exponential backoff
        } else {
          // Max retries reached
          this.results.set(taskId, {
            ...result,
            status: 'failed',
            error: taskError,
            endTime,
            duration: endTime - (result.startTime || endTime),
          });

          task.onError?.(taskError);
        }
      }
    } finally {
      this.workers.delete(taskId);
      this.running.delete(taskId);
      this.notifyListeners();
      
      // Process next task
      this.processNext();
    }
  }

  // Start scheduler for idle processing
  private startScheduler(): void {
    this.scheduler = setInterval(() => {
      if (this.queue.length > 0 && this.running.size < this.maxConcurrentTasks) {
        // Use requestIdleCallback for better performance
        if ('requestIdleCallback' in window) {
          this.idleCallback = requestIdleCallback(() => {
            this.processNext();
          });
        } else {
          this.processNext();
        }
      }
    }, 100);
  }

  // Notify listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getAllResults()));
  }

  // Pause all processing
  pause(): void {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    if (this.idleCallback) {
      cancelIdleCallback(this.idleCallback);
      this.idleCallback = null;
    }
  }

  // Resume processing
  resume(): void {
    if (!this.scheduler) {
      this.startScheduler();
    }
  }

  // Get queue status
  getQueueStatus() {
    return {
      pending: this.queue.length,
      running: this.running.size,
      completed: Array.from(this.results.values()).filter(r => r.status === 'completed').length,
      failed: Array.from(this.results.values()).filter(r => r.status === 'failed').length,
      cancelled: Array.from(this.results.values()).filter(r => r.status === 'cancelled').length,
    };
  }

  // Destroy processor
  destroy(): void {
    this.pause();
    
    // Cancel all running tasks
    for (const controller of this.workers.values()) {
      controller.abort();
    }
    
    this.workers.clear();
    this.running.clear();
    this.queue.length = 0;
    this.tasks.clear();
    this.results.clear();
    this.listeners.clear();
  }
}

// Global instance
const backgroundProcessor = new BackgroundProcessorService();

// React hook for using background processor
export const useBackgroundProcessor = () => {
  const [results, setResults] = useState<Map<string, TaskResult>>(new Map());
  const [queueStatus, setQueueStatus] = useState(backgroundProcessor.getQueueStatus());

  useEffect(() => {
    const unsubscribe = backgroundProcessor.subscribe((newResults) => {
      setResults(new Map(newResults));
      setQueueStatus(backgroundProcessor.getQueueStatus());
    });

    // Initial state
    setResults(backgroundProcessor.getAllResults());
    setQueueStatus(backgroundProcessor.getQueueStatus());

    return unsubscribe;
  }, []);

  const addTask = useCallback(<T, R>(task: Omit<BackgroundTask<T, R>, 'id' | 'createdAt'>) => {
    return backgroundProcessor.addTask(task);
  }, []);

  const cancelTask = useCallback((taskId: string) => {
    return backgroundProcessor.cancelTask(taskId);
  }, []);

  const getResult = useCallback((taskId: string) => {
    return backgroundProcessor.getResult(taskId);
  }, []);

  const clearCompleted = useCallback(() => {
    backgroundProcessor.clearCompleted();
  }, []);

  return {
    addTask,
    cancelTask,
    getResult,
    clearCompleted,
    results: Array.from(results.values()),
    queueStatus,
    isProcessing: queueStatus.running > 0 || queueStatus.pending > 0,
  };
};

// Utility functions for common tasks
export const backgroundTasks = {
  // Data processing task
  processData: <T, R>(data: T[], processor: (item: T) => R, options?: {
    batchSize?: number;
    priority?: BackgroundTask['priority'];
    onProgress?: (percent: number) => void;
  }) => {
    return backgroundProcessor.addTask({
      name: 'Process Data',
      priority: options?.priority || 'normal',
      processor: async (data: T[], signal, progress) => {
        const batchSize = options?.batchSize || 100;
        const results: R[] = [];
        
        for (let i = 0; i < data.length; i += batchSize) {
          if (signal.aborted) throw new Error('Cancelled');
          
          const batch = data.slice(i, i + batchSize);
          const batchResults = batch.map(processor);
          results.push(...batchResults);
          
          const percent = ((i + batch.length) / data.length) * 100;
          progress?.(percent);
          
          // Yield control to main thread
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        return results;
      },
      data,
      onProgress: options?.onProgress,
    });
  },

  // Image processing task
  processImage: (imageData: string | Blob, operations: string[], options?: {
    priority?: BackgroundTask['priority'];
    onProgress?: (percent: number) => void;
  }) => {
    return backgroundProcessor.addTask({
      name: 'Process Image',
      priority: options?.priority || 'normal',
      processor: async (data: { image: string | Blob; ops: string[] }, signal, progress) => {
        // Simulate image processing
        for (let i = 0; i < data.ops.length; i++) {
          if (signal.aborted) throw new Error('Cancelled');
          
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const percent = ((i + 1) / data.ops.length) * 100;
          progress?.(percent);
        }
        
        return `processed_${Date.now()}`;
      },
      data: { image: imageData, ops: operations },
      onProgress: options?.onProgress,
    });
  },

  // API batch request task
  batchApiRequest: <T, R>(requests: T[], apiCall: (request: T) => Promise<R>, options?: {
    priority?: BackgroundTask['priority'];
    onProgress?: (percent: number) => void;
    concurrency?: number;
  }) => {
    return backgroundProcessor.addTask({
      name: 'Batch API Request',
      priority: options?.priority || 'normal',
      processor: async (data: { requests: T[]; apiCall: (request: T) => Promise<R>; concurrency: number }, signal, progress) => {
        const { requests, apiCall, concurrency } = data;
        const results: R[] = [];
        
        for (let i = 0; i < requests.length; i += concurrency) {
          if (signal.aborted) throw new Error('Cancelled');
          
          const batch = requests.slice(i, i + concurrency);
          const batchPromises = batch.map(apiCall);
          const batchResults = await Promise.allSettled(batchPromises);
          
          batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            }
          });
          
          const percent = ((i + batch.length) / requests.length) * 100;
          progress?.(percent);
        }
        
        return results;
      },
      data: { requests, apiCall, concurrency: options?.concurrency || 3 },
      onProgress: options?.onProgress,
    });
  },
};

export default backgroundProcessor;