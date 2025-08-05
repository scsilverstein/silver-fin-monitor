// Dashboard overview component following CLAUDE.md specification
import React, { useEffect } from 'react';
import { useDashboardStore } from '../../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { formatDate, parseAnalysisDate } from '../../lib/utils';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  FileText,
  Cpu,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

export const DashboardOverview: React.FC = () => {
  const { overview, loading, error, fetchOverview } = useDashboardStore();

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (loading && !overview) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!overview) {
    return null;
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'bearish':
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getHealthBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      healthy: 'default',
      degraded: 'secondary',
      unhealthy: 'destructive'
    };
    
    const icons = {
      healthy: <CheckCircle className="h-3 w-3" />,
      degraded: <AlertCircle className="h-3 w-3" />,
      unhealthy: <AlertCircle className="h-3 w-3" />
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="flex items-center gap-1">
        {icons[status as keyof typeof icons]}
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalSources}</div>
            <p className="text-xs text-muted-foreground">
              {overview.activeSources} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Feeds</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.todayFeeds}</div>
            <p className="text-xs text-muted-foreground">
              {overview.processedToday} processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Sentiment</CardTitle>
            {overview.marketSentiment && getSentimentIcon(overview.marketSentiment.label)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {overview.marketSentiment?.label || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview.marketSentiment && overview.marketSentiment.confidence !== undefined
                ? `${(overview.marketSentiment.confidence * 100).toFixed(0)}% confidence`
                : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {overview.systemHealth && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Feed Processing</span>
                    {getHealthBadge(overview.systemHealth.feedProcessing)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">AI Analysis</span>
                    {getHealthBadge(overview.systemHealth.aiAnalysis)}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Analysis */}
      {overview.latestAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Analysis</CardTitle>
            <CardDescription>
              {formatDate(overview.latestAnalysis.analysis_date || overview.latestAnalysis.analysisDate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Key Themes</h4>
                <div className="flex flex-wrap gap-2">
                  {overview.latestAnalysis.key_themes.slice(0, 5).map((theme: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground">
                  {overview.latestAnalysis.overall_summary}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Predictions */}
      {overview.recentPredictions && overview.recentPredictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Predictions</CardTitle>
            <CardDescription>Latest forward-looking insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overview.recentPredictions.slice(0, 3).map((prediction: any) => (
                <div key={prediction.id} className="flex items-start space-x-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{prediction.prediction_text}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {prediction.time_horizon ? prediction.time_horizon.replace('_', ' ') : 'Unknown'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {(prediction.confidence_level * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Loading skeleton
const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
    
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </CardContent>
    </Card>
  </div>
);