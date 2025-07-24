import React from 'react';
import { 
  Skeleton, 
  SkeletonCard, 
  SkeletonText,
  SkeletonBadge,
  SkeletonButton 
} from '@/components/ui/Skeleton';

export const FeedCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover-lift animate-in scale-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton width={40} height={40} rounded="lg" />
          <div>
            <Skeleton height={20} width={150} className="mb-1" />
            <Skeleton height={16} width={200} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBadge />
          <SkeletonBadge width={80} />
        </div>
      </div>

      {/* Content */}
      <SkeletonText lines={3} className="mb-4" />

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <SkeletonButton width={100} />
          <SkeletonButton width={80} />
        </div>
        <Skeleton height={14} width={120} />
      </div>
    </div>
  );
};

export const FeedListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ animationDelay: `${i * 50}ms` }}>
          <FeedCardSkeleton />
        </div>
      ))}
    </div>
  );
};

export const FeedModalSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in slide-in-up">
      {/* Form fields */}
      <div className="space-y-4">
        <div>
          <Skeleton height={14} width={80} className="mb-2" />
          <Skeleton height={40} className="w-full" rounded="md" />
        </div>
        <div>
          <Skeleton height={14} width={60} className="mb-2" />
          <Skeleton height={40} className="w-full" rounded="md" />
        </div>
        <div>
          <Skeleton height={14} width={100} className="mb-2" />
          <Skeleton height={40} className="w-full" rounded="md" />
        </div>
        <div>
          <Skeleton height={14} width={120} className="mb-2" />
          <Skeleton height={80} className="w-full" rounded="md" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <SkeletonButton width={80} />
        <SkeletonButton width={100} />
      </div>
    </div>
  );
};

export const FeedProcessingSkeleton: React.FC = () => {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Skeleton width={20} height={20} rounded="full" className="animate-spin" />
        </div>
        <div className="flex-1">
          <Skeleton height={16} width={200} className="mb-1" />
          <Skeleton height={14} width={150} />
        </div>
      </div>
    </div>
  );
};