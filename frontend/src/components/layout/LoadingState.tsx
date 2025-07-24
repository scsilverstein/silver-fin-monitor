import React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'refresh' | 'dots' | 'skeleton';
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  variant = 'spinner',
  size = 'md',
  fullScreen = false,
  className
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  };

  const containerClasses = cn(
    "flex flex-col items-center justify-center space-y-3",
    fullScreen ? "min-h-[50vh]" : "py-12",
    className
  );

  const iconClasses = cn(
    sizeClasses[size],
    variant === 'spinner' ? 'text-primary' : 'text-muted-foreground',
    'animate-spin'
  );

  const renderIcon = () => {
    switch (variant) {
      case 'refresh':
        return <RefreshCw className={iconClasses} />;
      case 'dots':
        return (
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        );
      case 'skeleton':
        return (
          <div className="space-y-3 w-full max-w-md">
            <div className="h-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
          </div>
        );
      default:
        return <Loader2 className={iconClasses} />;
    }
  };

  return (
    <div className={containerClasses}>
      {renderIcon()}
      {variant !== 'skeleton' && (
        <p className="text-muted-foreground text-sm">{message}</p>
      )}
    </div>
  );
};

// Specialized loading components for common use cases
export const PageLoadingState: React.FC<{ message?: string }> = ({ 
  message = 'Loading page...' 
}) => (
  <LoadingState variant="spinner" size="lg" fullScreen message={message} />
);

export const ContentLoadingState: React.FC<{ message?: string }> = ({ 
  message = 'Loading content...' 
}) => (
  <LoadingState variant="spinner" size="md" message={message} />
);

export const InlineLoadingState: React.FC<{ message?: string }> = ({ 
  message = 'Loading...' 
}) => (
  <LoadingState variant="dots" size="sm" message={message} className="py-4" />
);

export const SkeletonLoadingState: React.FC = () => (
  <LoadingState variant="skeleton" />
);