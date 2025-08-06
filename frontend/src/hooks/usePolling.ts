import { useEffect, useRef, useCallback } from 'react';
import { pollingService, PollingOptions } from '../services/polling.service';

export interface UsePollingOptions extends PollingOptions {
  enabled?: boolean;
}

export const usePolling = <T = any>(
  endpoint: string,
  callback: (data: T) => void,
  options: UsePollingOptions = {}
) => {
  const { enabled = true, interval = 30000, immediate = true } = options;
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const errorUnsubscribeRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    if (!enabled) return;
    
    // Subscribe to polling updates
    unsubscribeRef.current = pollingService.subscribe(
      endpoint,
      callback,
      { interval, immediate }
    );
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [endpoint, enabled, interval, immediate, callback]);
  
  const onError = useCallback((errorHandler: (error: Error) => void) => {
    if (errorUnsubscribeRef.current) {
      errorUnsubscribeRef.current();
    }
    
    errorUnsubscribeRef.current = pollingService.onError(endpoint, errorHandler);
    
    return () => {
      if (errorUnsubscribeRef.current) {
        errorUnsubscribeRef.current();
        errorUnsubscribeRef.current = null;
      }
    };
  }, [endpoint]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (errorUnsubscribeRef.current) {
        errorUnsubscribeRef.current();
      }
    };
  }, []);
  
  return {
    onError
  };
};

// Specialized hooks for specific features

export const useDashboardPolling = (
  onUpdate: (data: any) => void,
  options: UsePollingOptions = {}
) => {
  return usePolling('/dashboard', onUpdate, { 
    interval: 60000, // 1 minute
    ...options 
  });
};

export const useQueuePolling = (
  onUpdate: (data: any) => void,
  options: UsePollingOptions = {}
) => {
  return usePolling('/queue/status', onUpdate, { 
    interval: 30000, // 30 seconds
    ...options 
  });
};

export const useAnalysisPolling = (
  onUpdate: (data: any) => void,
  options: UsePollingOptions = {}
) => {
  return usePolling('/analysis', onUpdate, { 
    interval: 120000, // 2 minutes
    ...options 
  });
};

export const usePredictionsPolling = (
  onUpdate: (data: any) => void,
  options: UsePollingOptions = {}
) => {
  return usePolling('/predictions', onUpdate, { 
    interval: 300000, // 5 minutes
    ...options 
  });
};

export const useFeedsPolling = (
  onUpdate: (data: any) => void,
  options: UsePollingOptions = {}
) => {
  return usePolling('/feeds', onUpdate, { 
    interval: 120000, // 2 minutes
    ...options 
  });
};