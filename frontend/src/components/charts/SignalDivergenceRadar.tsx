import React, { useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { ChartBase } from './ChartBase';
import { AlertTriangle, TrendingUp } from 'lucide-react';

interface SignalDivergenceData {
  timestamp: string;
  sources: {
    name: string;
    sentiment: number; // -1 to 1
    confidence: number; // 0 to 1
    volumeNormalized: number; // 0 to 1
  }[];
  divergenceScore: number;
  marketEvent?: string;
}

interface SignalDivergenceRadarProps {
  data: SignalDivergenceData;
  historicalDivergences?: SignalDivergenceData[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export const SignalDivergenceRadar: React.FC<SignalDivergenceRadarProps> = ({
  data,
  historicalDivergences = [],
  title = "Signal Divergence Analysis",
  subtitle,
  height = 400,
  loading = false,
  error = null,
  onRefresh
}) => {
  const { radarData, divergenceLevel, historicalContext } = useMemo(() => {
    // Provide a default empty data structure if data is null/undefined
    const safeData = data || { 
      timestamp: new Date().toISOString(), 
      sources: [], 
      divergenceScore: 0 
    };
    
    if (!safeData.sources || safeData.sources.length === 0) {
      return { radarData: [], divergenceLevel: 'low', historicalContext: null };
    }

    // Transform data for radar chart - normalize sentiment to 0-100 scale
    const radarData = safeData.sources.map(source => ({
      source: source.name,
      sentiment: ((source.sentiment + 1) / 2) * 100, // Convert -1 to 1 => 0 to 100
      confidence: source.confidence * 100,
      volume: source.volumeNormalized * 100
    }));

    // Calculate divergence level
    const sentiments = safeData.sources.map(s => s.sentiment);
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / sentiments.length;
    const stdDev = Math.sqrt(variance);

    const divergenceLevel = stdDev > 0.5 ? 'high' : stdDev > 0.3 ? 'medium' : 'low';

    // Historical context
    const historicalContext = historicalDivergences.length > 0 ? {
      avgDivergence: historicalDivergences.reduce((sum, h) => sum + h.divergenceScore, 0) / historicalDivergences.length,
      maxDivergence: Math.max(...historicalDivergences.map(h => h.divergenceScore)),
      percentile: (historicalDivergences.filter(h => h.divergenceScore < safeData.divergenceScore).length / historicalDivergences.length) * 100
    } : null;

    return { radarData, divergenceLevel, historicalContext };
  }, [data, historicalDivergences]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4">
        <p className="text-sm font-semibold mb-2">{data.source}</p>
        <div className="space-y-1">
          <p className="text-sm">
            Sentiment: <span className="font-medium">{data.sentiment.toFixed(1)}%</span>
          </p>
          <p className="text-sm">
            Confidence: <span className="font-medium">{data.confidence.toFixed(1)}%</span>
          </p>
          <p className="text-sm">
            Volume: <span className="font-medium">{data.volume.toFixed(1)}%</span>
          </p>
        </div>
      </div>
    );
  };

  const getDivergenceColor = (level: string) => {
    switch (level) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const badges = [
    {
      text: `Divergence: ${divergenceLevel.toUpperCase()}`,
      variant: divergenceLevel === 'high' ? 'destructive' : divergenceLevel === 'medium' ? 'secondary' : 'default' as const,
      icon: divergenceLevel === 'high' ? <AlertTriangle className="w-3 h-3" /> : null
    }
  ];

  if (historicalContext) {
    badges.push({
      text: `${historicalContext.percentile.toFixed(0)}th percentile`,
      variant: historicalContext.percentile > 90 ? 'destructive' : 'secondary' as const,
      icon: historicalContext.percentile > 90 ? <TrendingUp className="w-3 h-3" /> : null
    });
  }

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `Analyzing ${data?.sources?.length || 0} sources • ${data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
    >
      {radarData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis 
              dataKey="source" 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            <Radar
              name="Sentiment"
              dataKey="sentiment"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Radar
              name="Confidence"
              dataKey="confidence"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Radar
              name="Volume"
              dataKey="volume"
              stroke="#F59E0B"
              fill="#F59E0B"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p>No divergence data available for the selected timeframe</p>
        </div>
      )}
      
      {data?.marketEvent && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Historical Note: {data.marketEvent}
          </p>
        </div>
      )}
    </ChartBase>
  );
};