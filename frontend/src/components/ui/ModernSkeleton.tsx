import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const ModernSkeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ 
    className, 
    variant = 'default', 
    width, 
    height, 
    animation = 'pulse',
    ...props 
  }, ref) => {
    const baseStyles = cn(
      'bg-muted/50 relative overflow-hidden',
      animation === 'pulse' && 'animate-pulse',
      animation === 'wave' && 'skeleton'
    );

    const variants = {
      default: 'rounded-md',
      text: 'rounded h-4',
      circular: 'rounded-full',
      rectangular: 'rounded-lg',
    };

    const style: React.CSSProperties = {
      width: width || (variant === 'circular' ? 40 : '100%'),
      height: height || (variant === 'circular' ? 40 : variant === 'text' ? 16 : 200),
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          className
        )}
        style={style}
        {...props}
      />
    );
  }
);

ModernSkeleton.displayName = 'ModernSkeleton';

// Skeleton Card Component
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('space-y-4 p-6 rounded-lg border border-border', className)}>
      <div className="flex items-center gap-4">
        <ModernSkeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <ModernSkeleton variant="text" width="60%" />
          <ModernSkeleton variant="text" width="40%" />
        </div>
      </div>
      <ModernSkeleton variant="rectangular" height={120} />
      <div className="space-y-2">
        <ModernSkeleton variant="text" />
        <ModernSkeleton variant="text" width="80%" />
      </div>
    </div>
  );
};

// Skeleton Table Component
export const SkeletonTable: React.FC<{ rows?: number; className?: string }> = ({ 
  rows = 5, 
  className 
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-border">
        <ModernSkeleton variant="text" width="20%" />
        <ModernSkeleton variant="text" width="30%" />
        <ModernSkeleton variant="text" width="25%" />
        <ModernSkeleton variant="text" width="25%" />
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-border/50">
          <ModernSkeleton variant="text" width="20%" />
          <ModernSkeleton variant="text" width="30%" />
          <ModernSkeleton variant="text" width="25%" />
          <ModernSkeleton variant="text" width="25%" />
        </div>
      ))}
    </div>
  );
};

// Skeleton List Component
export const SkeletonList: React.FC<{ items?: number; className?: string }> = ({ 
  items = 3, 
  className 
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <ModernSkeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <ModernSkeleton variant="text" width="70%" />
            <ModernSkeleton variant="text" width="50%" height={12} />
          </div>
          <ModernSkeleton variant="text" width={60} />
        </div>
      ))}
    </div>
  );
};

// Skeleton Dashboard Component
export const SkeletonDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-6 rounded-lg border border-border space-y-2">
            <ModernSkeleton variant="text" width="50%" height={14} />
            <ModernSkeleton variant="text" width="30%" height={32} />
            <ModernSkeleton variant="text" width="40%" height={12} />
          </div>
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModernSkeleton variant="rectangular" height={300} />
        <ModernSkeleton variant="rectangular" height={300} />
      </div>
      
      {/* Table */}
      <SkeletonTable rows={5} />
    </div>
  );
};