import React from 'react';
import { 
  Skeleton, 
  SkeletonCard, 
  SkeletonChart, 
  SkeletonText,
  SkeletonBadge,
  SkeletonButton 
} from '@/components/ui/Skeleton';
import { PageContainer, PageHeader } from '@/components/layout';

export const PredictionsSkeleton: React.FC = () => {
  return (
    <PageContainer showBreadcrumbs>
      <div className="animate-in slide-in-up">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <Skeleton height={36} width={200} className="mb-2" />
              <Skeleton height={20} width={300} />
            </div>
            <div className="flex gap-2">
              <SkeletonBadge width={60} />
              <SkeletonBadge width={80} />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton height={40} width={160} rounded="md" />
            <Skeleton height={40} width={120} rounded="md" />
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in scale-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center justify-between mb-2">
                <Skeleton height={16} width={120} />
                <Skeleton height={24} width={24} rounded="md" />
              </div>
              <Skeleton height={32} width={60} className="mb-1" />
              <Skeleton height={16} width={80} />
            </div>
          ))}
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-6 animate-in slide-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Skeleton height={40} width={150} rounded="md" />
              <Skeleton height={40} width={150} rounded="md" />
            </div>
            <Skeleton height={36} width={80} rounded="md" />
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="bg-white dark:bg-gray-900 rounded-lg animate-in scale-in" style={{ animationDelay: '250ms' }}>
          {/* Tab List */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-8 px-6 pt-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="pb-3 animate-in slide-in-right" style={{ animationDelay: `${300 + i * 30}ms` }}>
                  <Skeleton height={20} width={80} />
                </div>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <PredictionCardSkeleton key={i} delay={400 + i * 50} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export const PredictionCardSkeleton: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  return (
    <div 
      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 animate-in slide-in-up hover-scale"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <Skeleton height={18} width={200} className="mb-2" />
          <SkeletonText lines={2} className="max-w-lg" />
        </div>
        <SkeletonBadge width={80} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <Skeleton height={14} width={80} className="mb-1" />
            <Skeleton height={20} width={60} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Skeleton height={14} width={120} />
        <div className="flex gap-2">
          <SkeletonButton width={80} size="sm" />
          <SkeletonButton width={100} size="sm" />
        </div>
      </div>
    </div>
  );
};

export const PredictionDetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in slide-in-up">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Skeleton height={28} width={300} className="mb-2" />
            <SkeletonText lines={2} className="max-w-2xl" />
          </div>
          <div className="text-right">
            <SkeletonBadge width={100} className="mb-2" />
            <Skeleton height={32} width={80} />
          </div>
        </div>
      </div>

      {/* Key Factors */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-left" style={{ animationDelay: '100ms' }}>
        <Skeleton height={24} width={120} className="mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-in slide-in-right" style={{ animationDelay: `${150 + i * 30}ms` }}>
              <Skeleton height={20} width={20} rounded="full" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-left" style={{ animationDelay: '300ms' }}>
          <Skeleton height={24} width={150} className="mb-4" />
          <SkeletonText lines={8} />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-right" style={{ animationDelay: '350ms' }}>
          <Skeleton height={24} width={180} className="mb-4" />
          <SkeletonChart height={250} type="bar" />
        </div>
      </div>
    </div>
  );
};

export const EmptyPredictionsSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-12 text-center animate-in scale-in">
      <Skeleton height={48} width={48} rounded="full" className="mx-auto mb-4" />
      <Skeleton height={24} width={200} className="mx-auto mb-2" />
      <Skeleton height={16} width={300} className="mx-auto mb-6" />
      <Skeleton height={40} width={160} rounded="md" className="mx-auto" />
    </div>
  );
};