import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  EnhancedSentimentChart,
  PredictionAccuracyChart,
  MarketTrendsChart,
  EntityAnalyticsCharts
} from '@/components/charts';
import { 
  Brain,
  TrendingUp, 
  Target, 
  Users, 
  BarChart3,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { predictionsApi, analysisApi, contentApi, fetchApi } from '@/lib/api';

interface InsightsData {
  predictions: any[];
  accuracyByType: any[];
  accuracyByHorizon: any[];
  sentimentTrends: any[];
  topicTrends: any[];
  entityData: any[];
  feedSourceStats: any[];
  summary: {
    totalPredictions: number;
    overallAccuracy: number;
    topPerformer: any;
    totalEntities: number;
    contentVolume: number;
    timeframe: string;
  };
}

export const EnhancedInsights: React.FC = () => {
  const [data, setData] = useState<InsightsData>({
    predictions: [],
    accuracyByType: [],
    accuracyByHorizon: [],
    sentimentTrends: [],
    topicTrends: [],
    entityData: [],
    feedSourceStats: [],
    summary: {
      totalPredictions: 0,
      overallAccuracy: 0,
      topPerformer: null,
      totalEntities: 0,
      contentVolume: 0,
      timeframe: '30d'
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [activeTab, setActiveTab] = useState('predictions');

  useEffect(() => {
    loadInsightsData();
  }, [selectedTimeframe]);

  const loadInsightsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call the new insights dashboard API
      const response = await fetchApi(`/insights/dashboard?timeframe=${selectedTimeframe}`);
      
      if (response.error) {
        throw new Error(response.error);
      }

      setData(response.data || response);

    } catch (err) {
      console.error('Error loading insights data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights data');
      
      // Fallback to empty data structure on error
      setData({
        predictions: [],
        accuracyByType: [],
        accuracyByHorizon: [],
        sentimentTrends: [],
        topicTrends: [],
        entityData: [],
        feedSourceStats: [],
        summary: {
          totalPredictions: 0,
          overallAccuracy: 0,
          topPerformer: null,
          totalEntities: 0,
          contentVolume: 0,
          timeframe: selectedTimeframe
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const timeframeOptions = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' }
  ];

  const insightStats = {
    totalPredictions: data.summary?.totalPredictions || data.predictions.length,
    overallAccuracy: data.summary?.overallAccuracy || 
      (data.accuracyByType.length > 0 ? 
        data.accuracyByType.reduce((sum, item) => sum + item.accuracy, 0) / data.accuracyByType.length : 0),
    topPerformer: data.summary?.topPerformer || 
      (data.accuracyByType.length > 0 ? 
        data.accuracyByType.reduce((max, item) => item.accuracy > (max?.accuracy || 0) ? item : max) : null),
    totalEntities: data.summary?.totalEntities || data.entityData.length
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Brain className="w-8 h-8 text-primary" />
              Enhanced Market Insights
            </h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive analysis with prediction accuracy and trend visualization
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Timeframe Selector */}
            <div className="flex items-center gap-2">
              {timeframeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={selectedTimeframe === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTimeframe(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            
            <Button onClick={loadInsightsData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Predictions</p>
                  <p className="text-2xl font-bold">{insightStats.totalPredictions}</p>
                </div>
                <Target className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overall Accuracy</p>
                  <p className="text-2xl font-bold">
                    {(insightStats.overallAccuracy * 100).toFixed(1)}%
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Top Performer</p>
                  <p className="text-lg font-bold">
                    {insightStats.topPerformer?.category || 'N/A'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {insightStats.topPerformer ? 
                      `${(insightStats.topPerformer.accuracy * 100).toFixed(1)}%` : 
                      'No data'
                    }
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entities Tracked</p>
                  <p className="text-2xl font-bold">{insightStats.totalEntities}</p>
                </div>
                <Users className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="predictions">
              <Target className="w-4 h-4 mr-2" />
              Predictions
            </TabsTrigger>
            <TabsTrigger value="sentiment">
              <TrendingUp className="w-4 h-4 mr-2" />
              Sentiment
            </TabsTrigger>
            <TabsTrigger value="trends">
              <BarChart3 className="w-4 h-4 mr-2" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="entities">
              <Users className="w-4 h-4 mr-2" />
              Entities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="predictions" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PredictionAccuracyChart
                data={data.predictions}
                accuracyByType={data.accuracyByType}
                title="Accuracy by Prediction Type"
                subtitle="Performance breakdown across different prediction categories"
                height={400}
                chartType="accuracy"
                loading={loading}
                error={error}
                onRefresh={loadInsightsData}
              />

              <PredictionAccuracyChart
                data={data.predictions}
                accuracyByHorizon={data.accuracyByHorizon}
                title="Accuracy by Time Horizon"
                subtitle="How prediction accuracy varies with time horizon"
                height={400}
                chartType="comparison"
                loading={loading}
                error={error}
                onRefresh={loadInsightsData}
              />
            </div>

            <PredictionAccuracyChart
              data={data.predictions}
              title="Prediction Calibration Analysis"
              subtitle="Confidence vs actual accuracy calibration"
              height={350}
              chartType="calibration"
              loading={loading}
              error={error}
              onRefresh={loadInsightsData}
            />
          </TabsContent>

          <TabsContent value="sentiment" className="space-y-6">
            <EnhancedSentimentChart
              data={data.sentimentTrends}
              title="Market Sentiment Evolution"
              subtitle="Comprehensive sentiment analysis with volume and confidence"
              height={400}
              chartType="composed"
              showVolume={true}
              showVolatility={false}
              loading={loading}
              error={error}
              onRefresh={loadInsightsData}
            />

            <EnhancedSentimentChart
              data={data.sentimentTrends}
              title="Sentiment Distribution"
              subtitle="Area chart showing sentiment trends over time"
              height={300}
              chartType="area"
              loading={loading}
              error={error}
              onRefresh={loadInsightsData}
            />
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <MarketTrendsChart
              data={[]}
              topicTrends={data.topicTrends}
              title="Topic Growth Analysis"
              subtitle="Growth rates and momentum for key market topics"
              height={400}
              chartType="growth"
              timeframe={selectedTimeframe}
              showTop={8}
              loading={loading}
              error={error}
              onRefresh={loadInsightsData}
            />

            <MarketTrendsChart
              data={[]}
              topicTrends={data.topicTrends}
              title="Volume & Sentiment Trends"
              subtitle="Combined volume and sentiment analysis"
              height={350}
              chartType="volume"
              timeframe={selectedTimeframe}
              loading={loading}
              error={error}
              onRefresh={loadInsightsData}
            />
          </TabsContent>

          <TabsContent value="entities" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EntityAnalyticsCharts
                entities={data.entityData}
                title="Entity Sentiment Analysis"
                subtitle="Sentiment scores across tracked entities"
                height={400}
                chartType="sentiment"
                entityTypes={['company', 'person', 'topic']}
                loading={loading}
                error={error}
                onRefresh={loadInsightsData}
              />

              <EntityAnalyticsCharts
                entities={data.entityData}
                title="Entity Type Distribution"
                subtitle="Distribution and sentiment by entity type"
                height={400}
                chartType="distribution"
                entityTypes={['company', 'person', 'topic']}
                loading={loading}
                error={error}
                onRefresh={loadInsightsData}
              />
            </div>

            <EntityAnalyticsCharts
              entities={data.entityData}
              title="Entity Mention vs Sentiment"
              subtitle="Scatter plot showing relationship between mentions and sentiment"
              height={350}
              chartType="comparison"
              entityTypes={['company', 'person', 'topic']}
              loading={loading}
              error={error}
              onRefresh={loadInsightsData}
            />
          </TabsContent>
        </Tabs>
      </div>
  );
};