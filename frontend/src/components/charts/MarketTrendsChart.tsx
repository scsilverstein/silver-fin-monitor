import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ComposedChart,
  Bar,
  BarChart,
  ScatterChart,
  Scatter,
  Cell
} from 'recharts';
import { ChartBase } from './ChartBase';
import { format, parseISO, subDays } from 'date-fns';
import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';

interface TrendData {
  date: string;
  topic: string;
  count: number;
  growth?: number;
  sentiment?: number;
  volume?: number;
}

interface TopicTrend {
  topic: string;
  data: Array<{
    date: string;
    count: number;
    growth: number;
  }>;
  totalMentions: number;
  averageGrowth: number;
  color?: string;
}

interface MarketTrendsChartProps {
  data: TrendData[];
  topicTrends?: TopicTrend[];
  title?: string;
  subtitle?: string;
  height?: number;
  chartType?: 'topics' | 'growth' | 'heatmap' | 'volume';
  timeframe?: '7d' | '30d' | '90d';
  showTop?: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const TREND_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green  
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#EC4899', // Pink
  '#6B7280'  // Gray
];

const GROWTH_COLORS = {
  high: '#10B981',    // Green (>20% growth)
  medium: '#F59E0B',  // Yellow (5-20% growth)
  low: '#6B7280',     // Gray (0-5% growth)
  negative: '#EF4444' // Red (negative growth)
};

