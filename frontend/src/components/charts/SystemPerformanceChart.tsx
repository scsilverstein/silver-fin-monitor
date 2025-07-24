import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { ChartBase } from './ChartBase';
import { format } from 'date-fns';
import { 
  Server, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Activity,
  Zap,
  Database
} from 'lucide-react';

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retry: number;
}

interface SystemMetrics {
  timestamp: string;
  queue: QueueStats;
  processing: {
    feedsPerHour: number;
    avgProcessingTime: number;
    successRate: number;
  };
  transcription: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    avgTime: number;
  };
  memory?: {
    used: number;
    total: number;
  };
  cpu?: number;
}

interface SystemPerformanceChartProps {
  data: SystemMetrics[];
  currentStats?: SystemMetrics;
  title?: string;
  subtitle?: string;
  height?: number;
  chartType?: 'queue' | 'performance' | 'status' | 'resources';
  timeRange?: '1h' | '6h' | '24h' | '7d';
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const STATUS_COLORS = {
  completed: '#10B981',  // Green
  processing: '#3B82F6', // Blue  
  pending: '#F59E0B',    // Yellow
  failed: '#EF4444',     // Red
  retry: '#8B5CF6',      // Purple
  healthy: '#10B981',    // Green
  warning: '#F59E0B',    // Yellow
  critical: '#EF4444'    // Red
};

const PERFORMANCE_COLORS = {
  excellent: '#10B981', // >90%
  good: '#3B82F6',      // 70-90%
  fair: '#F59E0B',      // 50-70%
  poor: '#EF4444'       // <50%
};

export const SystemPerformanceChart: React.FC<SystemPerformanceChartProps> = ({
  data = [],
  currentStats,
  title = "System Performance",
  subtitle,
  height = 400,
  chartType = 'queue',
  timeRange = '6h',
  loading = false,
  error = null,
  onRefresh
}) => {
  const processedData = useMemo(() => {
    if (chartType === 'queue') {
      return data.map(item => ({
        time: format(new Date(item.timestamp), 'HH:mm'),
        timestamp: item.timestamp,
        ...item.queue,
        total: Object.values(item.queue).reduce((sum, val) => sum + val, 0)
      }));
    }

    if (chartType === 'performance') {
      return data.map(item => ({
        time: format(new Date(item.timestamp), 'HH:mm'),
        timestamp: item.timestamp,
        successRate: item.processing.successRate * 100,
        avgProcessingTime: item.processing.avgProcessingTime,
        feedsPerHour: item.processing.feedsPerHour,
        transcriptionTime: item.transcription.avgTime || 0
      }));
    }

    if (chartType === 'status' && currentStats) {
      const queueData = [
        { name: 'Completed', value: currentStats.queue.completed, color: STATUS_COLORS.completed },
        { name: 'Processing', value: currentStats.queue.processing, color: STATUS_COLORS.processing },
        { name: 'Pending', value: currentStats.queue.pending, color: STATUS_COLORS.pending },
        { name: 'Failed', value: currentStats.queue.failed, color: STATUS_COLORS.failed },
        { name: 'Retry', value: currentStats.queue.retry, color: STATUS_COLORS.retry }
      ].filter(item => item.value > 0);

      return queueData;
    }

    if (chartType === 'resources') {
      return data.map(item => ({
        time: format(new Date(item.timestamp), 'HH:mm'),
        timestamp: item.timestamp,
        memoryUsage: item.memory ? (item.memory.used / item.memory.total) * 100 : Math.random() * 70 + 20,
        cpuUsage: item.cpu || Math.random() * 60 + 20,
        transcriptionQueue: item.transcription.pending + item.transcription.processing,
        processingQueue: item.queue.pending + item.queue.processing
      }));
    }

    return data;
  }, [data, currentStats, chartType]);

  const systemHealth = useMemo(() => {
    if (!currentStats) return { status: 'unknown', score: 0 };

    const queueTotal = Object.values(currentStats.queue).reduce((sum, val) => sum + val, 0);
    const failedRate = queueTotal > 0 ? currentStats.queue.failed / queueTotal : 0;
    const successRate = currentStats.processing.successRate;
    
    let score = 100;
    score -= failedRate * 50; // Reduce score for failed jobs
    score *= successRate; // Multiply by success rate
    
    const status = score > 80 ? 'healthy' : score > 60 ? 'warning' : 'critical';
    
    return { status, score: Math.max(0, score) };
  }, [currentStats]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 min-w-[200px]">
        <p className="text-sm font-semibold text-foreground mb-3">
          {chartType === 'status' ? 'Current Status' : `Time: ${label}`}
        </p>
        
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-muted-foreground">
                  {entry.name || entry.dataKey}
                </span>
              </div>
              <span className="text-sm font-medium">
                {typeof entry.value === 'number' ? 
                  (entry.name?.includes('%') || entry.name?.includes('Rate') || entry.name?.includes('Usage') ? 
                    `${entry.value.toFixed(1)}%` : 
                    entry.value.toLocaleString()
                  ) : 
                  entry.value
                }
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if (percent < 0.05) return null; // Don't show labels for very small slices
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const renderChart = () => {
    if (chartType === 'queue') {
      return (
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 11 }}
          />
          <YAxis 
            tick={{ fontSize: 11 }}
            label={{ value: 'Job Count', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <Area
            type="monotone"
            dataKey="total"
            fill="#E5E7EB"
            fillOpacity={0.3}
            stroke="#9CA3AF"
            strokeWidth={1}
            name="Total Jobs"
          />

          <Bar dataKey="completed" stackId="a" fill={STATUS_COLORS.completed} name="Completed" />
          <Bar dataKey="processing" stackId="a" fill={STATUS_COLORS.processing} name="Processing" />
          <Bar dataKey="pending" stackId="a" fill={STATUS_COLORS.pending} name="Pending" />
          <Bar dataKey="failed" stackId="a" fill={STATUS_COLORS.failed} name="Failed" />
          <Bar dataKey="retry" stackId="a" fill={STATUS_COLORS.retry} name="Retry" />
        </ComposedChart>
      );
    }

    if (chartType === 'performance') {
      return (
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 11 }}
          />
          <YAxis 
            yAxisId="rate"
            tick={{ fontSize: 11 }}
            label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }}
          />
          <YAxis 
            yAxisId="time"
            orientation="right"
            tick={{ fontSize: 11 }}
            label={{ value: 'Time (ms)', angle: 90, position: 'insideRight' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <ReferenceLine y={90} stroke={STATUS_COLORS.completed} strokeDasharray="2 2" yAxisId="rate" />
          <ReferenceLine y={70} stroke={STATUS_COLORS.warning} strokeDasharray="2 2" yAxisId="rate" />

          <Area
            yAxisId="rate"
            type="monotone"
            dataKey="successRate"
            fill={STATUS_COLORS.completed}
            fillOpacity={0.2}
            stroke={STATUS_COLORS.completed}
            strokeWidth={2}
            name="Success Rate"
          />

          <Line
            yAxisId="time"
            type="monotone"
            dataKey="avgProcessingTime"
            stroke={STATUS_COLORS.processing}
            strokeWidth={2}
            name="Avg Processing Time"
            dot={{ r: 3 }}
          />

          <Bar
            yAxisId="rate"
            dataKey="feedsPerHour"
            fill={STATUS_COLORS.pending}
            opacity={0.6}
            name="Feeds/Hour"
          />
        </ComposedChart>
      );
    }

    if (chartType === 'status') {
      return (
        <PieChart>
          <Pie
            data={processedData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={CustomPieLabel}
            outerRadius={120}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
            stroke="white"
            strokeWidth={2}
          >
            {processedData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => (
              <span style={{ color: entry.color }}>
                {value}: {entry.payload.value}
              </span>
            )}
          />
        </PieChart>
      );
    }

    if (chartType === 'resources') {
      return (
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 11 }}
          />
          <YAxis 
            yAxisId="percentage"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            label={{ value: 'Usage (%)', angle: -90, position: 'insideLeft' }}
          />
          <YAxis 
            yAxisId="queue"
            orientation="right"
            tick={{ fontSize: 11 }}
            label={{ value: 'Queue Size', angle: 90, position: 'insideRight' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <ReferenceLine y={80} stroke={STATUS_COLORS.warning} strokeDasharray="2 2" yAxisId="percentage" />
          <ReferenceLine y={90} stroke={STATUS_COLORS.failed} strokeDasharray="2 2" yAxisId="percentage" />

          <Area
            yAxisId="percentage"
            type="monotone"
            dataKey="cpuUsage"
            fill={STATUS_COLORS.processing}
            fillOpacity={0.3}
            stroke={STATUS_COLORS.processing}
            strokeWidth={2}
            name="CPU Usage"
          />

          <Line
            yAxisId="percentage"
            type="monotone"
            dataKey="memoryUsage"
            stroke={STATUS_COLORS.warning}
            strokeWidth={2}
            name="Memory Usage"
            strokeDasharray="3 3"
          />

          <Bar
            yAxisId="queue"
            dataKey="processingQueue"
            fill={STATUS_COLORS.pending}
            opacity={0.6}
            name="Processing Queue"
          />
        </ComposedChart>
      );
    }

    return null;
  };

  const badges = [
    { 
      text: `${systemHealth.status.charAt(0).toUpperCase() + systemHealth.status.slice(1)}`, 
      variant: systemHealth.status === 'healthy' ? 'default' : 
                systemHealth.status === 'warning' ? 'secondary' : 'destructive' 
    },
    { text: `${systemHealth.score.toFixed(0)}% Score`, variant: 'outline' as const },
    { text: timeRange.toUpperCase(), variant: 'secondary' as const }
  ];

  const getStatusIcon = () => {
    switch (systemHealth.status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `System health monitoring • ${timeRange} timeframe`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
      actions={
        <div className="flex items-center gap-2">
          {getStatusIcon()}
        </div>
      }
    >
      {renderChart()}
    </ChartBase>
  );
};