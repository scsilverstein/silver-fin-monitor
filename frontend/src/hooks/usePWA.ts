import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface PWAInstallPrompt extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

export const usePWA = () => {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isInstallable: false,
    isOnline: navigator.onLine,
    isUpdateAvailable: false,
    registration: null,
  });
  
  const [installPrompt, setInstallPrompt] = useState<PWAInstallPrompt | null>(null);
  const { success, info, warning } = useToast();

  // Check if PWA is installed
  const checkInstallation = useCallback(() => {
    const isInstalled = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');
    
    setState(prev => ({ ...prev, isInstalled }));
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        setState(prev => ({ ...prev, registration }));
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setState(prev => ({ ...prev, isUpdateAvailable: true }));
                info('Update Available', 'A new version is ready to install');
              }
            });
          }
        });

        console.log('Service Worker registered successfully');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }, [info]);

  // Handle install prompt
  const handleInstallPrompt = useCallback((e: Event) => {
    e.preventDefault();
    setInstallPrompt(e as PWAInstallPrompt);
    setState(prev => ({ ...prev, isInstallable: true }));
  }, []);

  // Install PWA
  const installPWA = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      const result = await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      
      if (choice.outcome === 'accepted') {
        success('App Installed', 'Silver Fin Monitor has been installed successfully!');
        setState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
        setInstallPrompt(null);
        return true;
      } else {
        info('Installation Cancelled', 'You can install the app later from your browser menu');
        return false;
      }
    } catch (error) {
      console.error('Installation failed:', error);
      warning('Installation Failed', 'Could not install the app. Please try again.');
      return false;
    }
  }, [installPrompt, success, info, warning]);

  // Update service worker
  const updateServiceWorker = useCallback(async () => {
    if (!state.registration) return;

    try {
      const newWorker = state.registration.waiting;
      if (newWorker) {
        newWorker.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    } catch (error) {
      console.error('Update failed:', error);
      warning('Update Failed', 'Could not update the app. Please refresh manually.');
    }
  }, [state.registration, warning]);

  // Handle online/offline status
  const handleOnlineStatus = useCallback(() => {
    const isOnline = navigator.onLine;
    setState(prev => ({ ...prev, isOnline }));
    
    if (isOnline) {
      success('Back Online', 'Connection restored');
    } else {
      warning('Offline', 'You are currently offline. Some features may be limited.');
    }
  }, [success, warning]);

  // Cache API response
  const cacheAPIResponse = useCallback(async (url: string, response: any) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_API_RESPONSE',
        url,
        response
      });
    }
  }, []);

  // Get cache usage
  const getCacheUsage = useCallback(async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0,
          percentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0
        };
      } catch (error) {
        console.error('Could not get cache usage:', error);
        return null;
      }
    }
    return null;
  }, []);

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        success('Cache Cleared', 'Application cache has been cleared');
      }
    } catch (error) {
      console.error('Could not clear cache:', error);
      warning('Clear Failed', 'Could not clear cache. Please try again.');
    }
  }, [success, warning]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          success('Notifications Enabled', 'You will receive important updates');
          return true;
        } else {
          info('Notifications Disabled', 'You can enable them in your browser settings');
          return false;
        }
      } catch (error) {
        console.error('Notification permission failed:', error);
        return false;
      }
    }
    return false;
  }, [success, info]);

  // Show notification
  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          // Use service worker for persistent notifications
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            ...options
          });
        } else {
          // Fallback to regular notification
          new Notification(title, {
            icon: '/icons/icon-192.png',
            ...options
          });
        }
      } catch (error) {
        console.error('Could not show notification:', error);
      }
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    checkInstallation();
    registerServiceWorker();

    // Install prompt
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    
    // Online/offline status
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // App installed
    window.addEventListener('appinstalled', () => {
      setState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      setInstallPrompt(null);
      success('App Installed', 'Welcome to Silver Fin Monitor!');
    });

    // Service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [
    checkInstallation,
    registerServiceWorker,
    handleInstallPrompt,
    handleOnlineStatus,
    success
  ]);

  return {
    ...state,
    installPWA,
    updateServiceWorker,
    cacheAPIResponse,
    getCacheUsage,
    clearCache,
    requestNotificationPermission,
    showNotification,
    canInstall: state.isInstallable && !state.isInstalled,
    canUpdate: state.isUpdateAvailable,
  };
};