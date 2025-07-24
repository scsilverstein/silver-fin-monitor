import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
};