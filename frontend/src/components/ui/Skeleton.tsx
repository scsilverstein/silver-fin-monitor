import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'pulse' | 'wave' | 'shimmer';
  animation?: 'none' | 'pulse' | 'wave' | 'shimmer';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'shimmer',
  animation,
  rounded = 'md',
  width,
  height,
  style,
  ...props
}) => {
  const animationType = animation || variant;
  
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  };

  const baseClasses = cn(
    'bg-gray-200 dark:bg-gray-800 relative overflow-hidden',
    roundedClasses[rounded],
    animationType === 'pulse' && 'animate-pulse',
    animationType === 'wave' && 'animate-wave',
    animationType === 'shimmer' && 'animate-shimmer',
    className
  );

  return (
    <div
      className={baseClasses}
      style={{
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        ...style
      }}
      {...props}
    >
      {animationType === 'shimmer' && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}
      {animationType === 'wave' && (
        <div className="absolute inset-0 -translate-x-full animate-[wave_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}
    </div>
  );
};

// Text skeleton with multiple lines
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}> = ({ lines = 3, className, lastLineWidth = '60%' }) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          className="bg-gray-200 dark:bg-gray-800"
        />
      ))}
    </div>
  );
};

// Avatar skeleton
export const SkeletonAvatar: React.FC<{
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ size = 'md', className }) => {
  const sizes = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64
  };

  return (
    <Skeleton
      width={sizes[size]}
      height={sizes[size]}
      rounded="full"
      className={className}
    />
  );
};

// Card skeleton
export const SkeletonCard: React.FC<{
  className?: string;
  showImage?: boolean;
  showAvatar?: boolean;
  lines?: number;
}> = ({ className, showImage = false, showAvatar = false, lines = 3 }) => {
  return (
    <div className={cn('bg-white dark:bg-gray-900 rounded-lg p-6 space-y-4', className)}>
      {showImage && (
        <Skeleton height={200} className="w-full mb-4" rounded="lg" />
      )}
      {showAvatar && (
        <div className="flex items-center space-x-4 mb-4">
          <SkeletonAvatar />
          <div className="flex-1 space-y-2">
            <Skeleton height={20} width="50%" />
            <Skeleton height={16} width="30%" />
          </div>
        </div>
      )}
      <Skeleton height={24} width="70%" className="mb-2" />
      <SkeletonText lines={lines} />
      <div className="flex gap-2 mt-4">
        <Skeleton height={32} width={80} rounded="md" />
        <Skeleton height={32} width={80} rounded="md" />
      </div>
    </div>
  );
};

// Chart skeleton
export const SkeletonChart: React.FC<{
  height?: number;
  className?: string;
  type?: 'line' | 'bar' | 'pie';
}> = ({ height = 300, className, type = 'line' }) => {
  return (
    <div className={cn('relative', className)}>
      <Skeleton height={height} className="w-full" rounded="lg" />
      {type === 'line' && (
        <svg
          className="absolute inset-0 w-full h-full p-8"
          preserveAspectRatio="none"
        >
          <path
            d={`M 0 ${height * 0.7} Q ${height * 0.3} ${height * 0.4} ${height * 0.6} ${height * 0.5} T ${height} ${height * 0.3}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="text-gray-300 dark:text-gray-700"
            opacity={0.5}
          />
        </svg>
      )}
    </div>
  );
};

// Table skeleton
export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className }) => {
  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              height={20}
              width={`${100 / columns}%`}
              className="flex-1"
            />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                height={16}
                width={`${100 / columns}%`}
                className="flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// List skeleton
export const SkeletonList: React.FC<{
  items?: number;
  className?: string;
  showIcon?: boolean;
  showAvatar?: boolean;
}> = ({ items = 5, className, showIcon = false, showAvatar = false }) => {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-3 rounded-lg">
          {showIcon && <Skeleton width={24} height={24} rounded="md" />}
          {showAvatar && <SkeletonAvatar size="sm" />}
          <div className="flex-1 space-y-2">
            <Skeleton height={18} width="60%" />
            <Skeleton height={14} width="40%" />
          </div>
          <Skeleton height={20} width={60} rounded="md" />
        </div>
      ))}
    </div>
  );
};

// Button skeleton
export const SkeletonButton: React.FC<{
  width?: string | number;
  height?: number;
  className?: string;
}> = ({ width = 100, height = 36, className }) => {
  return (
    <Skeleton
      width={width}
      height={height}
      rounded="md"
      className={cn('bg-gray-200 dark:bg-gray-800', className)}
    />
  );
};

// Badge skeleton
export const SkeletonBadge: React.FC<{
  width?: string | number;
  className?: string;
}> = ({ width = 60, className }) => {
  return (
    <Skeleton
      width={width}
      height={22}
      rounded="full"
      className={cn('bg-gray-200 dark:bg-gray-800', className)}
    />
  );
};

// Input skeleton
export const SkeletonInput: React.FC<{
  className?: string;
}> = ({ className }) => {
  return (
    <Skeleton
      height={40}
      className={cn('w-full bg-gray-100 dark:bg-gray-800', className)}
      rounded="md"
    />
  );
};

// Legacy CardSkeleton for backwards compatibility
export const CardSkeleton: React.FC = () => (
  <div className="space-y-3">
    <Skeleton className="h-5 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
    <Skeleton className="h-4 w-[150px]" />
  </div>
);

export default Skeleton;