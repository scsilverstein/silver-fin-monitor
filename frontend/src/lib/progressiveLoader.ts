// Progressive Loading System for Critical Content First
import { useCallback, useEffect, useRef, useState } from 'react';

export interface LoadingStrategy {
  name: string;
  priority: number; // 1 = highest priority
  condition?: () => boolean;
  loader: () => Promise<any>;
  fallback?: any;
  timeout?: number;
  retries?: number;
  dependencies?: string[];
}

export interface LoadingPhase {
  name: string;
  strategies: LoadingStrategy[];
  parallel?: boolean;
  timeout?: number;
}

export interface ProgressiveLoadingConfig {
  phases: LoadingPhase[];
  onProgress?: (phase: string, strategy: string, progress: number) => void;
  onPhaseComplete?: (phase: string, results: any[]) => void;
  onComplete?: (allResults: Map<string, any>) => void;
  onError?: (phase: string, strategy: string, error: Error) => void;
}

export interface LoadingState {
  phase: string;
  strategy: string;
  progress: number;
  isLoading: boolean;
  isComplete: boolean;
  results: Map<string, any>;
  errors: Map<string, Error>;
}

class ProgressiveLoaderService {
  private activeLoaders = new Map<string, AbortController>();
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private loadingStates = new Map<string, LoadingState>();
  private listeners = new Map<string, Set<(state: LoadingState) => void>>();

  // Start progressive loading
  async load(id: string, config: ProgressiveLoadingConfig): Promise<Map<string, any>> {
    // Abort any existing loading for this id
    this.abort(id);

    const controller = new AbortController();
    this.activeLoaders.set(id, controller);

    const results = new Map<string, any>();
    const errors = new Map<string, Error>();

    // Initialize loading state
    const initialState: LoadingState = {
      phase: '',
      strategy: '',
      progress: 0,
      isLoading: true,
      isComplete: false,
      results,
      errors,
    };

    this.loadingStates.set(id, initialState);
    this.notifyListeners(id, initialState);

    try {
      // Execute phases sequentially
      for (let phaseIndex = 0; phaseIndex < config.phases.length; phaseIndex++) {
        const phase = config.phases[phaseIndex];
        
        if (controller.signal.aborted) {
          throw new Error('Loading aborted');
        }

        this.updateState(id, { phase: phase.name, strategy: '', progress: 0 });

        const phaseResults = await this.executePhase(
          id,
          phase,
          controller.signal,
          config.onProgress,
          config.onError
        );

        // Merge phase results
        for (const [key, value] of phaseResults.entries()) {
          results.set(key, value);
        }

        config.onPhaseComplete?.(phase.name, Array.from(phaseResults.values()));

        // Update progress based on completed phases
        const overallProgress = ((phaseIndex + 1) / config.phases.length) * 100;
        this.updateState(id, { progress: overallProgress, results });
      }

      // Mark as complete
      this.updateState(id, {
        isLoading: false,
        isComplete: true,
        progress: 100,
        results,
      });

      config.onComplete?.(results);
      return results;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.set('general', err);
      
      this.updateState(id, {
        isLoading: false,
        isComplete: false,
        errors,
      });

      throw err;
    } finally {
      this.activeLoaders.delete(id);
    }
  }

  // Execute a single phase
  private async executePhase(
    loaderId: string,
    phase: LoadingPhase,
    signal: AbortSignal,
    onProgress?: (phase: string, strategy: string, progress: number) => void,
    onError?: (phase: string, strategy: string, error: Error) => void
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const phaseTimeout = phase.timeout || 30000;

    // Create phase timeout
    const phaseController = new AbortController();
    const phaseTimeoutId = setTimeout(() => {
      phaseController.abort();
    }, phaseTimeout);

    // Combine signals
    const combinedSignal = this.combineSignals([signal, phaseController.signal]);

    try {
      if (phase.parallel) {
        // Execute strategies in parallel
        const promises = phase.strategies.map(async (strategy) => {
          try {
            const result = await this.executeStrategy(
              loaderId,
              phase.name,
              strategy,
              combinedSignal,
              onProgress
            );
            return { strategy: strategy.name, result, error: null };
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(phase.name, strategy.name, err);
            return { strategy: strategy.name, result: strategy.fallback, error: err };
          }
        });

        const strategyResults = await Promise.allSettled(promises);
        
        strategyResults.forEach((result, index) => {
          const strategy = phase.strategies[index];
          if (result.status === 'fulfilled' && result.value.result !== undefined) {
            results.set(strategy.name, result.value.result);
          } else if (strategy.fallback !== undefined) {
            results.set(strategy.name, strategy.fallback);
          }
        });

      } else {
        // Execute strategies sequentially by priority
        const sortedStrategies = [...phase.strategies].sort((a, b) => a.priority - b.priority);

        for (const strategy of sortedStrategies) {
          if (combinedSignal.aborted) break;

          try {
            const result = await this.executeStrategy(
              loaderId,
              phase.name,
              strategy,
              combinedSignal,
              onProgress
            );
            results.set(strategy.name, result);
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(phase.name, strategy.name, err);
            
            if (strategy.fallback !== undefined) {
              results.set(strategy.name, strategy.fallback);
            }
          }
        }
      }

      return results;

    } finally {
      clearTimeout(phaseTimeoutId);
    }
  }

