// Entity Comparison Chart - Compare multiple entities side by side
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
  BarChart,
  Bar
} from 'recharts';
import { EntityComparisonChartData } from '../../types/entityAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { entityAnalyticsService } from '../../services/entityAnalytics';

interface EntityComparisonChartProps {
  data: EntityComparisonChartData[];
  entities: string[];
  metric: 'mentions' | 'sentiment' | 'trending';
  chartType?: 'line' | 'bar';
  height?: number;
  timeRange?: string;
}

export const EntityComparisonChart: React.FC<EntityComparisonChartProps> = ({
  data,
  entities,
  metric,
  chartType = 'line',
  height = 400,
  timeRange = 'Last 30 days'
}) => {
  // Generate colors for entities
  const entityColors = useMemo(() => {
    const colors = [
      '#3b82f6', // Blue
      '#ef4444', // Red  
      '#10b981', // Green
      '#8b5cf6', // Purple
      '#f59e0b', // Amber
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316', // Orange
      '#ec4899', // Pink
      '#6b7280'  // Gray
    ];
    
    const entityColorMap: Record<string, string> = {};
    entities.forEach((entity, index) => {
      entityColorMap[entity] = colors[index % colors.length];
    });
    
    return entityColorMap;
  }, [entities]);

  // Format data for display
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      formattedDate: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }));
  }, [data]);

  // Get metric label and unit
  const metricInfo = useMemo(() => {
    switch (metric) {
      case 'mentions':
        return { label: 'Mentions', unit: '', yAxisLabel: 'Number of Mentions' };
      case 'sentiment':
        return { label: 'Sentiment', unit: '%', yAxisLabel: 'Sentiment Score (%)' };
      case 'trending':
        return { label: 'Trending Score', unit: '', yAxisLabel: 'Trending Score' };
      default:
        return { label: 'Value', unit: '', yAxisLabel: 'Value' };
    }
  }, [metric]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 max-w-sm">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-sm">
              {entry.dataKey}: {entry.value}{metricInfo.unit}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-500">No comparison data available</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your time range or entity selection</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getYAxisDomain = () => {
    if (metric === 'sentiment') {
      return [-100, 100];
    }
    return undefined;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Entity Comparison - {metricInfo.label}</span>
          <span className="text-sm font-normal text-gray-500">{timeRange}</span>
        </CardTitle>
        
        {/* Entity Legend */}
        <div className="flex flex-wrap gap-4 mt-2">
          {entities.map((entity) => (
            <div key={entity} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: entityColors[entity] }}
              ></div>
              <span className="text-sm font-medium">{entity}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="formattedDate" 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
                label={{ 
                  value: metricInfo.yAxisLabel, 
                  angle: -90, 
                  position: 'insideLeft' 
                }}
                domain={getYAxisDomain()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {entities.map((entity) => (
                <Line
                  key={entity}
                  type="monotone"
                  dataKey={entity}
                  stroke={entityColors[entity]}
                  strokeWidth={2}
                  dot={{ fill: entityColors[entity], strokeWidth: 2, r: 4 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="formattedDate" 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
                label={{ 
                  value: metricInfo.yAxisLabel, 
                  angle: -90, 
                  position: 'insideLeft' 
                }}
                domain={getYAxisDomain()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {entities.map((entity) => (
                <Bar
                  key={entity}
                  dataKey={entity}
                  fill={entityColors[entity]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>

        {/* Summary Statistics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {entities.map((entity) => {
            const entityData = data.map(d => d[entity] as number).filter(v => v !== undefined);
            const avg = entityData.length > 0 ? entityData.reduce((sum, v) => sum + v, 0) / entityData.length : 0;
            const max = entityData.length > 0 ? Math.max(...entityData) : 0;
            const trend = entityData.length >= 2 ? (entityData[entityData.length - 1] - entityData[0]) : 0;

            return (
              <div key={entity} className="p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: entityColors[entity] }}
                  ></div>
                  <span className="font-medium text-sm">{entity}</span>
                </div>
                
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average:</span>
                    <span className="font-medium">{avg.toFixed(1)}{metricInfo.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Peak:</span>
                    <span className="font-medium">{max.toFixed(1)}{metricInfo.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Change:</span>
                    <span className={`font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trend >= 0 ? '+' : ''}{trend.toFixed(1)}{metricInfo.unit}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};