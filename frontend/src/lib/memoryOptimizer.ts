// Memory Optimization System for Efficient Component Lifecycle
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

// Memory monitoring and optimization utilities
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private observers: Set<(info: MemoryInfo) => void> = new Set();
  private cleanupTasks: Set<() => void> = new Set();
  private componentCounts = new Map<string, number>();
  private componentMemory = new Map<string, number>();
  private intervalId: NodeJS.Timeout | null = null;
  private lastGCTime = 0;
  private memoryThreshold = 50 * 1024 * 1024; // 50MB threshold

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  private constructor() {
    this.startMonitoring();
  }

  // Start memory monitoring
  private startMonitoring(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, 5000); // Check every 5 seconds

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Listen for memory pressure events
    if ('memory' in performance) {
      setInterval(() => {
        this.handleMemoryPressure();
      }, 10000);
    }
  }

  // Check current memory usage
  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryInfo: MemoryInfo = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        utilizationPercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        timestamp: Date.now(),
      };

      this.notifyObservers(memoryInfo);

      // Trigger cleanup if memory usage is high
      if (memoryInfo.usedJSHeapSize > this.memoryThreshold) {
        this.triggerMemoryCleanup();
      }
    }
  }

  // Handle memory pressure
  private handleMemoryPressure(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const utilizationPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

      if (utilizationPercent > 80) {
        console.warn('High memory usage detected, triggering aggressive cleanup');
        this.triggerMemoryCleanup(true);
      }
    }
  }

  // Handle page visibility changes
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      // Page is hidden, trigger cleanup
      setTimeout(() => {
        if (document.hidden) {
          this.triggerMemoryCleanup();
        }
      }, 30000); // Wait 30 seconds before cleanup
    }
  };

  // Trigger memory cleanup
  private triggerMemoryCleanup(aggressive = false): void {
    console.log(`Triggering ${aggressive ? 'aggressive' : 'normal'} memory cleanup`);

    // Run cleanup tasks
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    });

    // Suggest garbage collection
    if (aggressive && 'gc' in window) {
      (window as any).gc();
    }

    this.lastGCTime = Date.now();
  }

  // Register cleanup task
  registerCleanupTask(task: () => void): () => void {
    this.cleanupTasks.add(task);
    return () => this.cleanupTasks.delete(task);
  }

  // Register component
  registerComponent(name: string, estimatedMemory = 1024): void {
    const count = this.componentCounts.get(name) || 0;
    const memory = this.componentMemory.get(name) || 0;
    
    this.componentCounts.set(name, count + 1);
    this.componentMemory.set(name, memory + estimatedMemory);
  }

  // Unregister component
  unregisterComponent(name: string, estimatedMemory = 1024): void {
    const count = this.componentCounts.get(name) || 0;
    const memory = this.componentMemory.get(name) || 0;
    
    if (count > 0) {
      this.componentCounts.set(name, count - 1);
      this.componentMemory.set(name, Math.max(0, memory - estimatedMemory));
    }
  }

  // Subscribe to memory updates
  subscribe(observer: (info: MemoryInfo) => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  // Notify observers
  private notifyObservers(info: MemoryInfo): void {
    this.observers.forEach(observer => observer(info));
  }

  // Get component statistics
  getComponentStats() {
    return {
      counts: Object.fromEntries(this.componentCounts),
      memory: Object.fromEntries(this.componentMemory),
      totalComponents: Array.from(this.componentCounts.values()).reduce((a, b) => a + b, 0),
      totalMemory: Array.from(this.componentMemory.values()).reduce((a, b) => a + b, 0),
    };
  }

  // Stop monitoring
  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.observers.clear();
    this.cleanupTasks.clear();
  }
}

// Memory info interface
interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  utilizationPercent: number;
  timestamp: number;
}

// React hook for memory monitoring
export const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const monitor = MemoryMonitor.getInstance();

  useEffect(() => {
    const unsubscribe = monitor.subscribe(setMemoryInfo);
    return unsubscribe;
  }, [monitor]);

  return memoryInfo;
};

// Hook for component memory tracking
export const useComponentMemory = (componentName: string, estimatedMemory = 1024) => {
  const monitor = MemoryMonitor.getInstance();

  useEffect(() => {
    monitor.registerComponent(componentName, estimatedMemory);
    
    return () => {
      monitor.unregisterComponent(componentName, estimatedMemory);
    };
  }, [componentName, estimatedMemory, monitor]);
};

