import { api } from '@/lib/api';

export interface PollingOptions {
  interval?: number; // milliseconds
  immediate?: boolean;
}

type PollingCallback<T = any> = (data: T) => void;
type ErrorCallback = (error: Error) => void;

class PollingService {
  private intervals: Map<string, number> = new Map();
  private subscribers: Map<string, Set<PollingCallback>> = new Map();
  private errorHandlers: Map<string, Set<ErrorCallback>> = new Map();

  subscribe<T = any>(
    endpoint: string,
    callback: PollingCallback<T>,
    options: PollingOptions = {}
  ): () => void {
    const { interval = 30000, immediate = true } = options; // Default 30 seconds
    
    // Add callback to subscribers
    if (!this.subscribers.has(endpoint)) {
      this.subscribers.set(endpoint, new Set());
    }
    this.subscribers.get(endpoint)!.add(callback);
    
    // Start polling if not already active
    if (!this.intervals.has(endpoint)) {
      this.startPolling(endpoint, interval);
    }
    
    // Immediate fetch if requested
    if (immediate) {
      this.fetchData(endpoint);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(endpoint);
      if (callbacks) {
        callbacks.delete(callback);
        
        // Stop polling if no more subscribers
        if (callbacks.size === 0) {
          this.stopPolling(endpoint);
        }
      }
    };
  }

  onError(endpoint: string, errorHandler: ErrorCallback): () => void {
    if (!this.errorHandlers.has(endpoint)) {
      this.errorHandlers.set(endpoint, new Set());
    }
    this.errorHandlers.get(endpoint)!.add(errorHandler);
    
    return () => {
      const handlers = this.errorHandlers.get(endpoint);
      if (handlers) {
        handlers.delete(errorHandler);
      }
    };
  }

  private startPolling(endpoint: string, interval: number): void {
    const intervalId = window.setInterval(() => {
      this.fetchData(endpoint);
    }, interval);
    
    this.intervals.set(endpoint, intervalId);
  }

  private stopPolling(endpoint: string): void {
    const intervalId = this.intervals.get(endpoint);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(endpoint);
    }
    this.subscribers.delete(endpoint);
    this.errorHandlers.delete(endpoint);
  }

  private async fetchData(endpoint: string): Promise<void> {
    try {
      const response = await api.get(endpoint);
      const callbacks = this.subscribers.get(endpoint);
      
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(response.data);
          } catch (error) {
            console.error(`Error in polling callback for ${endpoint}:`, error);
          }
        });
      }
    } catch (error) {
      const errorHandlers = this.errorHandlers.get(endpoint);
      const apiError = error instanceof Error ? error : new Error('Polling request failed');
      
      if (errorHandlers) {
        errorHandlers.forEach(handler => {
          try {
            handler(apiError);
          } catch (handlerError) {
            console.error(`Error in polling error handler for ${endpoint}:`, handlerError);
          }
        });
      }
    }
  }

  // Specialized polling methods for common endpoints
  
  subscribeToDashboard(
    callback: PollingCallback,
    interval: number = 60000 // 1 minute
  ): () => void {
    return this.subscribe('/dashboard', callback, { interval });
  }

  subscribeToQueue(
    callback: PollingCallback,
    interval: number = 30000 // 30 seconds
  ): () => void {
    return this.subscribe('/queue/status', callback, { interval });
  }

  subscribeToAnalysis(
    callback: PollingCallback,
    interval: number = 120000 // 2 minutes
  ): () => void {
    return this.subscribe('/analysis', callback, { interval });
  }

  subscribeToPredictions(
    callback: PollingCallback,
    interval: number = 300000 // 5 minutes
  ): () => void {
    return this.subscribe('/predictions', callback, { interval });
  }

  subscribeToFeeds(
    callback: PollingCallback,
    interval: number = 120000 // 2 minutes
  ): () => void {
    return this.subscribe('/feeds', callback, { interval });
  }

  // Cleanup all polling intervals
  cleanup(): void {
    this.intervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.intervals.clear();
    this.subscribers.clear();
    this.errorHandlers.clear();
  }
}

export const pollingService = new PollingService();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  pollingService.cleanup();
});