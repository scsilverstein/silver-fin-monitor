import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkBackendConnection = async () => {
    try {
      setIsChecking(true);
      // Test with a simple health check endpoint
      await api.get('/health');
      setIsBackendConnected(true);
    } catch (error) {
      console.warn('Backend connection check failed:', error);
      setIsBackendConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check initial connection
    checkBackendConnection();

    // Check periodically
    const interval = setInterval(checkBackendConnection, 30000); // Every 30 seconds

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      checkBackendConnection();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setIsBackendConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isBackendConnected,
    isChecking,
    checkConnection: checkBackendConnection
  };
};