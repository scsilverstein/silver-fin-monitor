import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Zap, TrendingUp, BarChart, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalLoadingIndicatorProps {
  show: boolean;
  message?: string;
  progress?: number;
  type?: 'default' | 'data' | 'analysis' | 'processing';
}

const loadingMessages = [
  'Processing market data...',
  'Analyzing trends...',
  'Updating insights...',
  'Gathering intelligence...',
  'Optimizing performance...',
  'Loading dashboard...',
  'Syncing data sources...',
  'Generating predictions...',
  'Calculating metrics...',
  'Building visualizations...'
];

const typeConfig = {
  default: {
    icon: Loader2,
    color: 'text-primary',
    bgColor: 'bg-primary/10'
  },
  data: {
    icon: BarChart,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  },
  analysis: {
    icon: TrendingUp,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10'
  },
  processing: {
    icon: Zap,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10'
  }
};

export const GlobalLoadingIndicator: React.FC<GlobalLoadingIndicatorProps> = ({
  show,
  message,
  progress,
  type = 'default'
}) => {
  const [currentMessage, setCurrentMessage] = useState(message || loadingMessages[0]);
  const [currentProgress, setCurrentProgress] = useState(progress || 0);
  const { icon: Icon, color, bgColor } = typeConfig[type];

  // Auto-cycle through loading messages if no message provided
  useEffect(() => {
    if (!message && show) {
      const interval = setInterval(() => {
        setCurrentMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [message, show]);

  // Auto-increment progress if no progress provided
  useEffect(() => {
    if (progress === undefined && show) {
      const interval = setInterval(() => {
        setCurrentProgress(prev => {
          const increment = Math.random() * 15 + 5; // Random increment between 5-20
          const newProgress = prev + increment;
          return newProgress > 90 ? 90 : newProgress; // Cap at 90% until actually complete
        });
      }, 500);

      return () => clearInterval(interval);
    } else if (progress !== undefined) {
      setCurrentProgress(progress);
    }
  }, [progress, show]);

  // Reset progress when hidden
  useEffect(() => {
    if (!show) {
      setCurrentProgress(0);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Loading Indicator */}
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ 
              duration: 0.3,
              type: "spring",
              damping: 20,
              stiffness: 300
            }}
          >
            <div className={cn(
              'glass rounded-2xl p-8 max-w-sm w-full mx-4',
              'border border-border/50 shadow-2xl'
            )}>
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <motion.div
                  className={cn(
                    'p-4 rounded-full',
                    bgColor
                  )}
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: type === 'default' ? [0, 360] : 0
                  }}
                  transition={{
                    duration: type === 'default' ? 2 : 3,
                    repeat: 10000,
                    ease: "easeInOut"
                  }}
                >
                  <Icon className={cn('h-8 w-8', color)} />
                </motion.div>
              </div>

              {/* Message */}
              <motion.div
                className="text-center mb-6"
                key={currentMessage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="text-lg font-semibold mb-2">Loading</h3>
                <p className="text-sm text-muted-foreground">
                  {message || currentMessage}
                </p>
              </motion.div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      type === 'default' && 'bg-primary',
                      type === 'data' && 'bg-blue-500',
                      type === 'analysis' && 'bg-green-500',
                      type === 'processing' && 'bg-yellow-500'
                    )}
                    initial={{ width: '0%' }}
                    animate={{ width: `${currentProgress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                
                {/* Progress Text */}
                <motion.div
                  className="text-center mt-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {Math.round(currentProgress)}%
                  </span>
                </motion.div>
              </div>

              {/* Animated Dots */}
              <div className="flex justify-center gap-1 mt-4">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className={cn('w-2 h-2 rounded-full', bgColor.replace('/10', '/60'))}
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: 10000,
                      delay: i * 0.2,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Hook for easier usage
export const useGlobalLoading = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>();
  const [progress, setProgress] = useState<number>();
  const [type, setType] = useState<'default' | 'data' | 'analysis' | 'processing'>('default');

  const showLoading = (options?: {
    message?: string;
    progress?: number;
    type?: 'default' | 'data' | 'analysis' | 'processing';
  }) => {
    setMessage(options?.message);
    setProgress(options?.progress);
    setType(options?.type || 'default');
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
    setMessage(undefined);
    setProgress(undefined);
    setType('default');
  };

  const updateProgress = (newProgress: number) => {
    setProgress(newProgress);
  };

  const updateMessage = (newMessage: string) => {
    setMessage(newMessage);
  };

  return {
    isLoading,
    message,
    progress,
    type,
    showLoading,
    hideLoading,
    updateProgress,
    updateMessage,
    LoadingComponent: () => (
      <GlobalLoadingIndicator
        show={isLoading}
        message={message}
        progress={progress}
        type={type}
      />
    )
  };
};