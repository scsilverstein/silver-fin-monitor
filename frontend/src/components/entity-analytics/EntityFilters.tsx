// Entity Analytics Filters - Advanced filtering for entity data
import React, { useState, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EntityFilter } from '../../types/entityAnalytics';
import { entityAnalyticsService } from '../../services/entityAnalytics';
import { Filter, X, Calendar, TrendingUp, BarChart3 } from 'lucide-react';

interface EntityFiltersProps {
  currentFilter: EntityFilter;
  onFilterChange: (filter: EntityFilter) => void;
  onReset: () => void;
  showAdvanced?: boolean;
}

export const EntityFilters: React.FC<EntityFiltersProps> = ({
  currentFilter,
  onFilterChange,
  onReset,
  showAdvanced = false
}) => {
  const [isExpanded, setIsExpanded] = useState(showAdvanced);

  const entityTypes = [
    { value: 'company', label: 'Companies', icon: '🏢' },
    { value: 'person', label: 'People', icon: '👤' },
    { value: 'ticker', label: 'Tickers', icon: '📈' },
    { value: 'topic', label: 'Topics', icon: '🏷️' },
    { value: 'location', label: 'Locations', icon: '🌍' },
    { value: 'organization', label: 'Organizations', icon: '🏛️' }
  ];

  const sortOptions = [
    { value: 'mentions', label: 'Most Mentions' },
    { value: 'sentiment', label: 'Best Sentiment' },
    { value: 'trending', label: 'Trending' },
    { value: 'recent', label: 'Most Recent' }
  ];

  const timeRangeOptions = entityAnalyticsService.getTimeRangeOptions();

  const handleEntityTypeToggle = useCallback((entityType: string) => {
    const currentTypes = currentFilter.entityTypes || [];
    const newTypes = currentTypes.includes(entityType)
      ? currentTypes.filter(t => t !== entityType)
      : [...currentTypes, entityType];
    
    onFilterChange({
      ...currentFilter,
      entityTypes: newTypes.length > 0 ? newTypes : undefined
    });
  }, [currentFilter, onFilterChange]);

  const handleSentimentRangeChange = useCallback((min: number, max: number) => {
    onFilterChange({
      ...currentFilter,
      sentimentRange: { min, max }
    });
  }, [currentFilter, onFilterChange]);

  const handleTimeRangeChange = useCallback((range: { start: Date; end: Date }) => {
    onFilterChange({
      ...currentFilter,
      dateRange: range
    });
  }, [currentFilter, onFilterChange]);

  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc' = 'desc') => {
    onFilterChange({
      ...currentFilter,
      sortBy: sortBy as any,
      sortOrder
    });
  }, [currentFilter, onFilterChange]);

  const handleMinMentionsChange = useCallback((value: string) => {
    const minMentions = parseInt(value) || undefined;
    onFilterChange({
      ...currentFilter,
      minMentions
    });
  }, [currentFilter, onFilterChange]);

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (currentFilter.entityTypes?.length) count++;
    if (currentFilter.sentimentRange) count++;
    if (currentFilter.dateRange) count++;
    if (currentFilter.minMentions) count++;
    if (currentFilter.trendingOnly) count++;
    if (currentFilter.sources?.length) count++;
    return count;
  }, [currentFilter]);

  const activeFilterCount = getActiveFilterCount();

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <span>Entity Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Less' : 'More'} Filters
            </Button>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Entity Types */}
        <div>
          <label className="text-sm font-medium mb-2 block">Entity Types</label>
          <div className="flex flex-wrap gap-2">
            {entityTypes.map((type) => (
              <Button
                key={type.value}
                variant={currentFilter.entityTypes?.includes(type.value) ? "primary" : "outline"}
                size="sm"
                onClick={() => handleEntityTypeToggle(type.value)}
                className="flex items-center gap-2"
              >
                <span>{type.icon}</span>
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Quick Sort Options */}
        <div>
          <label className="text-sm font-medium mb-2 block">Sort By</label>
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <Button
                key={option.value}
                variant={currentFilter.sortBy === option.value ? "primary" : "outline"}
                size="sm"
                onClick={() => handleSortChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {isExpanded && (
          <>
            {/* Time Range */}
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Time Range
              </label>
              <div className="flex flex-wrap gap-2">
                {timeRangeOptions.map((range, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleTimeRangeChange(range.value)}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sentiment Range */}
            <div>
              <label className="text-sm font-medium mb-2 block">Sentiment Range</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={currentFilter.sentimentRange?.min === 0.2 ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleSentimentRangeChange(0.2, 1)}
                  className="text-green-600"
                >
                  📈 Positive Only
                </Button>
                <Button
                  variant={currentFilter.sentimentRange?.min === -0.1 && currentFilter.sentimentRange?.max === 0.1 ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleSentimentRangeChange(-0.1, 0.1)}
                  className="text-gray-600"
                >
                  ➖ Neutral
                </Button>
                <Button
                  variant={currentFilter.sentimentRange?.max === -0.2 ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleSentimentRangeChange(-1, -0.2)}
                  className="text-red-600"
                >
                  📉 Negative Only
                </Button>
              </div>
            </div>

            {/* Min Mentions */}
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Minimum Mentions
              </label>
              <Input
                type="number"
                placeholder="e.g., 5"
                value={currentFilter.minMentions?.toString() || ''}
                onChange={(e) => handleMinMentionsChange(e.target.value)}
                className="max-w-32"
              />
            </div>

            {/* Trending Only Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={currentFilter.trendingOnly ? "primary" : "outline"}
                size="sm"
                onClick={() => onFilterChange({
                  ...currentFilter,
                  trendingOnly: !currentFilter.trendingOnly
                })}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Trending Only
              </Button>
            </div>
          </>
        )}

        {/* Active Filters Summary */}
        {activeFilterCount > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <span>Active filters:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentFilter.entityTypes?.map((type) => (
                <Badge key={type} variant="secondary" className="flex items-center gap-1">
                  {entityTypes.find(t => t.value === type)?.icon}
                  {entityTypes.find(t => t.value === type)?.label}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-red-500" 
                    onClick={() => handleEntityTypeToggle(type)}
                  />
                </Badge>
              ))}
              
              {currentFilter.sentimentRange && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Sentiment: {currentFilter.sentimentRange.min} to {currentFilter.sentimentRange.max}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-red-500" 
                    onClick={() => onFilterChange({ ...currentFilter, sentimentRange: undefined })}
                  />
                </Badge>
              )}
              
              {currentFilter.minMentions && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Min {currentFilter.minMentions} mentions
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-red-500" 
                    onClick={() => onFilterChange({ ...currentFilter, minMentions: undefined })}
                  />
                </Badge>
              )}
              
              {currentFilter.trendingOnly && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Trending Only
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-red-500" 
                    onClick={() => onFilterChange({ ...currentFilter, trendingOnly: false })}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};