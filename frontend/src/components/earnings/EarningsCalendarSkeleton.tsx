import React from 'react';
import { 
  Skeleton, 
  SkeletonCard, 
  SkeletonText,
  SkeletonBadge 
} from '@/components/ui/Skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

export const EarningsCalendarSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in slide-in-up">
      {/* Header */}
      <Card className="animate-in scale-in">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Skeleton height={20} width={20} rounded="md" />
              <Skeleton height={24} width={160} />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton height={32} width={32} rounded="md" />
              <Skeleton height={24} width={140} />
              <Skeleton height={32} width={32} rounded="md" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Legend */}
      <Card className="animate-in scale-in" style={{ animationDelay: '50ms' }}>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-2 animate-in slide-in-right" style={{ animationDelay: `${100 + i * 20}ms` }}>
                <Skeleton height={16} width={16} rounded="md" />
                <Skeleton height={16} width={80} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card className="animate-in scale-in" style={{ animationDelay: '100ms' }}>
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
              <div key={day} className="p-3 text-center border-r border-gray-200 last:border-r-0 animate-in fade-in" style={{ animationDelay: `${150 + index * 20}ms` }}>
                <Skeleton height={16} width={30} className="mx-auto" />
              </div>
            ))}
          </div>
          
          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, index) => (
              <div 
                key={index} 
                className="min-h-[120px] border border-gray-200 p-2 animate-in scale-in"
                style={{ animationDelay: `${200 + index * 10}ms` }}
              >
                <div className="flex justify-between items-center mb-2">
                  <Skeleton height={16} width={20} />
                  {Math.random() > 0.7 && <SkeletonBadge width={20} />}
                </div>
                
                <div className="space-y-1">
                  {Math.random() > 0.5 && (
                    <>
                      <Skeleton height={20} className="w-full" rounded="sm" animation="pulse" />
                      {Math.random() > 0.5 && (
                        <Skeleton height={20} className="w-full" rounded="sm" animation="pulse" style={{ animationDelay: '100ms' }} />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-in slide-in-up" style={{ animationDelay: `${550 + i * 50}ms` }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Skeleton height={20} width={20} rounded="md" />
                <div className="flex-1">
                  <Skeleton height={14} width={100} className="mb-2" />
                  <Skeleton height={28} width={60} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const EarningsListSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div 
          key={index} 
          className="border rounded-lg p-4 animate-in slide-in-up hover-scale"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton height={40} width={40} rounded="md" />
              <div>
                <Skeleton height={18} width={60} className="mb-1" />
                <Skeleton height={14} width={120} />
              </div>
            </div>
            <div className="text-right">
              <Skeleton height={16} width={80} className="mb-1" />
              <div className="flex gap-2 justify-end">
                <SkeletonBadge width={60} />
                <SkeletonBadge width={50} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const EarningsDetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in slide-in-up">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Skeleton height={32} width={80} />
              <Skeleton height={32} width={150} />
            </div>
            <Skeleton height={20} width={200} />
          </div>
          <div className="text-right">
            <Skeleton height={16} width={100} className="mb-2" />
            <div className="flex gap-2 justify-end">
              <SkeletonBadge width={80} />
              <SkeletonBadge width={60} />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="bg-white dark:bg-gray-900 rounded-lg p-4 animate-in scale-in"
            style={{ animationDelay: `${100 + i * 50}ms` }}
          >
            <Skeleton height={14} width={80} className="mb-2" />
            <Skeleton height={24} width={100} className="mb-1" />
            <Skeleton height={14} width={60} />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-left" style={{ animationDelay: '300ms' }}>
          <Skeleton height={24} width={150} className="mb-4" />
          <SkeletonText lines={8} />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 animate-in slide-in-right" style={{ animationDelay: '350ms' }}>
          <Skeleton height={24} width={120} className="mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-in scale-in" style={{ animationDelay: `${400 + i * 30}ms` }}>
                <Skeleton height={40} className="w-full" rounded="md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};