export const MarketTrendsChart: React.FC<MarketTrendsChartProps> = ({
  data = [],
  topicTrends = [],
  title = "Market Trends & Topics",
  subtitle,
  height = 400,
  chartType = 'topics',
  timeframe = '7d',
  showTop = 5,
  loading = false,
  error = null,
  onRefresh
}) => {
  const processedData = useMemo(() => {
    if (chartType === 'topics' && topicTrends.length > 0) {
      // Get top trending topics
      const topTopics = topicTrends
        .sort((a, b) => b.totalMentions - a.totalMentions)
        .slice(0, showTop)
        .map((topic, index) => ({
          ...topic,
          color: TREND_COLORS[index % TREND_COLORS.length]
        }));

      // Create timeline data combining all topics
      const dates = [...new Set(data.map(d => d.date))].sort();
      return dates.map(date => {
        const dayData: any = { date };
        topTopics.forEach(topic => {
          const dayCount = topic.data.find(d => d.date === date)?.count || 0;
          dayData[topic.topic] = dayCount;
        });
        return dayData;
      });
    }

    if (chartType === 'growth') {
      // Calculate growth rates for topics
      const topicGrowth = topicTrends.map(topic => {
        const growth = topic.averageGrowth * 100;
        return {
          topic: topic.topic,
          growth,
          totalMentions: topic.totalMentions,
          color: growth > 20 ? GROWTH_COLORS.high :
                 growth > 5 ? GROWTH_COLORS.medium :
                 growth > 0 ? GROWTH_COLORS.low :
                 GROWTH_COLORS.negative
        };
      }).sort((a, b) => b.growth - a.growth);

      return topicGrowth.slice(0, showTop);
    }

    if (chartType === 'volume') {
      // Aggregate volume data by date
      const volumeByDate = data.reduce((acc, item) => {
        if (!acc[item.date]) {
          acc[item.date] = { date: item.date, totalVolume: 0, uniqueTopics: 0, avgSentiment: 0, sentimentSum: 0 };
        }
        acc[item.date].totalVolume += item.count;
        acc[item.date].uniqueTopics += 1;
        if (item.sentiment) {
          acc[item.date].sentimentSum += item.sentiment;
          acc[item.date].avgSentiment = acc[item.date].sentimentSum / acc[item.date].uniqueTopics;
        }
        return acc;
      }, {} as Record<string, any>);

      return Object.values(volumeByDate).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    }

    if (chartType === 'heatmap') {
      // Create heatmap data for topic activity
      const heatmapData = data.map(item => ({
        topic: item.topic,
        date: item.date,
        value: item.count,
        growth: item.growth || 0,
        sentiment: item.sentiment || 0
      }));
      
      return heatmapData;
    }

    return data;
  }, [data, topicTrends, chartType, showTop]);

  const trendStats = useMemo(() => {
    const totalTopics = new Set(data.map(d => d.topic)).size;
    const totalMentions = data.length > 0 ? data.reduce((sum, d) => sum + d.count, 0) / data.length : 0;
    const avgGrowth = topicTrends.length > 0 ? 
      topicTrends.reduce((sum, t) => sum + t.averageGrowth, 0) / topicTrends.length * 100 : 0;
    
    return { totalTopics, totalMentions, avgGrowth };
  }, [data, topicTrends]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    if (chartType === 'topics') {
      const date = parseISO(label);
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 min-w-[200px]">
          <p className="text-sm font-semibold text-foreground mb-3">
            {format(date, 'MMM dd, yyyy')}
          </p>
          
          <div className="space-y-2">
            {payload
              .filter((entry: any) => entry.value > 0)
              .sort((a: any, b: any) => b.value - a.value)
              .map((entry: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {entry.dataKey}
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {entry.value.toLocaleString()}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      );
    }

    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4">
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{entry.name}:</span>
              <span className="text-sm font-medium" style={{ color: entry.color }}>
                {typeof entry.value === 'number' && entry.name?.includes('%') ? 
                  `${entry.value.toFixed(1)}%` : 
                  entry.value?.toLocaleString()
                }
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    // Check if we have data to display
    if (!processedData || processedData.length === 0) {
      // Return a placeholder chart with no data
      return (
        <LineChart data={[]} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground">
            <tspan x="50%" dy="-0.5em" fontSize="14">No topic data available</tspan>
            <tspan x="50%" dy="1.5em" fontSize="12">Process some content to see trends</tspan>
          </text>
        </LineChart>
      );
    }

    if (chartType === 'topics') {
      const topTopics = topicTrends.slice(0, showTop);
      
      return (
        <LineChart
          data={processedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={{ value: 'Mention Rate (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {topTopics.map((topic, index) => (
            <Line
              key={topic.topic}
              type="monotone"
              dataKey={topic.topic}
              stroke={topic.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      );
    }

    if (chartType === 'growth') {
      return (
        <BarChart
          data={processedData}
          layout="horizontal"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            type="number" 
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 11 }}
            label={{ value: 'Growth Rate (%)', position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            type="category" 
            dataKey="topic" 
            tick={{ fontSize: 11 }}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={0} stroke="#6B7280" strokeDasharray="2 2" />
          
          <Bar dataKey="growth" name="Growth Rate" radius={[0, 4, 4, 0]}>
            {processedData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      );
    }

    if (chartType === 'volume') {
      return (
        <ComposedChart
          data={processedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
            tick={{ fontSize: 11 }}
          />
          <YAxis 
            yAxisId="volume"
            tick={{ fontSize: 11 }}
            label={{ value: 'Total Volume', angle: -90, position: 'insideLeft' }}
          />
          <YAxis 
            yAxisId="sentiment"
            orientation="right"
            domain={[-1, 1]}
            tick={{ fontSize: 11 }}
            label={{ value: 'Sentiment', angle: 90, position: 'insideRight' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <Area
            yAxisId="volume"
            type="monotone"
            dataKey="totalVolume"
            fill="#3B82F6"
            fillOpacity={0.3}
            stroke="#3B82F6"
            strokeWidth={2}
            name="Volume"
          />

          <Line
            yAxisId="sentiment"
            type="monotone"
            dataKey="avgSentiment"
            stroke="#10B981"
            strokeWidth={2}
            name="Avg Sentiment"
            dot={{ r: 3 }}
          />

          <Bar
            yAxisId="volume"
            dataKey="uniqueTopics"
            fill="#F59E0B"
            opacity={0.6}
            name="Unique Topics"
          />
        </ComposedChart>
      );
    }

    if (chartType === 'heatmap') {
      return (
        <ScatterChart
          data={processedData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }}
            tickFormatter={(date) => format(parseISO(date), 'MM/dd')}
          />
          <YAxis 
            dataKey="topic" 
            type="category"
            tick={{ fontSize: 10 }}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} />

          <Scatter dataKey="value" name="Mentions">
            {processedData.map((entry: any, index: number) => {
              const size = Math.max(entry.value / 10, 3);
              const opacity = Math.min(entry.value / 100, 1);
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.sentiment > 0 ? '#10B981' : entry.sentiment < 0 ? '#EF4444' : '#6B7280'}
                  fillOpacity={opacity}
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      );
    }

    return null;
  };

  const badges = [
    { text: `${trendStats.totalTopics} Topics`, variant: 'default' as const },
    { text: `${trendStats.totalMentions.toFixed(1)}% Avg Rate`, variant: 'secondary' as const },
    { text: `${trendStats.avgGrowth.toFixed(1)}% Avg Growth`, variant: 'outline' as const }
  ];

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `Trending topics analysis • ${timeframe} timeframe`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
      actions={
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
        </div>
      }
    >
      {renderChart()}
    </ChartBase>
  );
};