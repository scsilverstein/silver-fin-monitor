import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  Bell,
  BellOff,
  Smartphone,
  Monitor,
  Trash2,
  HardDrive,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePWA } from '@/hooks/usePWA';
import { useToast } from '@/contexts/ToastContext';

export const PWAStatus: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [cacheUsage, setCacheUsage] = useState<{
    used: number;
    available: number;
    percentage: number;
  } | null>(null);
  
  const {
    isInstalled,
    isOnline,
    isUpdateAvailable,
    canInstall,
    canUpdate,
    installPWA,
    updateServiceWorker,
    getCacheUsage,
    clearCache,
    requestNotificationPermission,
  } = usePWA();
  
  const { success, info } = useToast();

  // Load cache usage when details are shown
  React.useEffect(() => {
    if (showDetails && !cacheUsage) {
      getCacheUsage().then(setCacheUsage);
    }
  }, [showDetails, cacheUsage, getCacheUsage]);

  const handleInstall = async () => {
    const installed = await installPWA();
    if (installed) {
      setShowDetails(false);
    }
  };

  const handleUpdate = async () => {
    await updateServiceWorker();
    setShowDetails(false);
  };

  const handleNotificationRequest = async () => {
    await requestNotificationPermission();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="relative">
      {/* PWA Status Indicator */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={cn(
          'p-2 rounded-lg transition-colors relative',
          'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
        )}
        title="PWA Status"
      >
        <div className="relative">
          {isInstalled ? (
            <Smartphone className="h-5 w-5" />
          ) : (
            <Monitor className="h-5 w-5" />
          )}
          
          {/* Status indicators */}
          <div className="absolute -top-1 -right-1 flex flex-col gap-0.5">
            {!isOnline && (
              <div className="w-2 h-2 bg-destructive rounded-full" />
            )}
            {(canInstall || canUpdate) && (
              <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
            )}
          </div>
        </div>
      </button>

      {/* PWA Details Panel */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            className="absolute right-0 mt-2 w-80 glass rounded-lg shadow-lg overflow-hidden border border-border/50 z-50"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">App Status</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-1 hover:bg-accent rounded transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Status Items */}
            <div className="p-4 space-y-4">
              {/* Installation Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isInstalled ? (
                    <Smartphone className="h-4 w-4 text-green-500" />
                  ) : (
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {isInstalled ? 'Installed' : 'Browser Mode'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isInstalled 
                        ? 'App is installed on device' 
                        : 'Running in browser'
                      }
                    </p>
                  </div>
                </div>
                {canInstall && (
                  <motion.button
                    onClick={handleInstall}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Download className="h-3 w-3" />
                    Install
                  </motion.button>
                )}
              </div>

              {/* Network Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {isOnline ? 'Online' : 'Offline'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isOnline 
                        ? 'Connected to internet' 
                        : 'Working offline'
                      }
                    </p>
                  </div>
                </div>
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  isOnline ? 'bg-green-500' : 'bg-destructive'
                )} />
              </div>

              {/* Update Status */}
              {canUpdate && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-4 w-4 text-warning" />
                    <div>
                      <p className="text-sm font-medium">Update Available</p>
                      <p className="text-xs text-muted-foreground">
                        New version ready to install
                      </p>
                    </div>
                  </div>
                  <motion.button
                    onClick={handleUpdate}
                    className="flex items-center gap-2 px-3 py-1.5 bg-warning text-warning-foreground rounded text-sm hover:bg-warning/90 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Update
                  </motion.button>
                </div>
              )}

              {/* Notifications */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {Notification.permission === 'granted' ? (
                    <Bell className="h-4 w-4 text-green-500" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {Notification.permission === 'granted' 
                        ? 'Enabled' 
                        : 'Disabled'
                      }
                    </p>
                  </div>
                </div>
                {Notification.permission !== 'granted' && (
                  <motion.button
                    onClick={handleNotificationRequest}
                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/90 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Bell className="h-3 w-3" />
                    Enable
                  </motion.button>
                )}
              </div>

              {/* Cache Usage */}
              {cacheUsage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Storage</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(cacheUsage.used)} of {formatBytes(cacheUsage.available)}
                        </p>
                      </div>
                    </div>
                    <motion.button
                      onClick={clearCache}
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded text-sm hover:bg-muted/80 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </motion.button>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(cacheUsage.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-muted/20 border-t border-border/50 text-center">
              <p className="text-xs text-muted-foreground">
                {isInstalled ? 'PWA Mode' : 'Browser Mode'} • v1.0.0
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};