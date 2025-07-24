import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X, Undo } from 'lucide-react';
import { ModernButton } from '@/components/ui/ModernButton';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  persistent?: boolean;
  actions?: ToastAction[];
  onUndo?: () => void;
  progress?: number;
  icon?: React.ReactNode;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (toast: Omit<Toast, 'id'>) => string;
  success: (title: string, description?: string, options?: Partial<Toast>) => string;
  error: (title: string, description?: string, options?: Partial<Toast>) => string;
  warning: (title: string, description?: string, options?: Partial<Toast>) => string;
  info: (title: string, description?: string, options?: Partial<Toast>) => string;
  loading: (title: string, description?: string, options?: Partial<Toast>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  update: (id: string, updates: Partial<Toast>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const toastIcons = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
  loading: <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
};

const ToastComponent: React.FC<{
  toast: Toast;
  onDismiss: (id: string) => void;
  position: ToastPosition;
}> = ({ toast, onDismiss, position }) => {
  const [progress, setProgress] = React.useState(100);

  React.useEffect(() => {
    if (toast.persistent || toast.type === 'loading' || !toast.duration) return;

    const duration = toast.duration || 5000;
    const interval = 50;
    const decrement = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          onDismiss(toast.id);
          return 0;
        }
        return prev - decrement;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast, onDismiss]);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -100, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -100, scale: 0.9 }}
      className={`fixed z-50 w-96 max-w-sm ${getPositionClasses()}`}
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
        {/* Progress bar */}
        {!toast.persistent && toast.type !== 'loading' && toast.duration && (
          <div className="h-1 bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full bg-blue-500 transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {toast.icon || toastIcons[toast.type]}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {toast.title}
              </h3>
              {toast.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {toast.description}
                </p>
              )}

              {/* Actions */}
              {(toast.actions || toast.onUndo) && (
                <div className="mt-3 flex gap-2">
                  {toast.onUndo && (
                    <ModernButton
                      size="sm"
                      variant="outline"
                      onClick={toast.onUndo}
                      className="text-xs"
                    >
                      <Undo className="h-3 w-3 mr-1" />
                      Undo
                    </ModernButton>
                  )}
                  {toast.actions?.map((action, index) => (
                    <ModernButton
                      key={index}
                      size="sm"
                      variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                      onClick={action.onClick}
                      className="text-xs"
                    >
                      {action.label}
                    </ModernButton>
                  ))}
                </div>
              )}
            </div>

            {/* Dismiss button */}
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(toast.id)}
              className="flex-shrink-0 p-1 h-auto"
            >
              <X className="h-4 w-4" />
            </ModernButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ToastProvider: React.FC<{
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}> = ({ children, position = 'top-right', maxToasts = 5 }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const toast = useCallback((toastData: Omit<Toast, 'id'>) => {
    const id = generateId();
    const newToast = {
      ...toastData,
      id,
      duration: toastData.duration ?? 5000
    };

    setToasts(prev => {
      const updated = [newToast, ...prev];
      return updated.slice(0, maxToasts);
    });

    return id;
  }, [maxToasts]);

  const success = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return toast({ ...options, type: 'success', title, description });
  }, [toast]);

  const error = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return toast({ ...options, type: 'error', title, description, persistent: true });
  }, [toast]);

  const warning = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return toast({ ...options, type: 'warning', title, description });
  }, [toast]);

  const info = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return toast({ ...options, type: 'info', title, description });
  }, [toast]);

  const loading = useCallback((title: string, description?: string, options?: Partial<Toast>) => {
    return toast({ ...options, type: 'loading', title, description, persistent: true });
  }, [toast]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const update = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  return (
    <ToastContext.Provider value={{
      toasts,
      toast,
      success,
      error,
      warning,
      info,
      loading,
      dismiss,
      dismissAll,
      update
    }}>
      {children}
      <div className="fixed inset-0 pointer-events-none z-50">
        <AnimatePresence>
          {toasts.map((toast, index) => (
            <motion.div
              key={toast.id}
              initial={{ y: index * 10 }}
              animate={{ y: index * 110 }}
              className="absolute"
              style={{
                top: position.includes('top') ? '1rem' : 'auto',
                bottom: position.includes('bottom') ? '1rem' : 'auto',
                left: position.includes('left') ? '1rem' : position.includes('center') ? '50%' : 'auto',
                right: position.includes('right') ? '1rem' : 'auto',
                transform: position.includes('center') ? 'translateX(-50%)' : 'none'
              }}
            >
              <ToastComponent
                toast={toast}
                onDismiss={dismiss}
                position={position}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};