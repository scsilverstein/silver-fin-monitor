import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { SearchInput, ModernSelect } from '@/components/ui/ModernInput';
import { ModernButton } from '@/components/ui/ModernButton';
import { Filter, SortAsc, RotateCcw } from 'lucide-react';
import { SortOption, PriorityFilter, TimeFilter } from '@/hooks/useQueueFilters';

interface QueueFiltersProps {
  statusFilter: string;
  jobTypeFilter: string;
  priorityFilter: PriorityFilter;
  timeFilter: TimeFilter;
  searchQuery: string;
  sortBy: SortOption;
  availableStatuses: string[];
  availableJobTypes: string[];
  onStatusChange: (value: string) => void;
  onJobTypeChange: (value: string) => void;
  onPriorityChange: (value: PriorityFilter) => void;
  onTimeFilterChange: (value: TimeFilter) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  getStatusLabel: (status: string) => string;
  getJobTypeLabel: (type: string) => string;
  getStatusBadgeColor: (status: string) => string;
  getSortLabel: (sort: SortOption) => string;
  getTimeFilterLabel: (timeFilter: TimeFilter) => string;
  onReset?: () => void;
}

export const QueueFilters: React.FC<QueueFiltersProps> = ({
  statusFilter,
  jobTypeFilter,
  priorityFilter,
  timeFilter,
  searchQuery,
  sortBy,
  availableStatuses,
  availableJobTypes,
  onStatusChange,
  onJobTypeChange,
  onPriorityChange,
  onTimeFilterChange,
  onSearchChange,
  onSortChange,
  getStatusLabel,
  getJobTypeLabel,
  getStatusBadgeColor,
  getSortLabel,
  getTimeFilterLabel,
  onReset
}) => {
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    ...availableStatuses.map(status => ({
      value: status,
      label: getStatusLabel(status)
    }))
  ];

  const jobTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...availableJobTypes.map(type => ({
      value: type,
      label: getJobTypeLabel(type)
    }))
  ];

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'high', label: 'High Priority (1-3)' },
    { value: 'medium', label: 'Medium Priority (4-6)' },
    { value: 'low', label: 'Low Priority (7+)' }
  ];

  const timeFilterOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'last_hour', label: 'Last Hour' },
    { value: 'last_6_hours', label: 'Last 6 Hours' },
    { value: 'last_day', label: 'Last 24 Hours' },
    { value: 'last_week', label: 'Last Week' }
  ];

  const sortOptions = [
    { value: 'createdAt_desc', label: 'Created (Newest First)' },
    { value: 'createdAt_asc', label: 'Created (Oldest First)' },
    { value: 'scheduledAt_desc', label: 'Scheduled (Latest First)' },
    { value: 'scheduledAt_asc', label: 'Scheduled (Earliest First)' },
    { value: 'priority_desc', label: 'Priority (High to Low)' },
    { value: 'priority_asc', label: 'Priority (Low to High)' },
    { value: 'attempts_desc', label: 'Attempts (Most First)' },
    { value: 'attempts_asc', label: 'Attempts (Least First)' },
    { value: 'type_asc', label: 'Type (A-Z)' },
    { value: 'type_desc', label: 'Type (Z-A)' }
  ];

  const hasActiveFilters = statusFilter !== 'all' || 
                           jobTypeFilter !== 'all' || 
                           priorityFilter !== 'all' || 
                           timeFilter !== 'all' || 
                           searchQuery !== '' || 
                           sortBy !== 'createdAt_desc';

  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Sorting
            {hasActiveFilters && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                Active
              </span>
            )}
          </CardTitle>
          {onReset && (
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-muted-foreground hover:text-foreground"
              disabled={!hasActiveFilters}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset All
            </ModernButton>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <ModernSelect
              value={statusFilter}
              onValueChange={onStatusChange}
              options={statusOptions}
            />
            {statusFilter !== 'all' && (
              <div className={`inline-flex mt-1 px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(statusFilter)}`}>
                {getStatusLabel(statusFilter)}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Job Type</label>
            <ModernSelect
              value={jobTypeFilter}
              onValueChange={onJobTypeChange}
              options={jobTypeOptions}
            />
            {jobTypeFilter !== 'all' && (
              <div className="inline-flex mt-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                {getJobTypeLabel(jobTypeFilter)}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Priority</label>
            <ModernSelect
              value={priorityFilter}
              onValueChange={onPriorityChange}
              options={priorityOptions}
            />
            {priorityFilter !== 'all' && (
              <div className="inline-flex mt-1 px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                {priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)} Priority
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Time Period</label>
            <ModernSelect
              value={timeFilter}
              onValueChange={onTimeFilterChange}
              options={timeFilterOptions}
            />
            {timeFilter !== 'all' && (
              <div className="inline-flex mt-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                {getTimeFilterLabel(timeFilter)}
              </div>
            )}
          </div>
        </div>

        {/* Filters Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <SortAsc className="w-4 h-4" />
              Sort By
            </label>
            <ModernSelect
              value={sortBy}
              onValueChange={onSortChange}
              options={sortOptions}
            />
            {sortBy !== 'createdAt_desc' && (
              <div className="inline-flex mt-1 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                {getSortLabel(sortBy)}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <SearchInput
              placeholder="Search by job ID, type, error message, or payload..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <div className="mt-1 text-xs text-muted-foreground">
                Searching: "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Active Filters:</span>
              <div className="flex flex-wrap gap-2">
                {statusFilter !== 'all' && (
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(statusFilter)}`}>
                    Status: {getStatusLabel(statusFilter)}
                  </span>
                )}
                {jobTypeFilter !== 'all' && (
                  <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                    Type: {getJobTypeLabel(jobTypeFilter)}
                  </span>
                )}
                {priorityFilter !== 'all' && (
                  <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                    Priority: {priorityFilter}
                  </span>
                )}
                {timeFilter !== 'all' && (
                  <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                    Time: {getTimeFilterLabel(timeFilter)}
                  </span>
                )}
                {sortBy !== 'createdAt_desc' && (
                  <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                    Sort: {getSortLabel(sortBy)}
                  </span>
                )}
                {searchQuery && (
                  <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                    Search: "{searchQuery}"
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </ModernCard>
  );
};