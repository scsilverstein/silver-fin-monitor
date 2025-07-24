// Entity Trend Chart - Shows mentions and sentiment over time
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { TrendChartData, EntityAnalytics } from '../../types/entityAnalytics';
import { entityAnalyticsService } from '../../services/entityAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface EntityTrendChartProps {
  data: TrendChartData[];
  entityName: string;
  timeRange?: string;
  showMentions?: boolean;
  showSentiment?: boolean;
  showTrendScore?: boolean;
  height?: number;
}

export const EntityTrendChart: React.FC<EntityTrendChartProps> = ({
  data,
  entityName,
  timeRange = 'Last 30 days',
  showMentions = true,
  showSentiment = true,
  showTrendScore = false,
  height = 400
}) => {
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      formattedDate: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      sentimentPercent: Math.round(item.sentiment * 100)
    }));
  }, [data]);

  const sentimentColor = useMemo(() => {
    const avgSentiment = data.reduce((sum, item) => sum + item.sentiment, 0) / data.length;
    return entityAnalyticsService.getEntityColor(avgSentiment);
  }, [data]);

  const maxMentions = useMemo(() => {
    return Math.max(...data.map(item => item.mentions));
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    const sentimentFormatted = entityAnalyticsService.formatSentiment(data.sentiment);

    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 max-w-xs">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        
        {showMentions && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm">Mentions: {data.mentions}</span>
          </div>
        )}
        
        {showSentiment && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sentimentColor }}></div>
            <span className="text-sm">
              Sentiment: {sentimentFormatted.icon} {sentimentFormatted.text} ({data.sentimentPercent}%)
            </span>
          </div>
        )}
        
        {showTrendScore && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-sm">Trend Score: {data.trendScore}</span>
          </div>
        )}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-500">No trending data available for {entityName}</p>
            <p className="text-sm text-gray-400 mt-1">Check back later as more content is processed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{entityName} - Trends</span>
          <span className="text-sm font-normal text-gray-500">{timeRange}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="formattedDate" 
              tick={{ fontSize: 12 }}
              stroke="#666"
            />
            <YAxis 
              yAxisId="mentions"
              orientation="left"
              tick={{ fontSize: 12 }}
              stroke="#666"
              label={{ value: 'Mentions', angle: -90, position: 'insideLeft' }}
            />
            {showSentiment && (
              <YAxis 
                yAxisId="sentiment"
                orientation="right"
                domain={[-100, 100]}
                tick={{ fontSize: 12 }}
                stroke="#666"
                label={{ value: 'Sentiment %', angle: 90, position: 'insideRight' }}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {showMentions && (
              <Area
                yAxisId="mentions"
                type="monotone"
                dataKey="mentions"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.1}
                strokeWidth={2}
                name="Mentions"
              />
            )}
            
            {showSentiment && (
              <Line
                yAxisId="sentiment"
                type="monotone"
                dataKey="sentimentPercent"
                stroke={sentimentColor}
                strokeWidth={2}
                dot={{ fill: sentimentColor, strokeWidth: 2, r: 4 }}
                name="Sentiment %"
              />
            )}
            
            {showTrendScore && (
              <Line
                yAxisId="mentions"
                type="monotone"
                dataKey="trendScore"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
                name="Trend Score"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};