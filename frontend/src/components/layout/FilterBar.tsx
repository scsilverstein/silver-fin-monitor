import React from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernBadge } from '@/components/ui/ModernBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterDefinition {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'search' | 'date' | 'range';
  options?: FilterOption[];
  value?: string | string[];
  placeholder?: string;
  clearable?: boolean;
}

interface FilterBarProps {
  searchQuery?: string;
  searchPlaceholder?: string;
  onSearchChange?: (query: string) => void;
  filters?: FilterDefinition[];
  onFilterChange?: (key: string, value: any) => void;
  onClearFilters?: () => void;
  activeFiltersCount?: number;
  showFilterToggle?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  searchPlaceholder = "Search...",
  onSearchChange,
  filters = [],
  onFilterChange,
  onClearFilters,
  activeFiltersCount = 0,
  showFilterToggle = false,
  collapsed = false,
  onToggleCollapse,
  className,
  children
}) => {
  const renderFilter = (filter: FilterDefinition) => {
    switch (filter.type) {
      case 'select':
        return (
          <Select
            value={filter.value as string}
            onValueChange={(value) => onFilterChange?.(filter.key, value)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder={filter.placeholder || filter.label} />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center justify-between w-full">
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <ModernBadge variant="outline" className="ml-2">
                        {option.count}
                      </ModernBadge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'search':
        return (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={filter.placeholder || filter.label}
              value={filter.value as string}
              onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main filter row */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        {/* Search */}
        {onSearchChange && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          {showFilterToggle && (
            <ModernButton
              variant="outline"
              size="sm"
              onClick={onToggleCollapse}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <ModernBadge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </ModernBadge>
              )}
              <ChevronDown className={cn(
                "h-4 w-4 ml-2 transition-transform",
                collapsed && "rotate-180"
              )} />
            </ModernButton>
          )}

          {activeFiltersCount > 0 && onClearFilters && (
            <ModernButton
              variant="outline"
              size="sm"
              onClick={onClearFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear ({activeFiltersCount})
            </ModernButton>
          )}
        </div>
      </div>

      {/* Filter options */}
      {!collapsed && filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/20 rounded-lg border border-dashed">
          {filters.map((filter) => (
            <div key={filter.key} className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {filter.label}:
              </span>
              {renderFilter(filter)}
            </div>
          ))}
        </div>
      )}

      {/* Active filters display */}
      {activeFiltersCount > 0 && !collapsed && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {filters
            .filter(filter => filter.value && filter.value !== '')
            .map((filter) => (
              <ModernBadge
                key={filter.key}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => onFilterChange?.(filter.key, '')}
              >
                {filter.label}: {
                  Array.isArray(filter.value) 
                    ? filter.value.join(', ') 
                    : filter.options?.find(opt => opt.value === filter.value)?.label || filter.value
                }
                <X className="h-3 w-3 ml-1" />
              </ModernBadge>
            ))}
        </div>
      )}

      {/* Custom children */}
      {children}
    </div>
  );
};

// Utility function to create filter definitions
export const createFilter = {
  select: (
    key: string,
    label: string,
    options: FilterOption[],
    value?: string,
    placeholder?: string
  ): FilterDefinition => ({
    key,
    label,
    type: 'select',
    options,
    value,
    placeholder
  }),

  search: (
    key: string,
    label: string,
    value?: string,
    placeholder?: string
  ): FilterDefinition => ({
    key,
    label,
    type: 'search',
    value,
    placeholder
  })
};