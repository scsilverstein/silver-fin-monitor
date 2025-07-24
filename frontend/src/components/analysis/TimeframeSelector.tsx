import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Timeframe, TimeframeQuery, TimeframePeriod } from '@/lib/api';
import { analysisApi } from '@/lib/api';

interface TimeframeSelectorProps {
  selectedTimeframe: TimeframeQuery;
  onTimeframeChange: (timeframe: TimeframeQuery) => void;
  className?: string;
}

const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({
  selectedTimeframe,
  onTimeframeChange,
  className = ''
}) => {
  const [availableTimeframes, setAvailableTimeframes] = useState<Timeframe[]>([]);
  const [loading, setLoading] = useState(false);
  const [customRange, setCustomRange] = useState({
    start: selectedTimeframe.startDate || '',
    end: selectedTimeframe.endDate || ''
  });

  // Load available timeframes on mount
  useEffect(() => {
    const loadTimeframes = async () => {
      try {
        setLoading(true);
        const timeframes = await analysisApi.getAvailableTimeframes();
        setAvailableTimeframes(timeframes);
      } catch (error) {
        console.error('Failed to load timeframes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTimeframes();
  }, []);

  // Handle preset timeframe selection
  const handlePresetSelection = (timeframe: Timeframe) => {
    const query: TimeframeQuery = {
      period: timeframe.id as TimeframePeriod,
      ...(timeframe.value && { days: timeframe.value })
    };
    onTimeframeChange(query);
  };

  // Handle custom range changes
  const handleCustomRangeChange = (field: 'start' | 'end', value: string) => {
    const newRange = { ...customRange, [field]: value };
    setCustomRange(newRange);

    if (newRange.start && newRange.end) {
      const query: TimeframeQuery = {
        period: 'custom',
        startDate: newRange.start,
        endDate: newRange.end
      };
      onTimeframeChange(query);
    }
  };

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Analysis Timeframe
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Select the time period for market analysis
          </p>
        </div>

        {/* Quick Preset Options */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Quick Options
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {availableTimeframes
              .filter(tf => tf.type === 'preset')
              .map((timeframe) => (
                <Button
                  key={timeframe.id}
                  variant={selectedTimeframe.period === timeframe.id ? 'primary' : 'outline'}
                  onClick={() => handlePresetSelection(timeframe)}
                  className="flex flex-col items-center p-4 h-auto space-y-2 relative"
                >
                  {timeframe.isDefault && (
                    <Badge className="absolute -top-2 -right-2 text-xs">
                      Default
                    </Badge>
                  )}
                  
                  <span className="text-lg">{timeframe.icon}</span>
                  
                  <div className="text-center">
                    <div className="font-medium">{timeframe.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {timeframe.description}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground text-center">
                    {timeframe.useCase}
                  </div>
                </Button>
              ))}
          </div>
        </div>

        {/* Custom Date Range */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Custom Date Range
          </h4>
          
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => handleCustomRangeChange('start', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="text-gray-400 mt-5">to</div>
            
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => handleCustomRangeChange('end', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                min={customRange.start}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {selectedTimeframe.period === 'custom' && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">Custom Analysis:</span>{' '}
                {selectedTimeframe.startDate && selectedTimeframe.endDate && (
                  <>
                    {new Date(selectedTimeframe.startDate).toLocaleDateString()} - {' '}
                    {new Date(selectedTimeframe.endDate).toLocaleDateString()}
                    {' '}({Math.ceil((new Date(selectedTimeframe.endDate).getTime() - new Date(selectedTimeframe.startDate).getTime()) / (1000 * 60 * 60 * 24))} days)
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Selected Timeframe Info */}
        {selectedTimeframe.period !== 'custom' && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Selected:</span>{' '}
              {availableTimeframes.find(tf => tf.id === selectedTimeframe.period)?.label || selectedTimeframe.period}
              {' '}
              <span className="text-gray-500">
                - {availableTimeframes.find(tf => tf.id === selectedTimeframe.period)?.useCase}
              </span>
            </div>
          </div>
        )}

        {/* Analysis Tips */}
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div>💡 <strong>Tips:</strong></div>
          <div>• Today: Real-time market sentiment</div>
          <div>• 7 Days: Short-term trend identification</div>
          <div>• 30 Days: Monthly patterns and cycles</div>
          <div>• 90 Days: Quarterly outlook and long-term trends</div>
        </div>
      </div>
    </Card>
  );
};

export default TimeframeSelector; 