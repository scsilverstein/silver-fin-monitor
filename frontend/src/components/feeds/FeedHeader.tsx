import React from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { SearchInput } from '@/components/ui/ModernInput';
import { Plus, RefreshCw, Filter, Database } from 'lucide-react';

interface FeedHeaderProps {
  searchQuery: string;
  refreshing: boolean;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onAddFeed: () => void;
  onHistoricalBackfill?: () => void;
}

export const FeedHeader: React.FC<FeedHeaderProps> = ({
  searchQuery,
  refreshing,
  onSearchChange,
  onRefresh,
  onAddFeed,
  onHistoricalBackfill
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient">
            Feed Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure and monitor your data sources
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
          {onHistoricalBackfill && (
            <ModernButton
              variant="outline"
              icon={<Database className="h-4 w-4" />}
              onClick={onHistoricalBackfill}
            >
              Historical Data
            </ModernButton>
          )}
          <ModernButton
            variant="gradient"
            icon={<Plus className="h-4 w-4" />}
            onClick={onAddFeed}
          >
            Add Feed
          </ModernButton>
        </div>
      </div>
      
      <div className="flex gap-3">
        <SearchInput
          placeholder="Search feeds..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
        <ModernButton variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </ModernButton>
      </div>
    </div>
  );
};