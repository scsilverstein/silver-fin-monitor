import React from 'react';
import { GridLayout } from '@/components/layout';
import { MetricCard } from '@/components/ui/ModernCard';
import { Activity, Clock, CheckCircle, XCircle } from 'lucide-react';
import { RealtimeStats, FeedSource } from '@/lib/api';

interface FeedStatsProps {
  feeds: FeedSource[];
  stats: RealtimeStats | null;
}

export const FeedStats: React.FC<FeedStatsProps> = ({ feeds, stats }) => {
  const activeFeeds = feeds.filter(f => f.is_active).length;

  return (
    <GridLayout columns={4} gap="md">
      <MetricCard
        title="Total Feeds"
        value={feeds.length.toString()}
        change={{ value: activeFeeds, type: 'increase' }}
        icon={<Activity className="h-5 w-5 text-primary" />}
        description={`${activeFeeds} active`}
      />
      <MetricCard
        title="Processing"
        value={stats?.queue.processing.toString() || '0'}
        change={{ value: stats?.queue.pending || 0, type: 'increase' }}
        icon={<Clock className="h-5 w-5 text-warning" />}
        description={`${stats?.queue.pending || 0} pending`}
      />
      <MetricCard
        title="Completed Today"
        value={stats?.queue.completed.toString() || '0'}
        change={{ value: 0, type: 'increase' }}
        icon={<CheckCircle className="h-5 w-5 text-success" />}
        description="Successfully processed"
      />
      <MetricCard
        title="Failed"
        value={stats?.queue.failed.toString() || '0'}
        change={{ 
          value: stats?.queue.failed || 0, 
          type: stats?.queue.failed ? 'decrease' : 'increase' 
        }}
        icon={<XCircle className="h-5 w-5 text-destructive" />}
        description="Requires attention"
      />
    </GridLayout>
  );
};