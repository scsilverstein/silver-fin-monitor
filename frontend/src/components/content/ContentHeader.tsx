import React from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { SearchInput } from '@/components/ui/ModernInput';
import { ModernSelect } from '@/components/ui/ModernSelect';
import { RefreshCw, Filter, Calendar } from 'lucide-react';

interface ContentHeaderProps {
  searchQuery: string;
  refreshing: boolean;
  timeframe?: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onTimeframeChange?: (value: string) => void;
}

export const ContentHeader: React.FC<ContentHeaderProps> = ({
  searchQuery,
  refreshing,
  timeframe = 'all',
  onSearchChange,
  onRefresh,
  onTimeframeChange
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient">
            Processed Content
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-analyzed content with insights and entities
          </p>
        </div>
        
        <div className="flex gap-3">
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
          placeholder="Search content..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
        
        {onTimeframeChange && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <ModernSelect
              value={timeframe}
              onValueChange={onTimeframeChange}
              options={[
                { value: '1d', label: 'Last 24 hours' },
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
                { value: 'all', label: 'All time' }
              ]}
              className="min-w-[150px]"
            />
          </div>
        )}
        
        <ModernButton variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </ModernButton>
      </div>
    </div>
  );
};