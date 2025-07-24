import React from 'react';
import { 
  Skeleton, 
  SkeletonCard, 
  SkeletonChart, 
  SkeletonText,
  SkeletonBadge 
} from '@/components/ui/Skeleton';
import { PageContainer, PageHeader } from '@/components/layout';

export const DashboardSkeleton: React.FC = () => {
  return (
    <PageContainer showBreadcrumbs>
      <div className="animate-in slide-in-up">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <Skeleton height={36} width={300} className="mb-2" />
              <Skeleton height={20} width={200} />
            </div>
            <div className="flex gap-2">
              <SkeletonBadge width={80} />
              <SkeletonBadge width={120} />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton height={40} width={140} rounded="md" />
            <Skeleton height={40} width={160} rounded="md" />
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

        {/* Quick Actions Skeleton */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 mb-8 animate-in slide-in-left" style={{ animationDelay: '200ms' }}>
          <Skeleton height={24} width={140} className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-in scale-in" style={{ animationDelay: `${250 + i * 50}ms` }}>
                <Skeleton height={80} className="w-full" rounded="lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Market Intelligence - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Market Sentiment Chart */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-up" style={{ animationDelay: '300ms' }}>
              <div className="flex items-center justify-between mb-4">
                <Skeleton height={24} width={180} />
                <div className="flex gap-2">
                  <SkeletonBadge />
                  <SkeletonBadge />
                </div>
              </div>
              <SkeletonChart height={350} type="line" />
            </div>

            {/* Market Topics */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-up" style={{ animationDelay: '350ms' }}>
              <Skeleton height={24} width={150} className="mb-4" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between animate-in slide-in-right" style={{ animationDelay: `${400 + i * 30}ms` }}>
                    <div className="flex items-center gap-3">
                      <Skeleton height={40} width={40} rounded="md" />
                      <div>
                        <Skeleton height={18} width={120} className="mb-1" />
                        <Skeleton height={14} width={80} />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton height={20} width={60} className="mb-1" />
                      <Skeleton height={14} width={40} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* System Status */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-left" style={{ animationDelay: '400ms' }}>
              <Skeleton height={24} width={120} className="mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-in scale-in" style={{ animationDelay: `${450 + i * 40}ms` }}>
                    <div className="flex items-center justify-between mb-1">
                      <Skeleton height={16} width={100} />
                      <SkeletonBadge width={60} />
                    </div>
                    <Skeleton height={8} className="w-full" rounded="full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Predictions */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-left" style={{ animationDelay: '500ms' }}>
              <Skeleton height={24} width={160} className="mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg animate-in slide-in-up" style={{ animationDelay: `${550 + i * 40}ms` }}>
                    <Skeleton height={16} width="80%" className="mb-2" />
                    <div className="flex items-center justify-between">
                      <SkeletonBadge />
                      <Skeleton height={14} width={60} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Entity Analytics */}
        <div className="mt-8 animate-in slide-in-up" style={{ animationDelay: '600ms' }}>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
            <Skeleton height={28} width={200} className="mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkeletonChart height={300} />
              <SkeletonChart height={300} type="bar" />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

// Individual component skeletons for lazy loading
export const MarketIntelligenceSkeleton: React.FC = () => (
  <div className="space-y-6">
    <SkeletonCard lines={2} />
    <SkeletonChart height={350} />
  </div>
);

export const SystemStatusSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
    <Skeleton height={24} width={120} className="mb-4" />
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <Skeleton height={16} width={100} />
            <SkeletonBadge width={60} />
          </div>
          <Skeleton height={8} className="w-full" rounded="full" />
        </div>
      ))}
    </div>
  </div>
);

export const QuickActionsSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
    <Skeleton height={24} width={140} className="mb-4" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} height={80} className="w-full" rounded="lg" />
      ))}
    </div>
  </div>
);