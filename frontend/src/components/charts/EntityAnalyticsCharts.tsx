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
  ScatterChart,
  Scatter,
  Cell,
  ComposedChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap
} from 'recharts';
import { ChartBase } from './ChartBase';
import { format, parseISO } from 'date-fns';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  User,
  Hash,
  Target
} from 'lucide-react';

interface EntityData {
  entityName: string;
  entityType: 'company' | 'person' | 'topic' | 'location';
  mentionCount: number;
  sentiment: number;
  trendingScore: number;
  sources: string[];
  dates: string[];
}

interface EntityTrendData {
  date: string;
  [entityName: string]: any;
}

interface EntityComparisonData {
  entityName: string;
  mentionCount: number;
  sentiment: number;
  trendingScore: number;
  recentGrowth: number;
  sourceCount: number;
}

interface EntityAnalyticsChartsProps {
  entities?: EntityData[];
  trendData?: EntityTrendData[];
  comparisonData?: EntityComparisonData[];
  selectedEntities?: string[];
  title?: string;
  subtitle?: string;
  height?: number;
  chartType?: 'mentions' | 'sentiment' | 'comparison' | 'network' | 'distribution';
  entityTypes?: ('company' | 'person' | 'topic' | 'location')[];
  timeframe?: string;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEntityClick?: (entityName: string) => void;
}

const ENTITY_COLORS = {
  company: '#3B82F6',   // Blue
  person: '#10B981',    // Green
  topic: '#F59E0B',     // Yellow
  location: '#EF4444'   // Red
};

const ENTITY_ICONS = {
  company: Building2,
  person: User,
  topic: Hash,
  location: Target
};

const SENTIMENT_COLORS = {
  positive: '#10B981',
  neutral: '#6B7280',
  negative: '#EF4444'
};

