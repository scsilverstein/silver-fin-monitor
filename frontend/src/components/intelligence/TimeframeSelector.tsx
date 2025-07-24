import React from 'react';
import { Button } from '@/components/ui/Button';

interface TimeframeSelectorProps {
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

const timeframes = [
  { value: '1d', label: '1D' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

export const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({
  selectedTimeframe,
  onTimeframeChange,
}) => {
  return (
    <div className="flex items-center gap-2">
      {timeframes.map(({ value, label }) => (
        <Button
          key={value}
          variant={selectedTimeframe === value ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onTimeframeChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
};