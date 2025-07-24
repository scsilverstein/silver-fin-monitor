import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { SearchInput } from '@/components/ui/ModernInput';
import { ModernSelect } from '@/components/ui/ModernSelect';
import { Filter } from 'lucide-react';

interface QueueFiltersProps {
  statusFilter: string;
  jobTypeFilter: string;
  searchQuery: string;
  availableStatuses: string[];
  availableJobTypes: string[];
  onStatusChange: (value: string) => void;
  onJobTypeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  getStatusLabel: (status: string) => string;
  getJobTypeLabel: (type: string) => string;
  getStatusBadgeColor: (status: string) => string;
  onReset?: () => void;
}

export const QueueFilters: React.FC<QueueFiltersProps> = ({
  statusFilter,
  jobTypeFilter,
  searchQuery,
  availableStatuses,
  availableJobTypes,
  onStatusChange,
  onJobTypeChange,
  onSearchChange,
  getStatusLabel,
  getJobTypeLabel,
  getStatusBadgeColor,
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

  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
          {onReset && (
            <button 
              onClick={onReset}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[150px]">
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

          <div className="min-w-[150px]">
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

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Search</label>
            <SearchInput
              placeholder="Search by job ID, type, or error message..."
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
      </CardContent>
    </ModernCard>
  );
};