import React from 'react';
import { GridLayout } from '@/components/layout';
import { MetricCard } from '@/components/ui/ModernCard';
import { ModernSkeleton } from '@/components/ui/ModernSkeleton';
import { Activity, BarChart3, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { DashboardOverview, RealtimeStats } from '@/lib/api';

interface MetricsGridProps {
  loading: boolean;
  overview: DashboardOverview | null;
  stats: RealtimeStats | null;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ loading, overview, stats }) => {
  const formatSentiment = (sentiment: string) => {
    if (!sentiment) return 'Unknown';
    return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return <ArrowUpRight className="h-5 w-5 text-success" />;
      case 'bearish':
        return <ArrowDownRight className="h-5 w-5 text-destructive" />;
      default:
        return <Activity className="h-5 w-5 text-warning" />;
    }
  };

  const getSentimentChange = (score: number) => {
    if (score > 0.2) return { value: Math.abs(score * 100), type: 'increase' as const };
    if (score < -0.2) return { value: Math.abs(score * 100), type: 'decrease' as const };
    return { value: 0, type: 'increase' as const };
  };

  if (loading) {
    return (
      <GridLayout columns={4} gap="md">
        <ModernSkeleton className="h-32" />
        <ModernSkeleton className="h-32" />
        <ModernSkeleton className="h-32" />
        <ModernSkeleton className="h-32" />
      </GridLayout>
    );
  }

  if (!overview) {
    return (
      <GridLayout columns={4} gap="md">
        <div className="col-span-4 text-center text-muted-foreground">
          Failed to load dashboard data
        </div>
      </GridLayout>
    );
  }

  return (
    <GridLayout columns={4} gap="md">
      <MetricCard 
        title="Market Sentiment"
        value={formatSentiment(overview.marketSentiment)}
        change={getSentimentChange(overview.sentimentScore)}
        icon={getSentimentIcon(overview.marketSentiment)}
        description={`Confidence: ${(overview.confidenceScore * 100).toFixed(1)}%`}
      />
      <MetricCard 
        title="Active Feeds"
        value={overview.activeFeedSources?.toString() || '0'}
        change={{ value: 0, type: 'increase' }}
        icon={<Activity className="h-5 w-5 text-info" />}
        description={`${Object.values(overview?.feedTypes || {}).reduce((a, b) => a + b, 0)} total sources`}
      />
      <MetricCard 
        title="Recent Content"
        value={overview?.recentContentCount?.toString() || '0'}
        change={{ value: 0, type: 'increase' }}
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
        description="Last 24 hours"
      />
      <MetricCard 
        title="Queue Status"
        value={stats ? `${stats.queue.processing}` : '0'}
        change={{ value: stats?.queue.pending || 0, type: 'increase' }}
        icon={<Zap className="h-5 w-5 text-warning" />}
        description={`${stats?.queue.pending || 0} pending`}
      />
    </GridLayout>
  );
};