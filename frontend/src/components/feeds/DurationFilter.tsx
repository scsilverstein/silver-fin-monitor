import React from 'react';
import { cn } from '@/lib/utils';

export type DurationOption = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';

interface DurationFilterProps {
  selected: DurationOption;
  onChange: (duration: DurationOption) => void;
  className?: string;
}

const durationOptions: { value: DurationOption; label: string }[] = [
  { value: '1h', label: '1 Hour' },
  { value: '6h', label: '6 Hours' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];

export const DurationFilter: React.FC<DurationFilterProps> = ({
  selected,
  onChange,
  className
}) => {
  return (
    <div className={cn("inline-flex items-center gap-1 p-1 bg-background/50 backdrop-blur-sm border rounded-lg", className)}>
      {durationOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
            "hover:bg-background/80",
            selected === option.value
              ? "bg-gradient-to-r from-primary to-primary-foreground text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};