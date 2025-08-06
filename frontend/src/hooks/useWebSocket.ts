// DEPRECATED: WebSocket functionality replaced with polling
// This file is kept for backward compatibility but redirects to polling

import { usePolling, UsePollingOptions } from './usePolling';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  channels?: string[];
  interval?: number;
}

// Legacy WebSocket hook that now uses polling for compatibility
export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  console.warn('useWebSocket is deprecated. Use usePolling instead for better serverless compatibility.');
  
  // Mock WebSocket interface with polling under the hood
  const subscribe = (channels: string[]) => {
    console.warn('WebSocket subscribe() called but not implemented. Use usePolling directly.');
  };
  
  const unsubscribe = (channels: string[]) => {
    console.warn('WebSocket unsubscribe() called but not implemented.');
  };
  
  const on = (event: string, callback: (data: any) => void) => {
    console.warn('WebSocket on() called but not implemented. Use usePolling directly.');
  };
  
  return {
    on,
    subscribe,
    unsubscribe,
    isConnected: false // Always false since we don't use WebSockets
  };
};

// Replace specialized WebSocket hooks with polling equivalents

export const useFeedUpdates = (onUpdate: (data: any) => void) => {
  return usePolling('/feeds', onUpdate, { interval: 120000 }); // 2 minutes
};

export const useAnalysisUpdates = (onUpdate: (data: any) => void) => {
  return usePolling('/analysis', onUpdate, { interval: 120000 }); // 2 minutes
};

export const useStockAlerts = (onAlert: (alert: any) => void) => {
  return usePolling('/stocks/alerts', onAlert, { interval: 60000 }); // 1 minute
};

export const useSystemMetrics = (onMetrics: (metrics: any) => void) => {
  return usePolling('/system/metrics', onMetrics, { interval: 30000 }); // 30 seconds
};