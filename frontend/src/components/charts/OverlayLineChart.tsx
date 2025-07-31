import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
  Label
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface TimeSeriesData {
  date: string;
  sentiment: number;
  confidence: number;
  volatility?: number;
  sources?: number;
}

interface OverlayLineChartProps {
  data: TimeSeriesData[];
  height?: number;
  showTimeReferences: boolean;
  showMarketMovements: boolean;
  onDataPointClick?: (data: TimeSeriesData) => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  showTimeReferences: boolean;
  showMarketMovements: boolean;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  showTimeReferences,
  showMarketMovements
}) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload as TimeSeriesData;
  const sentimentValue = data.sentiment;
  const sentimentLabel = sentimentValue > 0 ? 'Bullish' : sentimentValue < 0 ? 'Bearish' : 'Neutral';
  const sentimentColor = sentimentValue > 0 ? 'text-green-600' : sentimentValue < 0 ? 'text-red-600' : 'text-gray-600';

  return (
    <Card className="p-3 shadow-lg border bg-background/95 backdrop-blur">
      <div className="space-y-2">
        {showTimeReferences && (
          <div className="text-sm font-medium">
            {format(parseISO(label || ''), 'MMM dd, yyyy')}
          </div>
        )}
        
        {showMarketMovements && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sentiment:</span>
            <span className={cn("text-sm font-medium", sentimentColor)}>
              {sentimentLabel}
            </span>
          </div>
        )}
        
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <span className="text-sm font-medium">
              {(data.confidence * 100).toFixed(1)}%
            </span>
          </div>
          
          {data.volatility !== undefined && showMarketMovements && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">Volatility:</span>
              <span className="text-sm font-medium">
                {(data.volatility * 100).toFixed(1)}%
              </span>
            </div>
          )}
          
          {data.sources !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">Sources:</span>
              <span className="text-sm font-medium">{data.sources}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: TimeSeriesData;
  showMarketMovements: boolean;
  onClick?: (data: TimeSeriesData) => void;
}

const CustomDot: React.FC<CustomDotProps> = ({ 
  cx, 
  cy, 
  payload, 
  showMarketMovements,
  onClick 
}) => {
  if (!cx || !cy || !payload) return null;

  const sentiment = payload.sentiment;
  const isSignificant = Math.abs(sentiment) > 0.5 || payload.confidence > 0.8;

  if (!isSignificant && !showMarketMovements) return null;

  const color = sentiment > 0 ? '#10b981' : sentiment < 0 ? '#ef4444' : '#6b7280';
  const size = isSignificant ? 6 : 4;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={size}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
        className="cursor-pointer hover:r-8 transition-all"
        onClick={() => onClick?.(payload)}
      />
      {isSignificant && showMarketMovements && (
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fontSize={10}
          fill={color}
          className="font-medium"
        >
          {sentiment > 0 ? '▲' : sentiment < 0 ? '▼' : '●'}
        </text>
      )}
    </g>
  );
};

export const OverlayLineChart: React.FC<OverlayLineChartProps> = ({
  data,
  height = 400,
  showTimeReferences,
  showMarketMovements,
  onDataPointClick
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  // Calculate significant events for callouts
  const significantEvents = useMemo(() => {
    return data.filter(d => 
      Math.abs(d.sentiment) > 0.7 || 
      d.confidence > 0.85 ||
      (d.volatility && d.volatility > 0.3)
    );
  }, [data]);

  // Format axis tick
  const formatXAxisTick = (value: string) => {
    if (!showTimeReferences) return '';
    try {
      return format(parseISO(value), 'MMM dd');
    } catch {
      return value;
    }
  };

  const formatYAxisTick = (value: number) => {
    if (!showMarketMovements) return '';
    if (value > 0) return 'Bull';
    if (value < 0) return 'Bear';
    return 'Neutral';
  };

  return (
    <div className="w-full relative">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            className="stroke-muted/20"
            vertical={false}
          />
          
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxisTick}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-muted-foreground"
            hide={!showTimeReferences}
          />
          
          <YAxis
            domain={[-1, 1]}
            tickFormatter={formatYAxisTick}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-muted-foreground"
            hide={!showMarketMovements}
          />
          
          <Tooltip
            content={
              <CustomTooltip
                showTimeReferences={showTimeReferences}
                showMarketMovements={showMarketMovements}
              />
            }
          />
          
          {/* Reference lines */}
          {showMarketMovements && (
            <>
              <ReferenceLine 
                y={0} 
                stroke="currentColor" 
                strokeDasharray="3 3"
                className="stroke-muted-foreground/50"
              >
                <Label 
                  value="Neutral" 
                  position="right" 
                  className="fill-muted-foreground text-xs"
                />
              </ReferenceLine>
              
              <ReferenceLine 
                y={0.5} 
                stroke="#10b981" 
                strokeDasharray="3 3"
                strokeOpacity={0.3}
              />
              
              <ReferenceLine 
                y={-0.5} 
                stroke="#ef4444" 
                strokeDasharray="3 3"
                strokeOpacity={0.3}
              />
            </>
          )}
          
          {/* Sentiment line */}
          <Line
            type="monotone"
            dataKey="sentiment"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={
              <CustomDot 
                showMarketMovements={showMarketMovements}
                onClick={onDataPointClick}
              />
            }
            activeDot={{
              r: 8,
              stroke: '#3b82f6',
              strokeWidth: 2,
              fill: '#fff'
            }}
          />
          
          {/* Confidence line (secondary) */}
          {showMarketMovements && (
            <Line
              type="monotone"
              dataKey="confidence"
              stroke="#a78bfa"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              opacity={0.6}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Data callouts for significant events */}
      {showMarketMovements && significantEvents.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Key Events & Insights
          </div>
          <div className="flex flex-wrap gap-2">
            {significantEvents.slice(0, 5).map((event, index) => (
              <Badge
                key={index}
                variant={
                  event.sentiment > 0 ? 'success' : 
                  event.sentiment < 0 ? 'destructive' : 
                  'secondary'
                }
                className="cursor-pointer"
                onClick={() => onDataPointClick?.(event)}
              >
                {showTimeReferences && format(parseISO(event.date), 'MMM dd')}
                {showTimeReferences && showMarketMovements && ' - '}
                {showMarketMovements && (
                  event.sentiment > 0 ? 'Bullish Signal' : 
                  event.sentiment < 0 ? 'Bearish Signal' : 
                  'High Confidence'
                )}
              </Badge>
            ))}
            {significantEvents.length > 5 && (
              <Badge variant="outline">
                +{significantEvents.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};