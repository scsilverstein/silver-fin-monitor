import React, { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend
} from 'recharts';
import { ChartBase } from './ChartBase';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  AlertTriangle, 
  Clock,
  Target
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface NarrativeMomentum {
  narrative: string;
  timeframe: string;
  velocity: number;
  acceleration: number;
  dominance: number;
  crossoverScore: number;
  sentimentEvolution: {
    current: number;
    trend: 'strengthening' | 'weakening' | 'stable';
    volatility: number;
  };
  sourceBreakdown: {
    mainstream: number;
    specialized: number;
    social: number;
  };
  predictiveSignals: {
    momentum: number;
    breakoutProbability: number;
    estimatedPeakTime: string;
    marketRelevance: number;
  };
  mutations: Array<{
    originalForm: string;
    currentForm: string;
    similarityScore: number;
  }>;
}

interface NarrativeMomentumTrackerProps {
  data: NarrativeMomentum[];
  timeframe?: '24h' | '7d' | '30d';
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onNarrativeClick?: (narrative: NarrativeMomentum) => void;
}

export const NarrativeMomentumTracker: React.FC<NarrativeMomentumTrackerProps> = ({
  data,
  timeframe = '24h',
  title = "Narrative Momentum Tracker",
  subtitle,
  height = 500,
  loading = false,
  error = null,
  onRefresh,
  onNarrativeClick
}) => {
  const [selectedNarrative, setSelectedNarrative] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'momentum' | 'crossover' | 'breakout'>('momentum');

  const { chartData, topNarratives, explosiveNarratives, crossoverCandidates } = useMemo(() => {
    if (!data.length) return { 
      chartData: [], 
      topNarratives: [], 
      explosiveNarratives: [],
      crossoverCandidates: []
    };

    // Transform data for scatter chart
    const chartData = data.map((narrative, index) => ({
      x: narrative.velocity,
      y: narrative.dominance,
      z: narrative.predictiveSignals.momentum * 1000, // Scale for bubble size
      narrative: narrative.narrative,
      acceleration: narrative.acceleration,
      crossoverScore: narrative.crossoverScore,
      breakoutProbability: narrative.predictiveSignals.breakoutProbability,
      marketRelevance: narrative.predictiveSignals.marketRelevance,
      estimatedPeakTime: narrative.predictiveSignals.estimatedPeakTime,
      sentiment: narrative.sentimentEvolution.current,
      trend: narrative.sentimentEvolution.trend,
      mutations: narrative.mutations.length,
      originalData: narrative
    }));

    // Identify different types of narratives
    const topNarratives = data
      .sort((a, b) => b.predictiveSignals.momentum - a.predictiveSignals.momentum)
      .slice(0, 5);

    const explosiveNarratives = data.filter(n => 
      n.velocity > 5 && n.acceleration > 0 && n.predictiveSignals.momentum > 0.7
    );

    const crossoverCandidates = data.filter(n => 
      n.crossoverScore > 0.6 && n.sourceBreakdown.mainstream < 0.5
    );

    return { chartData, topNarratives, explosiveNarratives, crossoverCandidates };
  }, [data]);

  const getColor = (point: any): string => {
    if (viewMode === 'momentum') {
      // Color by acceleration: red = accelerating, blue = decelerating, gray = stable
      if (point.acceleration > 1) return '#EF4444'; // Red - explosive
      if (point.acceleration > 0.2) return '#F97316'; // Orange - accelerating
      if (point.acceleration > -0.2) return '#6B7280'; // Gray - stable
      if (point.acceleration > -1) return '#3B82F6'; // Blue - decelerating
      return '#1E40AF'; // Dark blue - declining
    } else if (viewMode === 'crossover') {
      // Color by crossover probability
      const score = point.crossoverScore;
      if (score > 0.8) return '#DC2626'; // High probability
      if (score > 0.6) return '#EA580C'; // Medium-high
      if (score > 0.4) return '#D97706'; // Medium
      if (score > 0.2) return '#65A30D'; // Low-medium
      return '#6B7280'; // Low
    } else {
      // Color by breakout probability
      const prob = point.breakoutProbability;
      if (prob > 0.8) return '#DC2626';
      if (prob > 0.6) return '#EA580C';
      if (prob > 0.4) return '#D97706';
      if (prob > 0.2) return '#65A30D';
      return '#6B7280';
    }
  };

  const getOpacity = (point: any): number => {
    return selectedNarrative && selectedNarrative !== point.narrative ? 0.3 : 0.8;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    
    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 min-w-[300px]">
        <div className="font-semibold text-lg mb-3 text-foreground">
          {data.narrative}
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Velocity:</span>
            <div className="font-medium">{data.x.toFixed(1)} mentions/hr</div>
          </div>
          <div>
            <span className="text-muted-foreground">Dominance:</span>
            <div className="font-medium">{data.y.toFixed(1)}%</div>
          </div>
          <div>
            <span className="text-muted-foreground">Acceleration:</span>
            <div className={`font-medium flex items-center gap-1 ${
              data.acceleration > 0 ? 'text-red-500' : 'text-blue-500'
            }`}>
              {data.acceleration > 0 ? 
                <TrendingUp className="w-3 h-3" /> : 
                <TrendingDown className="w-3 h-3" />
              }
              {(data.acceleration * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Momentum:</span>
            <div className="font-medium">{(data.z / 10).toFixed(0)}%</div>
          </div>
          <div>
            <span className="text-muted-foreground">Crossover:</span>
            <div className="font-medium">{(data.crossoverScore * 100).toFixed(0)}%</div>
          </div>
          <div>
            <span className="text-muted-foreground">Breakout:</span>
            <div className="font-medium">{(data.breakoutProbability * 100).toFixed(0)}%</div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            Peak Est: {format(parseISO(data.estimatedPeakTime), 'MMM dd, HH:mm')}
          </div>
          {data.mutations > 0 && (
            <div className="text-xs text-yellow-600 mt-1">
              ⚠ {data.mutations} narrative mutations detected
            </div>
          )}
        </div>
      </div>
    );
  };

  const badges = [
    {
      text: `${data.length} Narratives`,
      variant: 'secondary' as const
    },
    {
      text: `${explosiveNarratives.length} Explosive`,
      variant: explosiveNarratives.length > 0 ? 'destructive' : 'secondary' as const,
      icon: explosiveNarratives.length > 0 ? <Zap className="w-3 h-3" /> : undefined
    },
    {
      text: `${crossoverCandidates.length} Crossover Ready`,
      variant: crossoverCandidates.length > 0 ? 'default' : 'secondary' as const,
      icon: crossoverCandidates.length > 0 ? <Target className="w-3 h-3" /> : undefined
    }
  ];

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `Real-time narrative momentum analysis • ${timeframe} view`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
    >
      <div className="space-y-4">
        {/* View Mode Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('momentum')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'momentum' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Momentum View
          </button>
          <button
            onClick={() => setViewMode('crossover')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'crossover' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Crossover View
          </button>
          <button
            onClick={() => setViewMode('breakout')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'breakout' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Breakout View
          </button>
        </div>

        {/* Main Chart */}
        <div style={{ height: height - 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
              <XAxis
                dataKey="x"
                name="Velocity (mentions/hour)"
                tick={{ fontSize: 12 }}
                stroke="#6B7280"
              />
              <YAxis
                dataKey="y"
                name="Dominance (%)"
                tick={{ fontSize: 12 }}
                stroke="#6B7280"
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference lines for key thresholds */}
              <ReferenceLine x={3} stroke="#F59E0B" strokeDasharray="2 2" opacity={0.5} />
              <ReferenceLine y={10} stroke="#F59E0B" strokeDasharray="2 2" opacity={0.5} />
              
              <Scatter dataKey="z" onClick={(data) => setSelectedNarrative(data.narrative)}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getColor(entry)}
                    fillOpacity={getOpacity(entry)}
                    stroke={selectedNarrative === entry.narrative ? '#000' : 'none'}
                    strokeWidth={2}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Alert Summary */}
        {(explosiveNarratives.length > 0 || crossoverCandidates.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {explosiveNarratives.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Explosive Growth Detected
                </h4>
                <div className="space-y-1">
                  {explosiveNarratives.slice(0, 3).map(narrative => (
                    <div key={narrative.narrative} className="text-sm">
                      <span className="font-medium">{narrative.narrative}</span>
                      <span className="text-red-600 dark:text-red-400 ml-2">
                        {narrative.velocity.toFixed(1)} mentions/hr
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {crossoverCandidates.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Mainstream Crossover Imminent
                </h4>
                <div className="space-y-1">
                  {crossoverCandidates.slice(0, 3).map(narrative => (
                    <div key={narrative.narrative} className="text-sm">
                      <span className="font-medium">{narrative.narrative}</span>
                      <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                        {(narrative.crossoverScore * 100).toFixed(0)}% probability
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top Narratives List */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Top Momentum Narratives</h4>
          <div className="space-y-2">
            {topNarratives.map((narrative, index) => (
              <div
                key={narrative.narrative}
                onClick={() => onNarrativeClick?.(narrative)}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-amber-600' :
                    'bg-muted'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <h5 className="font-medium">{narrative.narrative}</h5>
                    <p className="text-sm text-muted-foreground">
                      {narrative.velocity.toFixed(1)} mentions/hr • 
                      {(narrative.dominance).toFixed(1)}% dominance
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {(narrative.predictiveSignals.momentum * 100).toFixed(0)}% momentum
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${
                    narrative.acceleration > 0 ? 'text-red-500' : 'text-blue-500'
                  }`}>
                    {narrative.acceleration > 0 ? 
                      <TrendingUp className="w-3 h-3" /> : 
                      <TrendingDown className="w-3 h-3" />
                    }
                    {narrative.sentimentEvolution.trend}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ChartBase>
  );
};