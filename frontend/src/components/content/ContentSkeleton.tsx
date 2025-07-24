import React from 'react';
import { 
  Skeleton, 
  SkeletonCard, 
  SkeletonText,
  SkeletonBadge,
  SkeletonButton 
} from '@/components/ui/Skeleton';
import { PageContainer, PageHeader } from '@/components/layout';

export const ContentSkeleton: React.FC = () => {
  return (
    <PageContainer showBreadcrumbs>
      <div className="animate-in slide-in-up">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <Skeleton height={36} width={200} className="mb-2" />
              <Skeleton height={20} width={350} />
            </div>
            <div className="flex gap-2">
              <SkeletonBadge width={100} />
              <SkeletonBadge width={80} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Skeleton height={40} width={300} rounded="md" />
              <Skeleton height={40} width={40} rounded="md" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton height={16} width={16} rounded="md" />
              <Skeleton height={16} width={80} />
              <Skeleton height={36} width={150} rounded="md" />
            </div>
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in scale-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center justify-between mb-2">
                <Skeleton height={16} width={100} />
                <Skeleton height={24} width={24} rounded="md" />
              </div>
              <Skeleton height={32} width={80} className="mb-1" />
              <Skeleton height={16} width={60} />
            </div>
          ))}
        </div>

        {/* Content Items */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <ContentCardSkeleton key={i} delay={200 + i * 50} />
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-8 animate-in slide-in-up" style={{ animationDelay: '500ms' }}>
          <Skeleton height={16} width={150} />
          <div className="flex gap-2">
            <SkeletonButton width={80} />
            <Skeleton height={36} width={100} rounded="md" />
            <SkeletonButton width={80} />
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export const ContentCardSkeleton: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  return (
    <div 
      className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 animate-in slide-in-up hover-scale"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton height={20} width="60%" className="mb-2" />
          <div className="flex items-center gap-4">
            <SkeletonBadge width={100} />
            <Skeleton height={14} width={120} />
            <Skeleton height={14} width={100} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SkeletonButton width={80} size="sm" />
          <SkeletonButton width={40} size="sm" />
        </div>
      </div>

      {/* Summary */}
      <SkeletonText lines={3} className="mb-4" />

      {/* Topics */}
      <div className="mb-4">
        <Skeleton height={16} width={80} className="mb-2" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBadge key={i} width={60 + Math.random() * 40} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Skeleton height={14} width={100} />
        <div className="flex gap-2">
          <SkeletonButton width={100} size="sm" />
          <SkeletonButton width={80} size="sm" />
        </div>
      </div>
    </div>
  );
};

export const ContentDetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in slide-in-up">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <Skeleton height={28} width="70%" className="mb-2" />
            <div className="flex items-center gap-4">
              <SkeletonBadge width={100} />
              <Skeleton height={16} width={150} />
            </div>
          </div>
          <SkeletonBadge width={80} />
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-left" style={{ animationDelay: '100ms' }}>
            <Skeleton height={24} width={120} className="mb-4" />
            <SkeletonText lines={12} />
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-left" style={{ animationDelay: '150ms' }}>
            <Skeleton height={24} width={100} className="mb-4" />
            <SkeletonText lines={6} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Entities */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-right" style={{ animationDelay: '200ms' }}>
            <Skeleton height={24} width={80} className="mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-2 animate-in scale-in" style={{ animationDelay: `${250 + i * 30}ms` }}>
                  <Skeleton height={32} width={32} rounded="md" />
                  <div className="flex-1">
                    <Skeleton height={16} width="80%" className="mb-1" />
                    <Skeleton height={14} width="60%" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-right" style={{ animationDelay: '400ms' }}>
            <Skeleton height={24} width={100} className="mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton height={14} width={80} className="mb-1" />
                  <Skeleton height={16} width={120} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};