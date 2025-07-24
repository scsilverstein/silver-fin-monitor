import React, { useMemo } from 'react';
import { ChartBase } from './ChartBase';
import { AlertTriangle, Calendar, Info } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth } from 'date-fns';

interface AnomalyData {
  date: string;
  anomalies: {
    sentimentAnomaly: number; // 0-1 scale
    volumeAnomaly: number;
    topicAnomaly: number;
    entityAnomaly: number;
    velocityAnomaly: number;
  };
  events?: string[];
  totalAnomalyScore?: number;
}

interface AnomalyHeatmapCalendarProps {
  data: AnomalyData[];
  selectedMonth?: Date;
  anomalyType?: keyof AnomalyData['anomalies'] | 'total';
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onDateClick?: (date: string, data: AnomalyData) => void;
}

export const AnomalyHeatmapCalendar: React.FC<AnomalyHeatmapCalendarProps> = ({
  data,
  selectedMonth = new Date(),
  anomalyType = 'total',
  title = "Anomaly Detection Calendar",
  subtitle,
  height = 400,
  loading = false,
  error = null,
  onRefresh,
  onDateClick
}) => {
  const { calendarData, stats, highAnomalyDays } = useMemo(() => {
    if (!data.length) return { calendarData: [], stats: null, highAnomalyDays: [] };

    // Create a map for quick lookup
    const dataMap = new Map<string, AnomalyData>();
    data.forEach(item => {
      // Calculate total anomaly score if not provided
      if (!item.totalAnomalyScore) {
        item.totalAnomalyScore = Object.values(item.anomalies).reduce((sum, val) => sum + val, 0) / 5;
      }
      dataMap.set(item.date.split('T')[0], item);
    });

    // Generate calendar days
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding days from previous/next month
    const startPadding = getDay(monthStart);
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(calendarStart.getDate() - startPadding);
    
    const allDays = eachDayOfInterval({ 
      start: calendarStart, 
      end: new Date(monthEnd.getTime() + (6 - getDay(monthEnd)) * 24 * 60 * 60 * 1000)
    });

    const calendarData = allDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayData = dataMap.get(dateStr);
      const value = dayData ? 
        (anomalyType === 'total' ? dayData.totalAnomalyScore! : dayData.anomalies[anomalyType]) : 0;
      
      return {
        date: day,
        dateStr,
        value,
        data: dayData,
        isCurrentMonth: isSameMonth(day, selectedMonth),
        dayOfWeek: getDay(day),
        weekOfMonth: Math.floor((day.getDate() + startPadding - 1) / 7)
      };
    });

    // Calculate statistics
    const monthData = data.filter(d => {
      const date = new Date(d.date);
      return isSameMonth(date, selectedMonth);
    });

    const anomalyValues = monthData.map(d => 
      anomalyType === 'total' ? d.totalAnomalyScore! : d.anomalies[anomalyType]
    );

    const stats = anomalyValues.length > 0 ? {
      avg: anomalyValues.reduce((a, b) => a + b, 0) / anomalyValues.length,
      max: Math.max(...anomalyValues),
      min: Math.min(...anomalyValues),
      std: calculateStdDev(anomalyValues)
    } : null;

    // Find high anomaly days (> 2 std dev from mean)
    const highAnomalyDays = monthData
      .filter(d => {
        const value = anomalyType === 'total' ? d.totalAnomalyScore! : d.anomalies[anomalyType];
        return stats && value > stats.avg + 2 * stats.std;
      })
      .sort((a, b) => {
        const aVal = anomalyType === 'total' ? a.totalAnomalyScore! : a.anomalies[anomalyType];
        const bVal = anomalyType === 'total' ? b.totalAnomalyScore! : b.anomalies[anomalyType];
        return bVal - aVal;
      })
      .slice(0, 5);

    return { calendarData, stats, highAnomalyDays };
  }, [data, selectedMonth, anomalyType]);

  const getColor = (value: number, stats: any) => {
    if (!stats || value === 0) return 'bg-gray-100 dark:bg-gray-800';
    
    const normalized = (value - stats.min) / (stats.max - stats.min);
    
    if (normalized > 0.9) return 'bg-red-600 dark:bg-red-700';
    if (normalized > 0.75) return 'bg-red-500 dark:bg-red-600';
    if (normalized > 0.6) return 'bg-orange-500 dark:bg-orange-600';
    if (normalized > 0.4) return 'bg-yellow-500 dark:bg-yellow-600';
    if (normalized > 0.2) return 'bg-yellow-400 dark:bg-yellow-500';
    return 'bg-green-200 dark:bg-green-800';
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const anomalyTypeLabels = {
    sentimentAnomaly: 'Sentiment',
    volumeAnomaly: 'Volume',
    topicAnomaly: 'Topics',
    entityAnomaly: 'Entities',
    velocityAnomaly: 'Velocity',
    total: 'Overall'
  };

  const badges = [
    {
      text: anomalyTypeLabels[anomalyType],
      variant: 'secondary' as const,
      icon: <Info className="w-3 h-3" />
    }
  ];

  if (stats) {
    badges.push({
      text: `Avg: ${stats.avg.toFixed(2)}`,
      variant: 'secondary' as const
    });
  }

  if (highAnomalyDays.length > 0) {
    badges.push({
      text: `${highAnomalyDays.length} High Anomaly Days`,
      variant: 'destructive' as const,
      icon: <AlertTriangle className="w-3 h-3" />
    });
  }

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || format(selectedMonth, 'MMMM yyyy')}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
    >
      <div className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarData.map((day, index) => (
            <div
              key={index}
              onClick={() => day.data && onDateClick?.(day.dateStr, day.data)}
              className={`
                aspect-square rounded-lg p-2 cursor-pointer transition-all
                ${day.isCurrentMonth ? '' : 'opacity-30'}
                ${getColor(day.value, stats)}
                ${day.data?.events?.length ? 'ring-2 ring-purple-500' : ''}
                hover:scale-105 hover:shadow-lg
              `}
            >
              <div className="text-xs font-medium">
                {format(day.date, 'd')}
              </div>
              {day.data && day.value > 0 && (
                <div className="text-xs mt-1">
                  {(day.value * 100).toFixed(0)}%
                </div>
              )}
              {day.data?.events && day.data.events.length > 0 && (
                <div className="mt-1">
                  <Calendar className="w-3 h-3 text-purple-600" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-200 dark:bg-green-800 rounded" />
              <span className="text-xs text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 dark:bg-yellow-600 rounded" />
              <span className="text-xs text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-600 dark:bg-red-700 rounded" />
              <span className="text-xs text-muted-foreground">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 ring-2 ring-purple-500 rounded" />
              <span className="text-xs text-muted-foreground">Event</span>
            </div>
          </div>
        </div>

        {/* High anomaly days list */}
        {highAnomalyDays.length > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              High Anomaly Days
            </h4>
            <div className="space-y-2">
              {highAnomalyDays.map(day => (
                <div key={day.date} className="text-sm">
                  <span className="font-medium">{format(new Date(day.date), 'MMM d')}:</span>
                  <span className="ml-2">
                    {((anomalyType === 'total' ? day.totalAnomalyScore! : day.anomalies[anomalyType]) * 100).toFixed(0)}% anomaly
                  </span>
                  {day.events && day.events.length > 0 && (
                    <span className="ml-2 text-purple-600 dark:text-purple-400">
                      ({day.events.join(', ')})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ChartBase>
  );
};

function calculateStdDev(values: number[]): number {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}