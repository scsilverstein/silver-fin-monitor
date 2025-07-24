import React from 'react';
import { 
  PageContainer, 
  PageHeader, 
  StatsGrid, 
  LoadingState, 
  createStatItems,
  createPageActions 
} from '@/components/layout';
import { 
  ModernCard, 
  CardContent, 
  CardHeader, 
  CardTitle
} from '@/components/ui/ModernCard';
import { ModernBadge, BadgeGroup } from '@/components/ui/ModernBadge';
import { EnhancedSentimentChart, SystemPerformanceChart, MarketTrendsChart } from '@/components/charts';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { DashboardQuickActions } from '@/components/dashboard/DashboardQuickActions';
import { SystemStatus } from '@/components/dashboard/SystemStatus';
import { EnhancedMarketIntelligence } from '@/components/dashboard/EnhancedMarketIntelligence';
import { MarketIntelligence } from '@/components/dashboard/MarketIntelligence';
import { TopicTrends } from '@/components/dashboard/TopicTrends';
import { RecentPredictions } from '@/components/dashboard/RecentPredictions';
import { EntityAnalyticsDemo } from '@/components/entity-analytics/EntityAnalyticsDemo';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardActions } from '@/hooks/useDashboardActions';
import { useTimeframeThemes } from '@/hooks/useTimeframeThemes';
import { TrendingUp, RefreshCw, BarChart3, Activity } from 'lucide-react';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';