  // Execute a single strategy
  private async executeStrategy(
    loaderId: string,
    phaseName: string,
    strategy: LoadingStrategy,
    signal: AbortSignal,
    onProgress?: (phase: string, strategy: string, progress: number) => void
  ): Promise<any> {
    // Check condition
    if (strategy.condition && !strategy.condition()) {
      throw new Error(`Strategy condition not met: ${strategy.name}`);
    }

    // Check dependencies
    if (strategy.dependencies) {
      for (const dep of strategy.dependencies) {
        const state = this.loadingStates.get(loaderId);
        if (!state?.results.has(dep)) {
          throw new Error(`Dependency not met: ${dep}`);
        }
      }
    }

    // Check cache
    const cacheKey = `${phaseName}:${strategy.name}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      onProgress?.(phaseName, strategy.name, 100);
      return cached;
    }

    this.updateState(loaderId, { strategy: strategy.name });

    // Execute with retries
    const maxRetries = strategy.retries || 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal.aborted) {
        throw new Error('Strategy execution aborted');
      }

      try {
        // Create timeout for strategy
        const timeout = strategy.timeout || 10000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Strategy timeout')), timeout);
        });

        // Execute strategy with timeout
        const result = await Promise.race([
          strategy.loader(),
          timeoutPromise
        ]);

        // Cache result
        this.setCache(cacheKey, result, 5 * 60 * 1000); // 5 minutes default

        onProgress?.(phaseName, strategy.name, 100);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries - 1) {
          // Wait before retry with exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Strategy execution failed');
  }

  // Combine multiple abort signals
  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    
    const onAbort = () => controller.abort();
    
    signals.forEach(signal => {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onAbort);
      }
    });

    // Cleanup
    controller.signal.addEventListener('abort', () => {
      signals.forEach(signal => {
        signal.removeEventListener('abort', onAbort);
      });
    });

    return controller.signal;
  }

  // Cache management
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.timestamp + cached.ttl) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  // State management
  private updateState(id: string, updates: Partial<LoadingState>): void {
    const currentState = this.loadingStates.get(id);
    if (currentState) {
      const newState = { ...currentState, ...updates };
      this.loadingStates.set(id, newState);
      this.notifyListeners(id, newState);
    }
  }

  private notifyListeners(id: string, state: LoadingState): void {
    const listeners = this.listeners.get(id);
    if (listeners) {
      listeners.forEach(listener => listener(state));
    }
  }

  // Subscribe to loading state changes
  subscribe(id: string, listener: (state: LoadingState) => void): () => void {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set());
    }
    
    this.listeners.get(id)!.add(listener);
    
    // Send current state if available
    const currentState = this.loadingStates.get(id);
    if (currentState) {
      listener(currentState);
    }

    return () => {
      const listeners = this.listeners.get(id);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(id);
        }
      }
    };
  }

  // Abort loading
  abort(id: string): void {
    const controller = this.activeLoaders.get(id);
    if (controller) {
      controller.abort();
      this.activeLoaders.delete(id);
    }

    const state = this.loadingStates.get(id);
    if (state) {
      this.updateState(id, {
        isLoading: false,
        isComplete: false,
      });
    }
  }

  // Get current state
  getState(id: string): LoadingState | null {
    return this.loadingStates.get(id) || null;
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }
}

// Global instance
const progressiveLoader = new ProgressiveLoaderService();

// React hook for progressive loading
export const useProgressiveLoading = (
  id: string,
  config: ProgressiveLoadingConfig,
  enabled = true
) => {
  const [state, setState] = useState<LoadingState | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  // Load data
  const load = useCallback(async () => {
    if (!enabled) return;
    
    try {
      const results = await progressiveLoader.load(id, configRef.current);
      return results;
    } catch (error) {
      throw error;
    }
  }, [id, enabled]);

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = progressiveLoader.subscribe(id, setState);
    return unsubscribe;
  }, [id]);

  // Auto-load on mount
  useEffect(() => {
    if (enabled) {
      load().catch(console.error);
    }
  }, [load, enabled]);

  const abort = useCallback(() => {
    progressiveLoader.abort(id);
  }, [id]);

  return {
    state,
    load,
    abort,
    isLoading: state?.isLoading || false,
    isComplete: state?.isComplete || false,
    progress: state?.progress || 0,
    results: state?.results || new Map(),
    errors: state?.errors || new Map(),
  };
};

// Predefined loading strategies for common use cases
export const loadingStrategies = {
  // Critical dashboard data
  dashboardCritical: (): LoadingPhase => ({
    name: 'critical',
    parallel: true,
    timeout: 5000,
    strategies: [
      {
        name: 'user-session',
        priority: 1,
        loader: async () => {
          // Load user session data
          const session = localStorage.getItem('user-session');
          return session ? JSON.parse(session) : null;
        },
        fallback: null,
        timeout: 1000,
      },
      {
        name: 'market-overview',
        priority: 1,
        loader: async () => {
          // Load basic market data
          const response = await fetch('/api/dashboard/overview');
          return response.json();
        },
        fallback: { status: 'loading', data: [] },
        timeout: 3000,
        retries: 2,
      },
      {
        name: 'notifications',
        priority: 2,
        loader: async () => {
          const response = await fetch('/api/notifications?limit=5');
          return response.json();
        },
        fallback: [],
        timeout: 2000,
      },
    ],
  }),

  // Secondary dashboard data
  dashboardSecondary: (): LoadingPhase => ({
    name: 'secondary',
    parallel: false,
    timeout: 10000,
    strategies: [
      {
        name: 'recent-analysis',
        priority: 1,
        loader: async () => {
          const response = await fetch('/api/analysis/recent?limit=10');
          return response.json();
        },
        dependencies: ['market-overview'],
        timeout: 5000,
      },
      {
        name: 'predictions',
        priority: 2,
        loader: async () => {
          const response = await fetch('/api/predictions?active=true');
          return response.json();
        },
        timeout: 5000,
      },
      {
        name: 'feed-status',
        priority: 3,
        loader: async () => {
          const response = await fetch('/api/feeds/status');
          return response.json();
        },
        timeout: 3000,
      },
    ],
  }),

  // Enhanced dashboard data
  dashboardEnhanced: (): LoadingPhase => ({
    name: 'enhanced',
    parallel: true,
    timeout: 15000,
    strategies: [
      {
        name: 'detailed-charts',
        priority: 1,
        loader: async () => {
          const response = await fetch('/api/charts/detailed');
          return response.json();
        },
        condition: () => window.innerWidth > 768, // Only on desktop
        timeout: 8000,
      },
      {
        name: 'entity-analytics',
        priority: 2,
        loader: async () => {
          const response = await fetch('/api/entities/analytics');
          return response.json();
        },
        timeout: 10000,
      },
      {
        name: 'background-insights',
        priority: 3,
        loader: async () => {
          const response = await fetch('/api/insights/background');
          return response.json();
        },
        timeout: 12000,
      },
    ],
  }),
};

// Utility function to create dashboard loading config
export const createDashboardLoader = (): ProgressiveLoadingConfig => ({
  phases: [
    loadingStrategies.dashboardCritical(),
    loadingStrategies.dashboardSecondary(),
    loadingStrategies.dashboardEnhanced(),
  ],
  onProgress: (phase, strategy, progress) => {
    console.log(`Loading ${phase}:${strategy} - ${progress}%`);
  },
  onPhaseComplete: (phase, results) => {
    console.log(`Phase ${phase} completed with ${results.length} results`);
  },
  onComplete: (allResults) => {
    console.log(`All loading completed with ${allResults.size} total results`);
  },
  onError: (phase, strategy, error) => {
    console.warn(`Error in ${phase}:${strategy}:`, error);
  },
});

export default progressiveLoader;