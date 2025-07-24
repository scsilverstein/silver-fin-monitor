import React from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { SearchInput } from '@/components/ui/ModernInput';
import { ModernSelect } from '@/components/ui/ModernSelect';
import { RefreshCw, Plus, Calendar } from 'lucide-react';

interface AnalysisHeaderProps {
  searchQuery: string;
  refreshing: boolean;
  dateRange?: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onDateRangeChange?: (value: string) => void;
  onGenerateAnalysis?: () => void;
}

export const AnalysisHeader: React.FC<AnalysisHeaderProps> = ({
  searchQuery,
  refreshing,
  dateRange = 'all',
  onSearchChange,
  onRefresh,
  onDateRangeChange,
  onGenerateAnalysis
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient">
            Daily Analyses
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-generated market analyses with predictions
          </p>
        </div>
        
        <div className="flex gap-3">
          {onGenerateAnalysis && (
            <ModernButton
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={onGenerateAnalysis}
            >
              Generate Analysis
            </ModernButton>
          )}
          <ModernButton
            variant="outline"
            icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={onRefresh}
            disabled={refreshing}
          >
            Refresh
          </ModernButton>
        </div>
      </div>
      
      <div className="flex gap-3 items-center">
        <SearchInput
          placeholder="Search analyses..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
        
        {onDateRangeChange && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <ModernSelect
              value={dateRange}
              onValueChange={onDateRangeChange}
              options={[
                { value: 'all', label: 'All time' },
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
                { value: '90d', label: 'Last 90 days' }
              ]}
              className="min-w-[150px]"
            />
          </div>
        )}
      </div>
    </div>
  );
};