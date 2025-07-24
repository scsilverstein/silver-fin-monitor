import React from 'react';
import { 
  Skeleton, 
  SkeletonCard, 
  SkeletonChart, 
  SkeletonText,
  SkeletonBadge 
} from '@/components/ui/Skeleton';
import { PageContainer, PageHeader } from '@/components/layout';

export const EntityAnalyticsSkeleton: React.FC = () => {
  return (
    <PageContainer showBreadcrumbs>
      <div className="animate-in slide-in-up">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <Skeleton height={36} width={250} className="mb-2" />
              <Skeleton height={20} width={350} />
            </div>
            <div className="flex gap-2">
              <SkeletonBadge width={100} />
              <SkeletonBadge width={80} />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton height={40} width={300} rounded="md" />
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
              <Skeleton height={32} width={80} className="mb-1" />
              <Skeleton height={16} width={60} />
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trending Entities */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-2 mb-4">
              <Skeleton height={24} width={24} rounded="md" />
              <Skeleton height={24} width={140} />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg animate-in slide-in-right" style={{ animationDelay: `${250 + i * 30}ms` }}>
                  <div className="flex items-center gap-3">
                    <Skeleton height={32} width={32} rounded="full" />
                    <div>
                      <Skeleton height={18} width={120} className="mb-1" />
                      <Skeleton height={14} width={80} />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton height={20} width={60} className="mb-1" />
                    <Skeleton height={14} width={80} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment Leaders */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-up" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center gap-2 mb-4">
              <Skeleton height={24} width={24} rounded="md" />
              <Skeleton height={24} width={160} />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg animate-in slide-in-right" style={{ animationDelay: `${300 + i * 30}ms` }}>
                  <div className="flex items-center gap-3">
                    <Skeleton height={24} width={24} rounded="md" />
                    <div>
                      <Skeleton height={18} width={120} className="mb-1" />
                      <Skeleton height={14} width={80} />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton height={20} width={50} className="mb-1" />
                    <Skeleton height={14} width={80} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export const EntityDetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in slide-in-up">
      {/* Entity Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton height={32} width={200} className="mb-2" />
            <div className="flex items-center gap-4">
              <SkeletonBadge width={80} />
              <Skeleton height={16} width={120} />
              <Skeleton height={16} width={100} />
            </div>
          </div>
          <div className="text-right">
            <Skeleton height={32} width={80} className="mb-1" />
            <Skeleton height={16} width={100} />
          </div>
        </div>
      </div>

      {/* Charts and Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-left" style={{ animationDelay: '100ms' }}>
            <Skeleton height={24} width={180} className="mb-4" />
            <SkeletonChart height={350} type="line" />
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-left" style={{ animationDelay: '150ms' }}>
            <Skeleton height={24} width={200} className="mb-4" />
            <SkeletonChart height={300} type="bar" />
          </div>
        </div>

        {/* Content Sources */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-right" style={{ animationDelay: '200ms' }}>
          <Skeleton height={24} width={150} className="mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg animate-in scale-in" style={{ animationDelay: `${250 + i * 40}ms` }}>
                <Skeleton height={16} width="80%" className="mb-2" />
                <Skeleton height={14} width="60%" className="mb-2" />
                <div className="flex items-center justify-between">
                  <SkeletonBadge />
                  <Skeleton height={14} width={80} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const EntityComparisonSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in slide-in-up">
      {/* Comparison Controls */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <Skeleton height={16} width={80} />
          {[1, 2, 3].map((i) => (
            <SkeletonBadge key={i} width={100} />
          ))}
          <Skeleton height={32} width={100} rounded="md" />
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in scale-in" style={{ animationDelay: '100ms' }}>
        <Skeleton height={24} width={250} className="mb-2" />
        <Skeleton height={16} width={300} className="mb-4" />
        <SkeletonChart height={400} type="bar" />
      </div>
    </div>
  );
};