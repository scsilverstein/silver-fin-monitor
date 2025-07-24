import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle, Card } from '@/components/ui';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import { format } from 'date-fns';

interface SentimentData {
  date: string;
  sentiment: string;
  confidence: number;
  sentimentScore?: number; // Actual sentiment value (-1 to 1)
}

interface SentimentChartProps {
  data: SentimentData[];
  loading?: boolean;
}

export const SentimentChart: React.FC<SentimentChartProps> = ({ data, loading }) => {
  // Transform data for the chart
  const chartData = data?.map(item => ({
    date: item.date,
    // Use actual sentiment score if available, otherwise fall back to categorical conversion
    value: item.sentimentScore !== undefined 
      ? item.sentimentScore 
      : (item.sentiment === 'bullish' ? 1 : item.sentiment === 'bearish' ? -1 : 0),
    confidence: item.confidence * 100,
    sentiment: item.sentiment,
    sentimentScore: item.sentimentScore
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium">{format(new Date(label), 'MMM dd, yyyy')}</p>
          <p className="text-sm">
            Sentiment: <span className="font-medium">
              {data.sentimentScore !== undefined 
                ? `${(data.sentimentScore * 100).toFixed(1)}% ${data.sentimentScore > 0 ? 'Bullish' : data.sentimentScore < 0 ? 'Bearish' : 'Neutral'}`
                : data.sentiment
              }
            </span>
          </p>
          <p className="text-sm">
            Confidence: <span className="font-medium">{data.confidence.toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <ModernCard>
        <CardHeader>
          <CardTitle>Sentiment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 animate-pulse bg-muted rounded" />
        </CardContent>
      </ModernCard>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                className="text-xs"
              />
              <YAxis
                domain={[-1, 1]}
                ticks={[-1, -0.5, 0, 0.5, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                className="text-xs"
                orientation="left"
                scale="auto"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Reference line at 0% (neutral sentiment) */}
              <ReferenceLine 
                y={0} 
                stroke="#6B7280" 
                strokeDasharray="2 2" 
                strokeWidth={1}
                label={{ value: "Neutral", position: "insideTopLeft", fontSize: 12, fill: "#6B7280" }}
              />
              
              {/* Reference lines for strong sentiment zones */}
              <ReferenceLine 
                y={0.5} 
                stroke="#10B981" 
                strokeDasharray="1 1" 
                strokeWidth={1}
                opacity={0.4}
                label={{ value: "+50% Bullish", position: "insideTopLeft", fontSize: 10, fill: "#10B981" }}
              />
              <ReferenceLine 
                y={-0.5} 
                stroke="#EF4444" 
                strokeDasharray="1 1" 
                strokeWidth={1}
                opacity={0.4}
                label={{ value: "-50% Bearish", position: "insideTopLeft", fontSize: 10, fill: "#EF4444" }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0ea5e9"
                strokeWidth={2}
                name="Sentiment"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="confidence"
                stroke="#10b981"
                strokeWidth={2}
                name="Confidence %"
                yAxisId="right"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                className="text-xs"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};