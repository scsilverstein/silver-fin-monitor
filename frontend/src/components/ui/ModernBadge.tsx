import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
  animated?: boolean;
  dot?: boolean;
}

export const ModernBadge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'default', animated = false, dot = false, children, ...props }, ref) => {
    const baseStyles = cn(
      'inline-flex items-center gap-1.5 font-medium transition-all',
      'rounded-full'
    );

    const variants = {
      default: 'bg-primary/10 text-primary border border-primary/20',
      secondary: 'bg-secondary text-secondary-foreground border border-secondary/20',
      success: 'bg-green-100 text-green-800 border border-green-200',
      warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      error: 'bg-red-100 text-red-800 border border-red-200',
      info: 'bg-blue-100 text-blue-800 border border-blue-200',
      outline: 'border border-border text-foreground',
      destructive: 'bg-red-100 text-red-800 border border-red-200',
    };

    const sizes = {
      default: 'px-2.5 py-0.5 text-xs',
      sm: 'px-2 py-0.5 text-[0.65rem]',
      lg: 'px-3 py-1 text-sm',
    };

    const dotColors = {
      default: 'bg-primary',
      secondary: 'bg-secondary-foreground',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
      outline: 'bg-foreground',
      destructive: 'bg-red-500',
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          animated && 'animate-pulse',
          className
        )}
        {...props}
      >
        {dot && (
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            dotColors[variant],
            animated && 'animate-pulse'
          )} />
        )}
        {children}
      </div>
    );
  }
);

ModernBadge.displayName = 'ModernBadge';

// Badge Group Component
interface BadgeGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const BadgeGroup: React.FC<BadgeGroupProps> = ({ children, className }) => {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {children}
    </div>
  );
};

// Status Badge Component
interface StatusBadgeProps {
  status: 'online' | 'offline' | 'away' | 'busy';
  label?: string;
  size?: 'sm' | 'default' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  label, 
  size = 'default' 
}) => {
  const statusConfig = {
    online: { color: 'bg-success', label: 'Online' },
    offline: { color: 'bg-muted-foreground', label: 'Offline' },
    away: { color: 'bg-warning', label: 'Away' },
    busy: { color: 'bg-error', label: 'Busy' },
  };

  const sizeConfig = {
    sm: 'w-2 h-2',
    default: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <div className="inline-flex items-center gap-2">
      <span className="relative flex">
        <span className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
          statusConfig[status].color
        )} />
        <span className={cn(
          'relative inline-flex rounded-full',
          sizeConfig[size],
          statusConfig[status].color
        )} />
      </span>
      {label && (
        <span className="text-sm text-muted-foreground">
          {label || statusConfig[status].label}
        </span>
      )}
    </div>
  );
};