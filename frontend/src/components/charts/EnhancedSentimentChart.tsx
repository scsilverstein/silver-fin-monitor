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
  Cell,
  BarChart,
  Bar,
  ComposedChart
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ChartBase } from './ChartBase';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentData {
  date: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  volume?: number;
  volatility?: number;
  sentimentScore?: number; // Actual sentiment value (-1 to 1)
}

interface EnhancedSentimentChartProps {
  data: SentimentData[];
  title?: string;
  subtitle?: string;
  height?: number;
  showVolume?: boolean;
  showVolatility?: boolean;
  chartType?: 'line' | 'area' | 'composed';
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

// Enhanced color palette for sentiment
const SENTIMENT_COLORS = {
  bullish: {
    primary: '#10B981', // Green
    light: '#D1FAE5',
    gradient: ['#10B981', '#059669']
  },
  bearish: {
    primary: '#EF4444', // Red
    light: '#FEE2E2',
    gradient: ['#EF4444', '#DC2626']
  },
  neutral: {
    primary: '#6B7280', // Gray
    light: '#F3F4F6',
    gradient: ['#6B7280', '#4B5563']
  }
};

export const EnhancedSentimentChart: React.FC<EnhancedSentimentChartProps> = ({
  data = [],
  title = "Market Sentiment Analysis",
  subtitle,
  height = 400,
  showVolume = true,
  showVolatility = false,
  chartType = 'composed',
  loading = false,
  error = null,
  onRefresh
}) => {
  const processedData = useMemo(() => {
    return data.map(item => {
      // Use actual sentiment score if available, otherwise fall back to categorical conversion
      const sentimentValue = item.sentimentScore !== undefined 
        ? item.sentimentScore 
        : (item.sentiment === 'bullish' ? 1 : item.sentiment === 'bearish' ? -1 : 0);
      const confidencePercent = (item.confidence || 0) * 100;
      
      // Determine sentiment category based on score for coloring
      const sentimentCategory = sentimentValue > 0.2 ? 'bullish' : 
                               sentimentValue < -0.2 ? 'bearish' : 'neutral';
      
      return {
        ...item,
        date: item.date,
        sentimentValue,
        confidencePercent,
        volume: item.volume || Math.random() * 1000 + 200, // Mock if not provided
        volatility: item.volatility || Math.random() * 0.5 + 0.1,
        color: SENTIMENT_COLORS[sentimentCategory].primary,
        fillColor: SENTIMENT_COLORS[sentimentCategory].light
      };
    });
  }, [data]);

  const sentimentStats = useMemo(() => {
    const total = processedData.length;
    if (total === 0) return { bullish: 0, bearish: 0, neutral: 0 };
    
    const counts = processedData.reduce((acc, item) => {
      acc[item.sentiment]++;
      return acc;
    }, { bullish: 0, bearish: 0, neutral: 0 });
    
    return {
      bullish: Math.round((counts.bullish / total) * 100),
      bearish: Math.round((counts.bearish / total) * 100),
      neutral: Math.round((counts.neutral / total) * 100)
    };
  }, [processedData]);

  const averageConfidence = useMemo(() => {
    if (processedData.length === 0) return 0;
    return processedData.reduce((sum, item) => sum + item.confidencePercent, 0) / processedData.length;
  }, [processedData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const date = parseISO(label);

    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 min-w-[200px]">
        <p className="text-sm font-semibold text-foreground mb-2">
          {format(date, 'MMM dd, yyyy')}
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Sentiment:</span>
            <div className="flex items-center gap-2">
              {data.sentimentValue > 0.2 && <TrendingUp className="w-4 h-4 text-green-500" />}
              {data.sentimentValue < -0.2 && <TrendingDown className="w-4 h-4 text-red-500" />}
              {data.sentimentValue >= -0.2 && data.sentimentValue <= 0.2 && <Minus className="w-4 h-4 text-gray-500" />}
              <span 
                className="text-sm font-medium"
                style={{ color: data.color }}
              >
                {(data.sentimentValue * 100).toFixed(1)}% {data.sentimentValue > 0 ? 'Bullish' : data.sentimentValue < 0 ? 'Bearish' : 'Neutral'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Confidence:</span>
            <span className="text-sm font-medium">
              {data.confidencePercent.toFixed(1)}%
            </span>
          </div>
          
          {showVolume && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Volume:</span>
              <span className="text-sm font-medium">
                {data.volume.toLocaleString()}
              </span>
            </div>
          )}
          
          {showVolatility && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Volatility:</span>
              <span className="text-sm font-medium">
                {(data.volatility * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    const commonProps = {
      data: processedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    if (chartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          <defs>
            <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
          />
          <YAxis
            domain={[-1, 1]}
            ticks={[-1, -0.5, 0, 0.5, 1]}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
          <ReferenceLine y={0.5} stroke="#10B981" strokeDasharray="1 1" opacity={0.3} />
          <ReferenceLine y={-0.5} stroke="#EF4444" strokeDasharray="1 1" opacity={0.3} />
          
          <Area
            type="monotone"
            dataKey="sentimentValue"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#sentimentGradient)"
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
        </AreaChart>
      );
    }

    if (chartType === 'composed') {
      return (
        <ComposedChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
          />
          <YAxis
            yAxisId="sentiment"
            domain={[-100, 100]}
            ticks={[-100, -50, 0, 50, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12 }}
            stroke="#6B7280"
          />
          {showVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              tick={{ fontSize: 12 }}
              stroke="#6B7280"
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" yAxisId="sentiment" />
          
          <Line
            yAxisId="sentiment"
            type="monotone"
            dataKey="sentimentValue"
            stroke="#3B82F6"
            strokeWidth={3}
            name="Sentiment"
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
          
          <Line
            yAxisId="sentiment"
            type="monotone"
            dataKey="confidencePercent"
            stroke="#10B981"
            strokeWidth={2}
            name="Confidence %"
            strokeDasharray="5 5"
            dot={{ r: 3 }}
          />
          
          {showVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="#E5E7EB"
              opacity={0.3}
              name="Volume"
            />
          )}
        </ComposedChart>
      );
    }

    // Default line chart
    return (
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
        <XAxis
          dataKey="date"
          tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
          tick={{ fontSize: 12 }}
          stroke="#6B7280"
        />
        <YAxis
          domain={[-1, 1]}
          ticks={[-1, -0.5, 0, 0.5, 1]}
          tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          tick={{ fontSize: 12 }}
          stroke="#6B7280"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
        
        <Line
          type="monotone"
          dataKey="sentimentValue"
          stroke="#3B82F6"
          strokeWidth={3}
          name="Sentiment"
          dot={{ r: 4, strokeWidth: 2 }}
          activeDot={{ r: 6, strokeWidth: 2 }}
        />
      </LineChart>
    );
  };

  // Calculate actual sentiment values for badges
  const latestSentiment = processedData.length > 0 ? processedData[processedData.length - 1].sentimentValue : 0;
  const averageSentiment = processedData.length > 0 
    ? processedData.reduce((sum, item) => sum + item.sentimentValue, 0) / processedData.length 
    : 0;

  // Format sentiment as percentage where 1.0 = 100% bullish, -1.0 = 100% bearish
  const formatSentimentPercent = (value: number) => {
    const percent = Math.abs(value * 100);
    const direction = value > 0 ? 'Bullish' : value < 0 ? 'Bearish' : 'Neutral';
    return value === 0 ? '0% Neutral' : `${percent.toFixed(1)}% ${direction}`;
  };

  const badges = [
    { text: `${averageConfidence.toFixed(0)}% Avg Confidence`, variant: 'secondary' as const },
    { text: formatSentimentPercent(latestSentiment), variant: latestSentiment > 0 ? 'default' : latestSentiment < 0 ? 'destructive' : 'secondary' as const },
    { text: `${formatSentimentPercent(averageSentiment)} (Avg)`, variant: averageSentiment > 0 ? 'default' : averageSentiment < 0 ? 'destructive' : 'secondary' as const }
  ];

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `${data.length} data points • Last updated ${format(new Date(), 'HH:mm')}`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
    >
      {renderChart()}
    </ChartBase>
  );
};