export const EntityAnalyticsCharts: React.FC<EntityAnalyticsChartsProps> = ({
  entities = [],
  trendData = [],
  comparisonData = [],
  selectedEntities = [],
  title = "Entity Analytics",
  subtitle,
  height = 400,
  chartType = 'mentions',
  entityTypes = ['company', 'person', 'topic'],
  timeframe = '7d',
  loading = false,
  error = null,
  onRefresh,
  onEntityClick
}) => {
  const processedData = useMemo(() => {
    if (chartType === 'mentions' && trendData.length > 0) {
      return trendData.map(item => ({
        date: item.date,
        formattedDate: format(parseISO(item.date), 'MMM dd'),
        ...Object.keys(item).reduce((acc, key) => {
          if (key !== 'date' && selectedEntities.includes(key)) {
            acc[key] = item[key];
          }
          return acc;
        }, {} as any)
      }));
    }

    if (chartType === 'sentiment') {
      const sentimentData = entities
        .filter(e => entityTypes.includes(e.entityType))
        .map(entity => ({
          entityName: entity.entityName.length > 15 ? 
            entity.entityName.substring(0, 15) + '...' : 
            entity.entityName,
          fullName: entity.entityName,
          entityType: entity.entityType,
          sentiment: entity.sentiment * 100, // Convert to percentage
          mentionCount: entity.mentionCount,
          color: ENTITY_COLORS[entity.entityType],
          sentimentColor: entity.sentiment > 0.2 ? SENTIMENT_COLORS.positive :
                         entity.sentiment < -0.2 ? SENTIMENT_COLORS.negative :
                         SENTIMENT_COLORS.neutral
        }))
        .sort((a, b) => b.mentionCount - a.mentionCount);

      return sentimentData;
    }

    if (chartType === 'comparison' && comparisonData.length > 0) {
      return comparisonData
        .filter(e => selectedEntities.length === 0 || selectedEntities.includes(e.entityName))
        .map(entity => ({
          ...entity,
          entityName: entity.entityName.length > 12 ? 
            entity.entityName.substring(0, 12) + '...' : 
            entity.entityName,
          sentimentPercent: entity.sentiment * 100,
          growthPercent: entity.recentGrowth * 100
        }))
        .sort((a, b) => b.mentionCount - a.mentionCount);
    }

    if (chartType === 'distribution') {
      const distribution = entityTypes.map(type => {
        const typeEntities = entities.filter(e => e.entityType === type);
        const totalMentions = typeEntities.reduce((sum, e) => sum + e.mentionCount, 0);
        const avgSentiment = typeEntities.length > 0 ? 
          typeEntities.reduce((sum, e) => sum + e.sentiment, 0) / typeEntities.length : 0;
        
        return {
          type: type.charAt(0).toUpperCase() + type.slice(1) + 's',
          count: typeEntities.length,
          mentions: totalMentions,
          avgSentiment: avgSentiment * 100,
          color: ENTITY_COLORS[type]
        };
      }).filter(item => item.count > 0);

      return distribution;
    }

    if (chartType === 'network') {
      // Create network data showing entity relationships
      const networkData = entities
        .slice(0, 15)
        .map(entity => {
          const sharedSources = entities.filter(other => 
            other.entityName !== entity.entityName &&
            other.sources.some(source => entity.sources.includes(source))
          ).length;

          return {
            entityName: entity.entityName.length > 10 ? 
              entity.entityName.substring(0, 10) + '...' : 
              entity.entityName,
            fullName: entity.entityName,
            mentionCount: entity.mentionCount,
            sentiment: entity.sentiment * 100,
            connections: sharedSources,
            entityType: entity.entityType,
            color: ENTITY_COLORS[entity.entityType],
            size: Math.max(entity.mentionCount / 10, 5)
          };
        });

      return networkData;
    }

    return [];
  }, [entities, trendData, comparisonData, selectedEntities, chartType, entityTypes]);

  const entityStats = useMemo(() => {
    const totalEntities = entities.length;
    const totalMentions = entities.reduce((sum, e) => sum + e.mentionCount, 0);
    const avgSentiment = entities.length > 0 ? 
      entities.reduce((sum, e) => sum + e.sentiment, 0) / entities.length : 0;
    const topEntity = entities.sort((a, b) => b.mentionCount - a.mentionCount)[0];
    
    return { 
      totalEntities, 
      totalMentions, 
      avgSentiment: avgSentiment * 100,
      topEntity: topEntity?.entityName || 'N/A'
    };
  }, [entities]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 min-w-[250px]">
        <p className="text-sm font-semibold text-foreground mb-3">
          {data.fullName || data.entityName || label}
        </p>
        
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => {
            const IconComponent = ENTITY_ICONS[data.entityType as keyof typeof ENTITY_ICONS];
            
            return (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {IconComponent && <IconComponent className="w-3 h-3" />}
                    <span className="text-sm text-muted-foreground">
                      {entry.name || entry.dataKey}
                    </span>
                  </div>
                  <span className="text-sm font-medium" style={{ color: entry.color }}>
                    {typeof entry.value === 'number' ? 
                      (entry.name?.includes('%') || entry.name?.includes('Sentiment') ? 
                        `${entry.value.toFixed(1)}%` : 
                        entry.value.toLocaleString()
                      ) : 
                      entry.value
                    }
                  </span>
                </div>
              </div>
            );
          })}

          {data.entityType && (
            <div className="flex items-center justify-between border-t pt-2 mt-2">
              <span className="text-sm text-muted-foreground">Type:</span>
              <span className="text-sm font-medium capitalize">{data.entityType}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleBarClick = (data: any) => {
    if (onEntityClick && data.fullName) {
      onEntityClick(data.fullName);
    }
  };

  const renderChart = () => {
    if (chartType === 'mentions' && trendData.length > 0) {
      return (
        <LineChart
          data={processedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={{ value: 'Mentions', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {selectedEntities.slice(0, 6).map((entityName, index) => (
            <Line
              key={entityName}
              type="monotone"
              dataKey={entityName}
              stroke={Object.values(ENTITY_COLORS)[index % Object.values(ENTITY_COLORS).length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5, strokeWidth: 2 }}
              name={entityName.length > 15 ? entityName.substring(0, 15) + '...' : entityName}
            />
          ))}
        </LineChart>
      );
    }

    if (chartType === 'sentiment') {
      return (
        <BarChart
          data={processedData}
          layout="horizontal"
          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          onClick={handleBarClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            type="number" 
            domain={[-100, 100]}
            tick={{ fontSize: 11 }}
            label={{ value: 'Sentiment (%)', position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            type="category" 
            dataKey="entityName" 
            tick={{ fontSize: 10 }}
            width={120}
          />
          <Tooltip content={<CustomTooltip />} />
          
          <Bar 
            dataKey="sentiment" 
            name="Sentiment"
            cursor="pointer"
          >
            {processedData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.sentimentColor} />
            ))}
          </Bar>
        </BarChart>
      );
    }

    if (chartType === 'comparison') {
      return (
        <ScatterChart
          data={processedData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis
            type="number"
            dataKey="mentionCount"
            name="Mentions"
            tick={{ fontSize: 11 }}
            label={{ value: 'Mention Count', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            type="number"
            dataKey="sentimentPercent"
            name="Sentiment"
            domain={[-100, 100]}
            tick={{ fontSize: 11 }}
            label={{ value: 'Sentiment (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />

          <Scatter dataKey="mentionCount" name="Entities">
            {processedData.map((entry: any, index: number) => {
              const size = Math.max(entry.trendingScore * 100, 20);
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.sentimentPercent > 20 ? SENTIMENT_COLORS.positive :
                        entry.sentimentPercent < -20 ? SENTIMENT_COLORS.negative :
                        SENTIMENT_COLORS.neutral}
                  fillOpacity={0.7}
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      );
    }

    if (chartType === 'distribution') {
      return (
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis
            dataKey="type"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="count"
            tick={{ fontSize: 11 }}
            label={{ value: 'Entity Count', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="sentiment"
            orientation="right"
            domain={[-100, 100]}
            tick={{ fontSize: 11 }}
            label={{ value: 'Avg Sentiment (%)', angle: 90, position: 'insideRight' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <Bar 
            yAxisId="count"
            dataKey="count" 
            name="Entity Count"
          >
            {processedData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>

          <Line
            yAxisId="sentiment"
            type="monotone"
            dataKey="avgSentiment"
            stroke="#6B7280"
            strokeWidth={2}
            name="Avg Sentiment"
            dot={{ r: 4, strokeWidth: 2 }}
          />
        </ComposedChart>
      );
    }

    if (chartType === 'network') {
      return (
        <ScatterChart
          data={processedData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis
            type="number"
            dataKey="connections"
            name="Connections"
            tick={{ fontSize: 11 }}
            label={{ value: 'Shared Sources', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            type="number"
            dataKey="mentionCount"
            name="Mentions"
            tick={{ fontSize: 11 }}
            label={{ value: 'Mention Count', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />

          <Scatter dataKey="mentionCount" name="Entities">
            {processedData.map((entry: any, index: number) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                fillOpacity={0.7}
              />
            ))}
          </Scatter>
        </ScatterChart>
      );
    }

    return null;
  };

  const badges = [
    { text: `${entityStats.totalEntities} Entities`, variant: 'default' as const },
    { text: `${entityStats.totalMentions.toLocaleString()} Mentions`, variant: 'secondary' as const },
    { text: `${entityStats.avgSentiment.toFixed(1)}% Avg Sentiment`, variant: 'outline' as const }
  ];

  const getChartIcon = () => {
    switch (chartType) {
      case 'mentions': return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'sentiment': return <TrendingDown className="w-4 h-4 text-green-500" />;
      case 'comparison': return <Target className="w-4 h-4 text-purple-500" />;
      case 'distribution': return <Hash className="w-4 h-4 text-yellow-500" />;
      case 'network': return <Users className="w-4 h-4 text-red-500" />;
      default: return <Users className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} analysis • ${timeframe} timeframe`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
      actions={
        <div className="flex items-center gap-2">
          {getChartIcon()}
        </div>
      }
    >
      {renderChart()}
    </ChartBase>
  );
};