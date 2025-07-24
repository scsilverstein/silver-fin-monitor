import React, { useMemo } from 'react';
import {
  ModernCard,
  CardContent,
  CardHeader,
  CardTitle,
  ModernBadge
} from '@/components/ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp,
  Target,
  Clock,
  Brain,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Zap
} from 'lucide-react';
import { formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PredictionData {
  keyAssumptions?: string[];
  measurableOutcomes?: string[];
  generatedFrom?: string;
  [key: string]: any;
}

interface Prediction {
  id: string;
  dailyAnalysisId?: string;
  predictionType?: string;
  predictionText?: string;
  confidenceLevel?: number;
  timeHorizon: '1_week' | '1_month' | '3_months' | '6_months' | '1_year';
  predictionData: PredictionData;
  createdAt: Date;
}

interface PredictionAnalyticsProps {
  predictions: Prediction[];
  className?: string;
}

const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  teal: '#14b8a6',
  pink: '#ec4899',
  indigo: '#6366f1'
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.warning,
  COLORS.purple,
  COLORS.teal,
  COLORS.pink,
  COLORS.indigo,
  COLORS.danger
];

export const PredictionAnalytics: React.FC<PredictionAnalyticsProps> = ({
  predictions,
  className
}) => {
  // Calculate analytics data
  const analytics = useMemo(() => {
    if (predictions.length === 0) {
      return {
        stats: {
          total: 0,
          avgConfidence: 0,
          highConfidence: 0,
          recentCount: 0
        },
        typeDistribution: [],
        horizonDistribution: [],
        confidenceDistribution: [],
        timelineData: []
      };
    }

    // Basic stats
    const total = predictions.length;
    const avgConfidence = predictions.reduce((sum, p) => sum + (p.confidenceLevel || 0), 0) / total;
    const highConfidence = predictions.filter(p => (p.confidenceLevel || 0) >= 0.8).length;
    const recentCount = predictions.filter(
      p => new Date(p.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    // Type distribution
    const typeMap = new Map<string, number>();
    predictions.forEach(p => {
      const type = p.predictionType || 'Unknown';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    const typeDistribution = Array.from(typeMap.entries()).map(([name, value]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value,
      percentage: (value / total) * 100
    }));

    // Time horizon distribution
    const horizonMap = new Map<string, { count: number, avgConfidence: number }>();
    predictions.forEach(p => {
      const horizon = p.timeHorizon;
      const current = horizonMap.get(horizon) || { count: 0, avgConfidence: 0 };
      current.count += 1;
      current.avgConfidence += p.confidenceLevel || 0;
      horizonMap.set(horizon, current);
    });
    
    const horizonLabels: Record<string, string> = {
      '1_week': '1 Week',
      '1_month': '1 Month',
      '3_months': '3 Months',
      '6_months': '6 Months',
      '1_year': '1 Year'
    };

    const horizonDistribution = Array.from(horizonMap.entries()).map(([horizon, data]) => ({
      name: horizonLabels[horizon] || horizon,
      count: data.count,
      avgConfidence: data.avgConfidence / data.count,
      percentage: (data.count / total) * 100
    }));

    // Confidence distribution (bins)
    const confidenceBins = [
      { range: '0-20%', min: 0, max: 0.2, count: 0 },
      { range: '20-40%', min: 0.2, max: 0.4, count: 0 },
      { range: '40-60%', min: 0.4, max: 0.6, count: 0 },
      { range: '60-80%', min: 0.6, max: 0.8, count: 0 },
      { range: '80-100%', min: 0.8, max: 1, count: 0 }
    ];

    predictions.forEach(p => {
      const confidence = p.confidenceLevel || 0;
      const bin = confidenceBins.find(b => confidence >= b.min && confidence < b.max) || 
                  confidenceBins[confidenceBins.length - 1];
      bin.count += 1;
    });

    // Timeline data (predictions over time)
    const timelineMap = new Map<string, { count: number, avgConfidence: number }>();
    predictions.forEach(p => {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      const current = timelineMap.get(date) || { count: 0, avgConfidence: 0 };
      current.count += 1;
      current.avgConfidence += p.confidenceLevel || 0;
      timelineMap.set(date, current);
    });

    const timelineData = Array.from(timelineMap.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        avgConfidence: data.avgConfidence / data.count,
        formattedDate: new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 days

    return {
      stats: {
        total,
        avgConfidence,
        highConfidence,
        recentCount
      },
      typeDistribution,
      horizonDistribution,
      confidenceDistribution: confidenceBins,
      timelineData
    };
  }, [predictions]);

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<any>;
    color?: string;
  }> = ({ title, value, subtitle, icon: Icon, color = 'text-blue-500' }) => (
    <div className="flex items-center space-x-3 p-4 rounded-lg border bg-gradient-to-r from-muted/20 to-muted/10">
      <div className={cn("p-2 rounded-lg bg-background", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Predictions"
          value={analytics.stats.total}
          icon={Target}
          color="text-blue-500"
        />
        <StatCard
          title="Average Confidence"
          value={formatPercent(analytics.stats.avgConfidence)}
          subtitle="Across all predictions"
          icon={Brain}
          color="text-green-500"
        />
        <StatCard
          title="High Confidence"
          value={analytics.stats.highConfidence}
          subtitle="≥80% confidence level"
          icon={Zap}
          color="text-yellow-500"
        />
        <StatCard
          title="Recent Predictions"
          value={analytics.stats.recentCount}
          subtitle="Last 7 days"
          icon={Clock}
          color="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prediction Types Distribution */}
        <ModernCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Prediction Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.typeDistribution.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analytics.typeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {analytics.typeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} predictions`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {analytics.typeDistribution.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.value}</span>
                        <ModernBadge variant="secondary" className="text-xs">
                          {item.percentage.toFixed(1)}%
                        </ModernBadge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </ModernCard>

        {/* Time Horizon Distribution */}
        <ModernCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Time Horizons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.horizonDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.horizonDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (name === 'count') return [`${value} predictions`, 'Count'];
                      if (name === 'avgConfidence') return [`${formatPercent(value)}`, 'Avg Confidence'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="count" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </ModernCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence Distribution */}
        <ModernCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Confidence Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.confidenceDistribution.some(bin => bin.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.confidenceDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any) => [`${value} predictions`, 'Count']}
                  />
                  <Bar dataKey="count" fill={COLORS.secondary} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </ModernCard>

        {/* Timeline */}
        <ModernCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Prediction Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={analytics.timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="formattedDate" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (name === 'count') return [`${value} predictions`, 'Daily Count'];
                      if (name === 'avgConfidence') return [`${formatPercent(value)}`, 'Avg Confidence'];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke={COLORS.primary} 
                    fill={COLORS.primary}
                    fillOpacity={0.3}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgConfidence" 
                    stroke={COLORS.warning}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No timeline data available</p>
            )}
          </CardContent>
        </ModernCard>
      </div>
    </div>
  );
};