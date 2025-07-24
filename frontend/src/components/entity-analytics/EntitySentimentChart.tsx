// Entity Sentiment Chart - Shows sentiment distribution and trends
import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { SentimentChartData } from '../../types/entityAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { entityAnalyticsService } from '../../services/entityAnalytics';

interface EntitySentimentChartProps {
  data: SentimentChartData[];
  entityName: string;
  chartType?: 'pie' | 'bar' | 'trend';
  height?: number;
}

export const EntitySentimentChart: React.FC<EntitySentimentChartProps> = ({
  data,
  entityName,
  chartType = 'pie',
  height = 300
}) => {
  const sentimentColors = {
    positive: '#10b981',
    neutral: '#6b7280',
    negative: '#ef4444'
  };

  // Aggregate sentiment data for pie chart
  const aggregatedData = useMemo(() => {
    const totals = data.reduce(
      (acc, item) => ({
        positive: acc.positive + item.positive,
        neutral: acc.neutral + item.neutral,
        negative: acc.negative + item.negative,
        total: acc.total + item.total
      }),
      { positive: 0, neutral: 0, negative: 0, total: 0 }
    );

    return [
      { 
        name: 'Positive', 
        value: totals.positive,
        percentage: totals.total > 0 ? Math.round((totals.positive / totals.total) * 100) : 0,
        color: sentimentColors.positive
      },
      { 
        name: 'Neutral', 
        value: totals.neutral,
        percentage: totals.total > 0 ? Math.round((totals.neutral / totals.total) * 100) : 0,
        color: sentimentColors.neutral
      },
      { 
        name: 'Negative', 
        value: totals.negative,
        percentage: totals.total > 0 ? Math.round((totals.negative / totals.total) * 100) : 0,
        color: sentimentColors.negative
      }
    ].filter(item => item.value > 0);
  }, [data]);

  // Format data for trend chart
  const trendData = useMemo(() => {
    return data.map(item => ({
      ...item,
      formattedDate: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      positivePercent: item.total > 0 ? Math.round((item.positive / item.total) * 100) : 0,
      negativePercent: item.total > 0 ? Math.round((item.negative / item.total) * 100) : 0,
      neutralPercent: item.total > 0 ? Math.round((item.neutral / item.total) * 100) : 0
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white border rounded-lg shadow-lg p-3">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-sm">
              {entry.name}: {entry.value}
              {chartType === 'trend' && entry.name.includes('Percent') && '%'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    
    const data = payload[0]?.payload;
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3">
        <p className="font-medium text-gray-900 mb-2">{data.name}</p>
        <p className="text-sm">Count: {data.value}</p>
        <p className="text-sm">Percentage: {data.percentage}%</p>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-500">No sentiment data available</p>
            <p className="text-sm text-gray-400 mt-1">Check back later as more content is analyzed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{entityName} - Sentiment Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        {chartType === 'pie' && (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={aggregatedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {aggregatedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}

        {chartType === 'bar' && (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={aggregatedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#8884d8">
                {aggregatedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartType === 'trend' && (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="formattedDate" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey="positivePercent" 
                stackId="a" 
                fill={sentimentColors.positive}
                name="Positive %"
              />
              <Bar 
                dataKey="neutralPercent" 
                stackId="a" 
                fill={sentimentColors.neutral}
                name="Neutral %"
              />
              <Bar 
                dataKey="negativePercent" 
                stackId="a" 
                fill={sentimentColors.negative}
                name="Negative %"
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          {aggregatedData.map((item) => (
            <div key={item.name} className="p-2 rounded-lg bg-gray-50">
              <div 
                className="w-4 h-4 rounded-full mx-auto mb-1"
                style={{ backgroundColor: item.color }}
              ></div>
              <p className="text-xs font-medium text-gray-600">{item.name}</p>
              <p className="text-sm font-bold">{item.percentage}%</p>
              <p className="text-xs text-gray-500">{item.value} mentions</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};