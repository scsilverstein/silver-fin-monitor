import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  ModernSelectRoot as Select,
  ModernSelectContent as SelectContent,
  ModernSelectItem as SelectItem,
  ModernSelectTrigger as SelectTrigger,
  ModernSelectValue as SelectValue 
} from '@/components/ui/ModernSelect';

interface PredictionsFiltersProps {
  selectedHorizon: string;
  selectedType: string;
  availableHorizons: string[];
  availableTypes: string[];
  onHorizonChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  getHorizonLabel: (horizon: string) => string;
  getTypeLabel: (type: string) => string;
  onReset?: () => void;
}

export const PredictionsFilters: React.FC<PredictionsFiltersProps> = ({
  selectedHorizon,
  selectedType,
  availableHorizons,
  availableTypes,
  onHorizonChange,
  onTypeChange,
  getHorizonLabel,
  getTypeLabel,
  onReset
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filters</CardTitle>
          {onReset && (
            <button 
              onClick={onReset}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Time Horizon</label>
            <Select value={selectedHorizon} onValueChange={onHorizonChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select time horizon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Horizons</SelectItem>
                {availableHorizons.map(horizon => (
                  <SelectItem key={horizon} value={horizon}>
                    {getHorizonLabel(horizon)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Prediction Type</label>
            <Select value={selectedType} onValueChange={onTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {availableTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {getTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};