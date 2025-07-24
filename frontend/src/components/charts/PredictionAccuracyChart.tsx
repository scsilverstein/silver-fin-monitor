import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area,
  AreaChart,
  ScatterChart,
  Scatter,
  Cell
} from 'recharts';
import { ChartBase } from './ChartBase';
import { Badge } from '@/components/ui/Badge';
import { Target, TrendingUp, Award } from 'lucide-react';

interface PredictionData {
  id: string;
  predictionType: string;
  timeHorizon: string;
  accuracy: number;
  confidence: number;
  date: string;
  outcome?: 'correct' | 'incorrect' | 'partial';
}

interface AccuracyData {
  category: string;
  accuracy: number;
  total: number;
  correct: number;
  color?: string;
}

interface PredictionAccuracyChartProps {
  data: PredictionData[];
  accuracyByType?: AccuracyData[];
  accuracyByHorizon?: AccuracyData[];
  title?: string;
  subtitle?: string;
  height?: number;
  chartType?: 'accuracy' | 'calibration' | 'timeline' | 'comparison';
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const ACCURACY_COLORS = {
  excellent: '#10B981', // Green (80%+)
  good: '#F59E0B',      // Yellow (60-80%)
  poor: '#EF4444',      // Red (<60%)
  neutral: '#6B7280'    // Gray
};

const TIME_HORIZON_COLORS = {
  '1_week': '#3B82F6',
  '1_month': '#8B5CF6',
  '3_months': '#10B981',
  '6_months': '#F59E0B',
  '1_year': '#EF4444'
};

export const PredictionAccuracyChart: React.FC<PredictionAccuracyChartProps> = ({
  data = [],
  accuracyByType = [],
  accuracyByHorizon = [],
  title = "Prediction Accuracy Analysis",
  subtitle,
  height = 400,
  chartType = 'accuracy',
  loading = false,
  error = null,
  onRefresh
}) => {
  const processedData = useMemo(() => {
    if (chartType === 'accuracy' && accuracyByType.length > 0) {
      return accuracyByType.map(item => ({
        ...item,
        accuracyPercent: item.accuracy * 100,
        color: item.accuracy >= 0.8 ? ACCURACY_COLORS.excellent :
               item.accuracy >= 0.6 ? ACCURACY_COLORS.good :
               ACCURACY_COLORS.poor
      }));
    }

    if (chartType === 'comparison' && accuracyByHorizon.length > 0) {
      return accuracyByHorizon.map(item => ({
        ...item,
        accuracyPercent: item.accuracy * 100,
        color: TIME_HORIZON_COLORS[item.category as keyof typeof TIME_HORIZON_COLORS] || ACCURACY_COLORS.neutral
      }));
    }

    if (chartType === 'calibration') {
      // Group predictions by confidence bins for calibration analysis
      const bins = Array.from({ length: 10 }, (_, i) => ({
        confidenceBin: `${i * 10}-${(i + 1) * 10}%`,
        expectedAccuracy: (i * 10 + (i + 1) * 10) / 2,
        actualAccuracy: 0,
        count: 0
      }));

      data.forEach(prediction => {
        if (!prediction || typeof prediction.confidence !== 'number' || typeof prediction.accuracy !== 'number') {
          return; // Skip invalid predictions
        }
        const binIndex = Math.min(Math.max(0, Math.floor(prediction.confidence * 10)), 9);
        if (bins[binIndex]) {
          bins[binIndex].actualAccuracy += prediction.accuracy;
          bins[binIndex].count += 1;
        }
      });

      return bins.map(bin => ({
        ...bin,
        actualAccuracy: bin.count > 0 ? (bin.actualAccuracy / bin.count) * 100 : 0,
        calibrationGap: bin.count > 0 ? 
          Math.abs(bin.expectedAccuracy - (bin.actualAccuracy / bin.count) * 100) : 0
      })).filter(bin => bin.count > 0);
    }

    if (chartType === 'timeline') {
      // Group by date and calculate daily accuracy
      const dailyAccuracy = data.reduce((acc, prediction) => {
        if (!prediction || !prediction.date || typeof prediction.accuracy !== 'number') {
          return acc; // Skip invalid predictions
        }
        const date = prediction.date;
        if (!acc[date]) {
          acc[date] = { correct: 0, total: 0, accuracySum: 0 };
        }
        acc[date].total += 1;
        acc[date].accuracySum += prediction.accuracy;
        if (prediction.accuracy > 0.7) acc[date].correct += 1;
        return acc;
      }, {} as Record<string, { correct: number; total: number; accuracySum: number }>);

      return Object.entries(dailyAccuracy).map(([date, stats]) => ({
        date,
        accuracy: (stats.accuracySum / stats.total) * 100,
        correctRate: (stats.correct / stats.total) * 100,
        total: stats.total
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return [];
  }, [data, accuracyByType, accuracyByHorizon, chartType]);

  const overallStats = useMemo(() => {
    if (!data || data.length === 0) return { overall: 0, total: 0, excellent: 0 };
    
    const validData = data.filter(item => item && typeof item.accuracy === 'number');
    if (validData.length === 0) return { overall: 0, total: 0, excellent: 0 };
    
    const totalAccuracy = validData.reduce((sum, item) => sum + item.accuracy, 0);
    const excellent = validData.filter(item => item.accuracy >= 0.8).length;
    
    return {
      overall: (totalAccuracy / validData.length) * 100,
      total: validData.length,
      excellent: (excellent / validData.length) * 100
    };
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 min-w-[200px]">
        <p className="text-sm font-semibold text-foreground mb-2">
          {label}
        </p>
        
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{entry.name}:</span>
              <span 
                className="text-sm font-medium"
                style={{ color: entry.color }}
              >
                {typeof entry.value === 'number' ? 
                  `${entry.value.toFixed(1)}%` : 
                  entry.value
                }
              </span>
            </div>
          ))}
          
          {data.total && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Predictions:</span>
              <span className="text-sm font-medium">{data.total}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    if (chartType === 'accuracy' || chartType === 'comparison') {
      return (
        <BarChart
          data={processedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            dataKey="category" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={70} stroke="#F59E0B" strokeDasharray="2 2" />
          <ReferenceLine y={80} stroke="#10B981" strokeDasharray="2 2" />
          
          <Bar 
            dataKey="accuracyPercent" 
            name="Accuracy"
            radius={[4, 4, 0, 0]}
          >
            {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      );
    }

    if (chartType === 'calibration') {
      return (
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            dataKey="confidenceBin" 
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Perfect calibration line */}
          <Line 
            type="monotone" 
            dataKey="expectedAccuracy" 
            stroke="#6B7280" 
            strokeDasharray="5 5"
            name="Perfect Calibration"
            dot={false}
          />
          
          <Line 
            type="monotone" 
            dataKey="actualAccuracy" 
            stroke="#3B82F6" 
            strokeWidth={3}
            name="Actual Accuracy"
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          
          <Bar 
            dataKey="calibrationGap" 
            fill="#EF4444" 
            opacity={0.3}
            name="Calibration Gap"
          />
        </ComposedChart>
      );
    }

    if (chartType === 'timeline') {
      return (
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          <Area
            type="monotone"
            dataKey="accuracy"
            fill="#3B82F6"
            fillOpacity={0.2}
            stroke="#3B82F6"
            strokeWidth={2}
            name="Average Accuracy"
          />
          
          <Line
            type="monotone"
            dataKey="correctRate"
            stroke="#10B981"
            strokeWidth={2}
            name="Correct Predictions %"
            dot={{ r: 4 }}
          />
        </ComposedChart>
      );
    }

    return null;
  };

  const badges = [
    { text: `${overallStats.overall.toFixed(1)}% Overall`, variant: 'default' as const },
    { text: `${overallStats.excellent.toFixed(0)}% Excellent`, variant: 'secondary' as const },
    { text: `${overallStats.total} Predictions`, variant: 'outline' as const }
  ];

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `Performance analysis across ${data.length} predictions`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
      actions={
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
        </div>
      }
    >
      {renderChart()}
    </ChartBase>
  );
};