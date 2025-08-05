import React, { useState } from 'react';
import { AlertCircle, List, LayoutGrid, Play, Pause, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { ModernButton } from '@/components/ui/ModernButton';
import { PageContainer, PageHeader, LoadingState, StatsGrid, createStatItems } from '@/components/layout';
import { useQueueData } from '@/hooks/useQueueData';
import { useQueueActions } from '@/hooks/useQueueActions';
import { useQueueFilters } from '@/hooks/useQueueFilters';
import { QueueList } from '@/components/queue/QueueList';
import { QueueTabs } from '@/components/queue/QueueTabs';
import { QueueFilters } from '@/components/queue/QueueFilters';
import { WorkerControls } from '@/components/queue/WorkerControls';

const QueueManagement: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'tabs'>('list');
  const filters = useQueueFilters();
  const queueData = useQueueData({
    statusFilter: filters.statusFilter,
    jobTypeFilter: filters.jobTypeFilter
  });
  const actions = useQueueActions(queueData.refreshData);

  // Update filters with current jobs for search functionality
  const filtersWithJobs = useQueueFilters(queueData.jobs);
  // Override the server-side filters with client-side filters
  const clientFilters = {
    ...filtersWithJobs,
    statusFilter: filters.statusFilter,
    jobTypeFilter: filters.jobTypeFilter,
    setStatusFilter: filters.setStatusFilter,
    setJobTypeFilter: filters.setJobTypeFilter,
    searchQuery: filtersWithJobs.searchQuery,
    setSearchQuery: filtersWithJobs.setSearchQuery,
    resetFilters: () => {
      filters.resetFilters();
      filtersWithJobs.resetFilters();
    },
    availableStatuses: filters.availableStatuses,
    availableJobTypes: filters.availableJobTypes
  };

  // Create stats for the queue
  const queueStats = queueData.stats ? [
    createStatItems.count('pending', 'Pending Jobs', queueData.stats.pending || 0, {
      status: (queueData.stats.pending || 0) > 100 ? 'warning' : 'default',
      clickable: true,
      onClick: () => clientFilters.setStatusFilter('pending')
    }),
    createStatItems.count('processing', 'Processing', queueData?.stats?.processing || 0, {
      status: 'info',
      clickable: true,
      onClick: () => clientFilters.setStatusFilter('processing')
    }),
    createStatItems.count('completed', 'Completed', queueData.stats.completed, {
      status: 'success',
      clickable: true,
      onClick: () => clientFilters.setStatusFilter('completed')
    }),
    createStatItems.count('failed', 'Failed', queueData.stats.failed, {
      status: queueData.stats.failed > 0 ? 'error' : 'default',
      clickable: true,
      onClick: () => clientFilters.setStatusFilter('failed')
    })
  ] : [];

  if (queueData.loading) {
    return (
      <PageContainer showBreadcrumbs>
        <LoadingState message="Loading queue data..." fullScreen />
      </PageContainer>
    );
  }

  return (
    <PageContainer showBreadcrumbs>
      <PageHeader
        title="Job Queue Management"
        subtitle="Monitor and manage background job processing"
        badges={[
          {
            label: queueData.autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF',
            variant: queueData.autoRefresh ? 'success' : 'outline'
          },
          { label: `${queueData.totalJobs} Total Jobs`, variant: 'outline' }
        ]}
        onRefresh={queueData.refreshData}
        refreshing={queueData.refreshing}
        primaryActions={[
          {
            label: queueData.autoRefresh ? 'Disable Auto-refresh' : 'Enable Auto-refresh',
            icon: queueData.autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />,
            onClick: () => queueData.setAutoRefresh(!queueData.autoRefresh),
            variant: 'outline'
          }
        ]}
        secondaryActions={[
          {
            label: 'Clear All Failed',
            icon: <Trash2 className="h-4 w-4" />,
            onClick: actions.handleClearFailed,
            variant: 'outline',
            disabled: !queueData.stats?.failed
          }
        ]}
      />

      {queueData.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{queueData.error}</AlertDescription>
        </Alert>
      )}

      <StatsGrid stats={queueStats} columns={4} loading={queueData.loading} />

      {/* Worker Controls */}
      <WorkerControls />

      {/* Filters and Sorting */}
      <QueueFilters
        statusFilter={clientFilters.statusFilter}
        jobTypeFilter={clientFilters.jobTypeFilter}
        priorityFilter={clientFilters.priorityFilter}
        timeFilter={clientFilters.timeFilter}
        searchQuery={clientFilters.searchQuery}
        sortBy={clientFilters.sortBy}
        availableStatuses={clientFilters.availableStatuses}
        availableJobTypes={clientFilters.availableJobTypes}
        onStatusChange={clientFilters.setStatusFilter}
        onJobTypeChange={clientFilters.setJobTypeFilter}
        onPriorityChange={clientFilters.setPriorityFilter}
        onTimeFilterChange={clientFilters.setTimeFilter}
        onSearchChange={clientFilters.setSearchQuery}
        onSortChange={clientFilters.setSortBy}
        getStatusLabel={clientFilters.getStatusLabel}
        getJobTypeLabel={clientFilters.getJobTypeLabel}
        getStatusBadgeColor={clientFilters.getStatusBadgeColor}
        getSortLabel={clientFilters.getSortLabel}
        getTimeFilterLabel={clientFilters.getTimeFilterLabel}
        onReset={clientFilters.resetFilters}
      />

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">View:</span>
          <div className="flex border rounded-lg">
            <ModernButton
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-r-none border-r"
            >
              <List className="w-4 h-4 mr-1" />
              List
            </ModernButton>
            <ModernButton
              variant={viewMode === 'tabs' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('tabs')}
              className="rounded-l-none"
            >
              <LayoutGrid className="w-4 h-4 mr-1" />
              By Status
            </ModernButton>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground space-x-4">
          <span>
            Showing {clientFilters.filteredJobs.length} of {queueData.jobs.length} jobs
          </span>
          {clientFilters.filteredJobs.length !== queueData.jobs.length && (
            <span className="text-blue-600">
              ({queueData.jobs.length - clientFilters.filteredJobs.length} filtered out)
            </span>
          )}
        </div>
      </div>

      {/* Conditional Rendering Based on View Mode */}
      {viewMode === 'list' ? (
        <QueueList
          jobs={clientFilters.filteredJobs}
          stats={queueData.stats}
          statusFilter={clientFilters.statusFilter}
          totalJobs={queueData.totalJobs}
          currentPage={queueData.currentPage}
          totalPages={queueData.totalPages}
          onJobDelete={actions.handleJobDelete}
          onJobRetry={actions.handleJobRetry}
          onJobCancel={actions.handleJobCancel}
          onJobReset={actions.handleJobReset}
          onRetryAllFailed={actions.handleRetryAllFailed}
          onClearFailed={actions.handleClearFailed}
          onPageChange={queueData.setCurrentPage}
        />
      ) : (
        <QueueTabs
          groupedJobs={clientFilters.groupedJobs}
          getStatusLabel={clientFilters.getStatusLabel}
          getStatusBadgeColor={clientFilters.getStatusBadgeColor}
          onJobDelete={actions.handleJobDelete}
          onJobRetry={actions.handleJobRetry}
          onJobCancel={actions.handleJobCancel}
          onJobReset={actions.handleJobReset}
        />
      )}
    </PageContainer>
  );
};

export default QueueManagement;