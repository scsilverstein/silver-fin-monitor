import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import {
  MarketSentiment,
  StatsCard,
  SentimentChart,
  RecentPredictions
} from '@/components/dashboard';
import { Rss, Brain, TrendingUp, Activity } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: dashboardApi.overview,
    refetchInterval: 60000 // Refresh every minute
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: dashboardApi.trends
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Market intelligence and predictions overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Feeds"
          value={overview?.totalFeeds || 0}
          icon={Rss}
          description="Monitored sources"
          loading={overviewLoading}
        />
        <StatsCard
          title="Active Feeds"
          value={overview?.activeFeeds || 0}
          icon={Activity}
          description="Currently processing"
          trend={{ value: 12, isPositive: true }}
          loading={overviewLoading}
        />
        <StatsCard
          title="Today's Analysis"
          value={overview?.todayAnalysis ? 'Complete' : 'Pending'}
          icon={TrendingUp}
          description="Daily market analysis"
          loading={overviewLoading}
        />
        <StatsCard
          title="Active Predictions"
          value={overview?.recentPredictions.length || 0}
          icon={Brain}
          description="Monitoring outcomes"
          loading={overviewLoading}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-full lg:col-span-2">
          <MarketSentiment
            sentiment={overview?.todayAnalysis?.marketSentiment}
            confidence={overview?.todayAnalysis?.confidenceScore}
            loading={overviewLoading}
          />
        </div>
        <div className="col-span-full lg:col-span-5">
          <SentimentChart
            data={trends?.sentimentHistory || []}
            loading={trendsLoading}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <RecentPredictions
          overview={overview}
          loading={overviewLoading}
        />
        <div className="space-y-4">
          {overview?.todayAnalysis && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-2">Today's Key Themes</h3>
              <div className="flex flex-wrap gap-2">
                {overview.todayAnalysis.keyThemes.map((theme, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                  >
                    {theme}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {overview.todayAnalysis.overallSummary}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};