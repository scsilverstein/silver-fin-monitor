import { useEffect, useRef, useCallback } from 'react';
import { websocketService, WebSocketEvent } from '@/services/websocket.service';
import { useAuthStore } from '@/store/auth.store';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  channels?: string[];
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { autoConnect = true, channels = [] } = options;
  const { isAuthenticated } = useAuthStore();
  const unsubscribesRef = useRef<(() => void)[]>([]);
  
  useEffect(() => {
    if (autoConnect && isAuthenticated && !websocketService.isConnected()) {
      websocketService.connect();
    }
    
    return () => {
      // Clean up all event listeners
      unsubscribesRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribesRef.current = [];
    };
  }, [autoConnect, isAuthenticated]);
  
  useEffect(() => {
    if (channels.length > 0 && websocketService.isConnected()) {
      websocketService.subscribe(channels);
      
      return () => {
        websocketService.unsubscribe(channels);
      };
    }
  }, [channels]);
  
  const on = useCallback(<T = any>(
    event: WebSocketEvent,
    callback: (data: T) => void
  ): void => {
    const unsubscribe = websocketService.on(event, callback);
    unsubscribesRef.current.push(unsubscribe);
  }, []);
  
  const subscribe = useCallback((newChannels: string[]) => {
    websocketService.subscribe(newChannels);
  }, []);
  
  const unsubscribe = useCallback((channelsToRemove: string[]) => {
    websocketService.unsubscribe(channelsToRemove);
  }, []);
  
  return {
    on,
    subscribe,
    unsubscribe,
    isConnected: websocketService.isConnected()
  };
};

// Specialized hooks for specific features

export const useFeedUpdates = (onUpdate: (data: any) => void) => {
  const ws = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = websocketService.onFeedProcessingUpdate(onUpdate);
    return unsubscribe;
  }, [onUpdate]);
  
  return ws;
};

export const useAnalysisUpdates = (onUpdate: (data: any) => void) => {
  const ws = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = websocketService.onAnalysisUpdate(onUpdate);
    return unsubscribe;
  }, [onUpdate]);
  
  return ws;
};

export const useStockAlerts = (onAlert: (alert: any) => void) => {
  const ws = useWebSocket({ channels: ['stock:alerts'] });
  
  useEffect(() => {
    const unsubscribe = websocketService.onStockAlert(onAlert);
    return unsubscribe;
  }, [onAlert]);
  
  return ws;
};

export const useSystemMetrics = (onMetrics: (metrics: any) => void) => {
  const ws = useWebSocket();
  
  useEffect(() => {
    const unsubscribe = websocketService.onSystemMetrics(onMetrics);
    return unsubscribe;
  }, [onMetrics]);
  
  return ws;
};