// Hook for cleanup registration
export const useMemoryCleanup = (cleanupFn: () => void, deps: any[] = []) => {
  const monitor = MemoryMonitor.getInstance();
  const cleanupRef = useRef(cleanupFn);
  cleanupRef.current = cleanupFn;

  useEffect(() => {
    const cleanup = () => cleanupRef.current();
    const unregister = monitor.registerCleanupTask(cleanup);
    
    return unregister;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
};

// Hook for optimized event listeners
export const useOptimizedEventListener = <T extends Event>(
  target: EventTarget | null,
  event: string,
  handler: (event: T) => void,
  options?: AddEventListenerOptions & { throttle?: number; debounce?: number }
) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const optimizedHandler = useMemo(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastCall = 0;

    return (event: T) => {
      const now = Date.now();

      if (options?.throttle) {
        if (now - lastCall < options.throttle) return;
        lastCall = now;
      }

      if (options?.debounce) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          handlerRef.current(event);
        }, options.debounce);
      } else {
        handlerRef.current(event);
      }
    };
  }, [options?.throttle, options?.debounce]);

  useEffect(() => {
    if (!target) return;

    const { throttle, debounce, ...eventOptions } = options || {};
    target.addEventListener(event, optimizedHandler as EventListener, eventOptions);

    return () => {
      target.removeEventListener(event, optimizedHandler as EventListener, eventOptions);
    };
  }, [target, event, optimizedHandler, options]);

  // Register cleanup
  useMemoryCleanup(() => {
    if (target) {
      target.removeEventListener(event, optimizedHandler as EventListener);
    }
  }, [target, event, optimizedHandler]);
};

// Hook for lazy loading heavy components
export const useLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component || loading) return;

    setLoading(true);
    setError(null);

    try {
      const module = await importFn();
      setComponent(() => module.default);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [Component, loading, importFn]);

  // Register memory cleanup for dynamic import
  useMemoryCleanup(() => {
    setComponent(null);
  }, []);

  return {
    Component: Component || fallback,
    loading,
    error,
    load: loadComponent,
  };
};

// Hook for intersection observer optimization
export const useIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit & { unobserveOnIntersect?: boolean }
) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const observe = useCallback((element: Element) => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver((entries) => {
        callbackRef.current(entries);
        
        if (options?.unobserveOnIntersect) {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              observerRef.current?.unobserve(entry.target);
            }
          });
        }
      }, options);
    }

    observerRef.current.observe(element);
  }, [options]);

  const unobserve = useCallback((element: Element) => {
    observerRef.current?.unobserve(element);
  }, []);

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Register memory cleanup
  useMemoryCleanup(() => {
    disconnect();
  }, [disconnect]);

  return { observe, unobserve, disconnect };
};

// Hook for optimized state updates
export const useOptimizedState = <T>(
  initialState: T,
  options?: {
    debounce?: number;
    compare?: (prev: T, next: T) => boolean;
  }
) => {
  const [state, setState] = useState(initialState);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<T | null>(null);

  const optimizedSetState = useCallback((newState: T | ((prev: T) => T)) => {
    const nextState = typeof newState === 'function' 
      ? (newState as (prev: T) => T)(pendingUpdateRef.current || state)
      : newState;

    // Check if state actually changed
    if (options?.compare) {
      if (options.compare(state, nextState)) return;
    } else if (Object.is(state, nextState)) {
      return;
    }

    pendingUpdateRef.current = nextState;

    if (options?.debounce) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setState(pendingUpdateRef.current!);
        pendingUpdateRef.current = null;
        timeoutRef.current = null;
      }, options.debounce);
    } else {
      setState(nextState);
      pendingUpdateRef.current = null;
    }
  }, [state, options]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, optimizedSetState] as const;
};

// Hook for performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  const renderCountRef = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderDuration: 0,
  });

  // Track component memory
  useComponentMemory(componentName);

  // Track renders
  useEffect(() => {
    renderCountRef.current++;
    const now = Date.now();
    const renderDuration = now - lastRenderTime.current;
    
    setMetrics(prev => ({
      renderCount: renderCountRef.current,
      averageRenderTime: (prev.averageRenderTime * (renderCountRef.current - 1) + renderDuration) / renderCountRef.current,
      lastRenderDuration: renderDuration,
    }));
    
    lastRenderTime.current = now;
  });

  return metrics;
};

// Memory-optimized list component hook
export const useVirtualList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );
    
    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length - 1, end + overscan),
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end + 1);
  }, [items, visibleRange]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
};

// Export utilities
export const memoryUtils = {
  monitor: MemoryMonitor.getInstance(),
  formatBytes: (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  getMemoryUsage: () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        utilizationPercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  },
};