export const ModernDashboard: React.FC = () => {
  const { 
    overview, 
    trends, 
    stats, 
    accuracy,
    loading, 
    refreshing, 
    refreshData 
  } = useDashboardData();

  const {
    generatingAnalysis,
    generatingPredictions,
    handleGenerateAnalysis,
    handleGeneratePredictions,
    debugPredictions
  } = useDashboardActions(refreshData);

  const {
    themes: timeframeThemes,
    loading: themesLoading,
    refreshThemes
  } = useTimeframeThemes();

  // Create stats for the dashboard
  const dashboardStats = [
    createStatItems.count('total_feeds', 'Active Feeds', overview?.activeFeedSources || 0, {
      icon: <BarChart3 className="h-4 w-4" />,
      status: 'success'
    }),
    createStatItems.count('processed_today', 'Processed Today', overview?.recentContentCount || 0, {
      icon: <Activity className="h-4 w-4" />,
      status: 'info'
    }),
    createStatItems.count('predictions', 'Active Predictions', overview?.activePredictions?.length || 0, {
      icon: <TrendingUp className="h-4 w-4" />,
      status: 'default'
    }),
    createStatItems.percentage('accuracy', 'Prediction Accuracy', 
      accuracy?.overall ? Math.round(accuracy.overall * 100) : 0
    )
  ];

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <PageContainer showBreadcrumbs>
      <div className="animate-in slide-in-up">
        <PageHeader
        title="Market Intelligence Dashboard"
        subtitle="Real-time market analysis and predictions"
        badges={[
          { label: 'Live', variant: 'info', dot: true },
          { label: `${stats?.feeds?.active || 0} Active Feeds`, variant: 'outline' }
        ]}
        onRefresh={refreshData}
        refreshing={refreshing}
        primaryActions={[
          {
            label: 'Generate Analysis',
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: handleGenerateAnalysis,
            loading: generatingAnalysis
          },
          {
            label: 'Generate Predictions',
            icon: <TrendingUp className="h-4 w-4" />,
            onClick: handleGeneratePredictions,
            loading: generatingPredictions
          }
        ]}
        secondaryActions={[
          createPageActions.refresh(() => {
            refreshData();
            refreshThemes();
          }, refreshing)
        ]}
      />

      <div className="animate-in slide-in-up" style={{ animationDelay: '100ms' }}>
        <StatsGrid stats={dashboardStats} columns={4} loading={loading} />
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ModernCard variant="glass" className="animate-in slide-in-up hover-lift" style={{ animationDelay: '200ms' }}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Market Sentiment Analysis</CardTitle>
                  <BadgeGroup>
                    <ModernBadge variant="info" dot>Live</ModernBadge>
                    <ModernBadge variant="outline">7D</ModernBadge>
                  </BadgeGroup>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <EnhancedSentimentChart 
                    data={trends?.sentimentTrend?.map((item: any) => {
                      // Use sentimentScore if available, otherwise fall back to sentiment
                      const score = item.sentimentScore !== undefined ? item.sentimentScore : item.sentiment;
                      
                      return {
                        date: item.date,
                        sentiment: item.sentiment, // Keep categorical for backward compatibility
                        sentimentScore: score, // Pass the actual numeric score
                        confidence: item.confidence !== undefined ? item.confidence : Math.abs(score),
                        volume: item.volume
                      };
                    }) || []}
                    title=""
                    subtitle="Real-time market sentiment with confidence intervals"
                    height={300}
                    chartType="composed"
                    showVolume={true}
                    loading={loading}
                    onRefresh={refreshData}
                  />
                </div>
              </CardContent>
            </ModernCard>

            <MarketTrendsChart
              data={trends?.topicTrends?.flatMap((item: any) => 
                item.topics?.map((topic: any) => ({
                  date: item.date,
                  topic: topic.topic,
                  count: topic.count,
                  growth: Math.random() * 0.4 - 0.2,  // Mock growth data
                  sentiment: Math.random() * 2 - 1    // Mock sentiment data
                })) || []
              ) || []}
              topicTrends={(() => {
                // Process topicTrends data to create the expected format
                const topicMap = new Map<string, any>();
                
                trends?.topicTrends?.forEach((item: any) => {
                  item.topics?.forEach((topic: any) => {
                    if (!topicMap.has(topic.topic)) {
                      topicMap.set(topic.topic, {
                        topic: topic.topic,
                        data: [],
                        totalMentions: 0,
                        averageGrowth: 0
                      });
                    }
                    
                    const topicData = topicMap.get(topic.topic);
                    topicData.data.push({
                      date: item.date,
                      count: topic.count,
                      growth: 0.1 // Default growth rate
                    });
                    topicData.totalMentions += topic.count;
                  });
                });
                
                // Calculate average growth for each topic
                return Array.from(topicMap.values()).map(topic => ({
                  ...topic,
                  averageGrowth: topic.data.length > 1 ? 
                    topic.data.reduce((sum: number, d: any, idx: number) => {
                      if (idx === 0) return sum;
                      const prevCount = topic.data[idx - 1].count;
                      const growth = prevCount > 0 ? (d.count - prevCount) / prevCount : 0;
                      return sum + growth;
                    }, 0) / (topic.data.length - 1) : 0
                }));
              })()}
              title="Market Topics & Trends"
              subtitle="Trending topics with normalized mention rates (%)"
              height={350}
              chartType="topics"
              timeframe="7d"
              showTop={5}
              loading={loading}
              onRefresh={refreshData}
            />
            <EnhancedMarketIntelligence 
              overview={overview}
              weekThemes={timeframeThemes.week}
              monthThemes={timeframeThemes.month}
              yearThemes={timeframeThemes.year}
              marketDrivers={timeframeThemes.marketDrivers}
              riskFactors={timeframeThemes.riskFactors}
              loading={loading || themesLoading}
              onRefresh={() => {
                refreshData();
                refreshThemes();
              }}
            />
          </div>

          <div className="space-y-6">
            <RecentPredictions 
              overview={overview} 
              loading={loading} 
            />
            
            <SystemPerformanceChart
              data={[]} // Mock data - would be populated with real system metrics
              currentStats={stats ? {
                timestamp: new Date().toISOString(),
                queue: {
                  pending: stats.queue.pending,
                  processing: stats.queue.processing, 
                  completed: stats.queue.completed,
                  failed: stats.queue.failed,
                  retry: 0
                },
                processing: {
                  feedsPerHour: 15,
                  avgProcessingTime: 2500,
                  successRate: 0.94
                },
                transcription: {
                  pending: stats.transcription.pending,
                  processing: stats.transcription.processing,
                  completed: stats.transcription.completed,
                  failed: stats.transcription.failed,
                  avgTime: 3000
                }
              } : undefined}
              title="System Performance"
              subtitle="Real-time system health monitoring"
              height={300}
              chartType="status"
              timeRange="1h"
              loading={loading}
              onRefresh={refreshData}
            />
            
            <EntityAnalyticsDemo />
            
            <DashboardQuickActions
              generatingAnalysis={generatingAnalysis}
              generatingPredictions={generatingPredictions}
              onGenerateAnalysis={handleGenerateAnalysis}
              onGeneratePredictions={handleGeneratePredictions}
              onDebugPredictions={debugPredictions}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
};