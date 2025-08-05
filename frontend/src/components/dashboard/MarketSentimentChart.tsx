// Market sentiment chart component following CLAUDE.md specification
import React, { useEffect } from 'react';
import { useDashboardStore } from '../../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface MarketSentimentChartProps {
  days?: number;
  showVolume?: boolean;
  height?: number;
}

export const MarketSentimentChart: React.FC<MarketSentimentChartProps> = ({ 
  days = 30,
  showVolume = true,
  height = 400
}) => {
  const { trends, loading, error, fetchTrends } = useDashboardStore();

  useEffect(() => {
    fetchTrends(days);
  }, [fetchTrends, days]);

  if (loading && !trends) {
    return <ChartSkeleton height={height} />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!trends || !trends.sentimentHistory) {
    return null;
  }

  // Calculate sentiment trend
  const latestSentiment = trends.sentimentHistory[trends.sentimentHistory.length - 1]?.sentiment || 0;
  const previousSentiment = trends.sentimentHistory[trends.sentimentHistory.length - 2]?.sentiment || 0;
  const sentimentChange = latestSentiment - previousSentiment;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatSentiment = (value: number) => {
    if (value > 0.1) return 'Bullish';
    if (value < -0.1) return 'Bearish';
    return 'Neutral';
  };

  const getSentimentColor = (value: number) => {
    if (value > 0) return '#10b981'; // green
    if (value < 0) return '#ef4444'; // red
    return '#6b7280'; // gray
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Market Sentiment Trend</CardTitle>
            <CardDescription>
              {days}-day sentiment analysis with volume
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {sentimentChange > 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : sentimentChange < 0 ? (
              <TrendingDown className="h-5 w-5 text-red-500" />
            ) : null}
            <span className={`text-sm font-medium ${
              sentimentChange > 0 ? 'text-green-500' : 
              sentimentChange < 0 ? 'text-red-500' : 
              'text-gray-500'
            }`}>
              {sentimentChange > 0 ? '+' : ''}{(sentimentChange * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={trends.sentimentHistory}>
            <defs>
              <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              className="text-xs"
            />
            <YAxis 
              yAxisId="sentiment"
              domain={[-1, 1]}
              ticks={[-1, -0.5, 0, 0.5, 1]}
              tickFormatter={(value) => value.toFixed(1)}
              className="text-xs"
            />
            {showVolume && (
              <YAxis 
                yAxisId="volume"
                orientation="right"
                className="text-xs"
              />
            )}
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
              labelFormatter={(label) => `Date: ${formatDate(label)}`}
              formatter={(value: any, name: string) => {
                if (name === 'sentiment') {
                  return [`${(value * 100).toFixed(1)}%`, 'Sentiment'];
                }
                return [value, 'Volume'];
              }}
            />
            <Legend />
            <ReferenceLine 
              yAxisId="sentiment" 
              y={0} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3"
            />
            <Area
              yAxisId="sentiment"
              type="monotone"
              dataKey="sentiment"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#colorSentiment)"
              strokeWidth={2}
              name="Sentiment"
            />
            {showVolume && (
              <Area
                yAxisId="volume"
                type="monotone"
                dataKey="volume"
                stroke="#8b5cf6"
                fillOpacity={0.3}
                fill="url(#colorVolume)"
                strokeWidth={1}
                name="Volume"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Sentiment Summary */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Current</p>
            <p className={`text-lg font-medium ${getSentimentColor(latestSentiment)}`}>
              {formatSentiment(latestSentiment)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Average</p>
            <p className="text-lg font-medium">
              {(trends.sentimentHistory.reduce((sum, item) => sum + item.sentiment, 0) / 
                trends.sentimentHistory.length * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Volatility</p>
            <p className="text-lg font-medium">
              {calculateVolatility(trends.sentimentHistory).toFixed(2)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Calculate sentiment volatility
const calculateVolatility = (data: Array<{ sentiment: number }>) => {
  if (data.length < 2) return 0;
  
  const values = data.map(d => d.sentiment);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  return Math.sqrt(variance);
};

// Loading skeleton
const ChartSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-64" />
    </CardHeader>
    <CardContent>
      <Skeleton className="w-full" style={{ height }} />
    </CardContent>
  </Card>
);