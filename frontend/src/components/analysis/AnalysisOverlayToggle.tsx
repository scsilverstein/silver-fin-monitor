import React from 'react';
import { Clock, TrendingUp, Calendar } from 'lucide-react';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernSelect } from '@/components/ui/ModernSelect';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface AnalysisOverlayToggleProps {
  showTimeReferences: boolean;
  showMarketMovements: boolean;
  onToggleTimeReferences: () => void;
  onToggleMarketMovements: () => void;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

export const AnalysisOverlayToggle: React.FC<AnalysisOverlayToggleProps> = ({
  showTimeReferences,
  showMarketMovements,
  onToggleTimeReferences,
  onToggleMarketMovements,
  selectedTimeframe,
  onTimeframeChange
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
      {/* Toggle Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="time-references"
            checked={showTimeReferences}
            onCheckedChange={onToggleTimeReferences}
          />
          <Label 
            htmlFor="time-references" 
            className="flex items-center gap-2 cursor-pointer"
          >
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>Time References</span>
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="market-movements"
            checked={showMarketMovements}
            onCheckedChange={onToggleMarketMovements}
          />
          <Label 
            htmlFor="market-movements" 
            className="flex items-center gap-2 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span>Market Movements</span>
          </Label>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center gap-2 ml-auto">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <ModernSelect
          value={selectedTimeframe}
          onValueChange={onTimeframeChange}
          options={[
            { value: '7d', label: 'Last 7 Days' },
            { value: '30d', label: 'Last 30 Days' },
            { value: '90d', label: 'Last 90 Days' },
            { value: '1y', label: 'Last Year' }
          ]}
          placeholder="Select timeframe"
        />
      </div>
    </div>
  );
};