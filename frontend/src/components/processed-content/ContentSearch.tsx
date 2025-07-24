import React from 'react';
import { ModernCard, CardHeader, CardTitle, CardContent } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { SearchInput, ModernSelect } from '@/components/ui/ModernInput';
import { Search } from 'lucide-react';
import { FeedSource } from '@/lib/api';

interface ContentSearchProps {
  searchValue: string;
  sourceId: string;
  dateRange: string;
  feedSources: FeedSource[];
  searchLoading: boolean;
  onSearchChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onDateRangeChange: (value: string) => void;
  onSearch: () => void;
}

export const ContentSearch: React.FC<ContentSearchProps> = ({
  searchValue,
  sourceId,
  dateRange,
  feedSources,
  searchLoading,
  onSearchChange,
  onSourceChange,
  onDateRangeChange,
  onSearch
}) => {
  const sourceOptions = [
    { value: '', label: 'All Sources' },
    ...feedSources.map(source => ({
      value: source.id,
      label: source.name
    }))
  ];

  const dateOptions = [
    { value: '1d', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'all', label: 'All time' }
  ];

  return (
    <ModernCard variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Search Content
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchInput
                placeholder="Search processed content..."
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              />
            </div>
            <ModernButton 
              onClick={onSearch}
              disabled={searchLoading || !searchValue.trim()}
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </ModernButton>
          </div>
          
          <div className="flex gap-4">
            <div className="min-w-[200px]">
              <ModernSelect
                value={sourceId}
                onValueChange={onSourceChange}
                options={sourceOptions}
              />
            </div>
            
            <div className="min-w-[150px]">
              <ModernSelect
                value={dateRange}
                onValueChange={onDateRangeChange}
                options={dateOptions}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );
};