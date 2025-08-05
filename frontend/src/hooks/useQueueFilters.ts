import { useState, useMemo } from 'react';
import { QueueJob } from '@/lib/api';

interface GroupedJob {
  status: string;
  jobs: QueueJob[];
  count: number;
  averagePriority: number;
  oldestJob?: Date;
}

export type SortOption = 
  | 'createdAt_desc' 
  | 'createdAt_asc' 
  | 'scheduledAt_desc' 
  | 'scheduledAt_asc'
  | 'priority_desc' 
  | 'priority_asc'
  | 'attempts_desc'
  | 'attempts_asc'
  | 'type_asc'
  | 'type_desc';

export type PriorityFilter = 'all' | 'high' | 'medium' | 'low';
export type TimeFilter = 'all' | 'last_hour' | 'last_6_hours' | 'last_day' | 'last_week';

export const useQueueFilters = (jobs: QueueJob[] = []) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('createdAt_desc');

  // Define standard available statuses and job types
  const availableStatuses = ['pending', 'processing', 'retry', 'completed', 'failed'];
  const availableJobTypes = [
    'feed_fetch', 
    'content_process', 
    'daily_analysis', 
    'prediction_comparison',
    'transcribe_audio',
    'generate_predictions',
    'cleanup'
  ];

  // Helper function to check if a job matches priority filter
  const matchesPriorityFilter = (job: QueueJob): boolean => {
    if (priorityFilter === 'all') return true;
    
    const priority = job.priority || 5;
    switch (priorityFilter) {
      case 'high': return priority <= 3;
      case 'medium': return priority >= 4 && priority <= 6;
      case 'low': return priority >= 7;
      default: return true;
    }
  };

  // Helper function to check if a job matches time filter
  const matchesTimeFilter = (job: QueueJob): boolean => {
    if (timeFilter === 'all') return true;
    
    const now = new Date();
    const jobDate = new Date(job.createdAt);
    const hoursDiff = (now.getTime() - jobDate.getTime()) / (1000 * 60 * 60);
    
    switch (timeFilter) {
      case 'last_hour': return hoursDiff <= 1;
      case 'last_6_hours': return hoursDiff <= 6;
      case 'last_day': return hoursDiff <= 24;
      case 'last_week': return hoursDiff <= 168;
      default: return true;
    }
  };

  // Helper function to sort jobs
  const sortJobs = (jobs: QueueJob[]): QueueJob[] => {
    return [...jobs].sort((a, b) => {
      switch (sortBy) {
        case 'createdAt_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'createdAt_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'scheduledAt_desc':
          return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
        case 'scheduledAt_asc':
          return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        case 'priority_desc':
          return (b.priority || 5) - (a.priority || 5);
        case 'priority_asc':
          return (a.priority || 5) - (b.priority || 5);
        case 'attempts_desc':
          return b.attempts - a.attempts;
        case 'attempts_asc':
          return a.attempts - b.attempts;
        case 'type_asc':
          return a.jobType.localeCompare(b.jobType);
        case 'type_desc':
          return b.jobType.localeCompare(a.jobType);
        default:
          return 0;
      }
    });
  };

  // For client-side filtering and sorting (server-side filters status/jobType)
  const filteredJobs = useMemo(() => {
    let filtered = jobs;
    
    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(matchesPriorityFilter);
    }
    
    // Apply time filter
    if (timeFilter !== 'all') {
      filtered = filtered.filter(matchesTimeFilter);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job => 
        job.jobType.toLowerCase().includes(query) ||
        job.id.toLowerCase().includes(query) ||
        (job.errorMessage && job.errorMessage.toLowerCase().includes(query)) ||
        JSON.stringify(job.payload).toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    return sortJobs(filtered);
  }, [jobs, priorityFilter, timeFilter, searchQuery, sortBy]);

  // Group jobs by status for enhanced visualization
  const groupedJobs = useMemo(() => {
    const groups: Record<string, GroupedJob> = {};

    filteredJobs.forEach(job => {
      const status = job.status;

      if (!groups[status]) {
        groups[status] = {
          status,
          jobs: [],
          count: 0,
          averagePriority: 0,
          oldestJob: undefined
        };
      }

      groups[status].jobs.push(job);
      groups[status].count++;

      // Update oldest job
      const jobCreatedAt = new Date(job.createdAt);
      if (!groups[status].oldestJob || jobCreatedAt < groups[status].oldestJob) {
        groups[status].oldestJob = jobCreatedAt;
      }
    });

    // Calculate average priority for each group
    Object.values(groups).forEach(group => {
      const totalPriority = group.jobs.reduce((sum, job) => sum + (job.priority || 5), 0);
      group.averagePriority = group.count > 0 ? totalPriority / group.count : 5;
    });

    // Sort groups by priority (failed first, then processing, pending, completed)
    const statusPriority = {
      'failed': 1,
      'processing': 2,
      'retry': 3,
      'pending': 4,
      'completed': 5
    };

    const sortedGroups = Object.values(groups).sort((a, b) => {
      const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 6;
      const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 6;
      return aPriority - bPriority;
    });

    return sortedGroups;
  }, [filteredJobs]);

  // Helper functions for formatting
  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'pending': 'Pending',
      'processing': 'Processing', 
      'completed': 'Completed',
      'failed': 'Failed',
      'retry': 'Retrying'
    };
    return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getJobTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'feed_fetch': 'Feed Fetch',
      'content_process': 'Content Process',
      'daily_analysis': 'Daily Analysis',
      'prediction_comparison': 'Prediction Compare',
      'transcribe_audio': 'Audio Transcription',
      'generate_predictions': 'Generate Predictions',
      'cleanup': 'Cleanup'
    };
    return labels[type] || type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getStatusBadgeColor = (status: string): string => {
    const colors: Record<string, string> = {
      'pending': 'bg-blue-100 text-blue-700',
      'processing': 'bg-yellow-100 text-yellow-700',
      'completed': 'bg-green-100 text-green-700',
      'failed': 'bg-red-100 text-red-700',
      'retry': 'bg-orange-100 text-orange-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  // Helper function to get priority label
  const getPriorityLabel = (priority: number): string => {
    if (priority <= 3) return 'High';
    if (priority <= 6) return 'Medium';
    return 'Low';
  };

  // Helper function to get sort label
  const getSortLabel = (sort: SortOption): string => {
    const labels: Record<SortOption, string> = {
      'createdAt_desc': 'Created (Newest)',
      'createdAt_asc': 'Created (Oldest)',
      'scheduledAt_desc': 'Scheduled (Latest)',
      'scheduledAt_asc': 'Scheduled (Earliest)',
      'priority_desc': 'Priority (High to Low)',
      'priority_asc': 'Priority (Low to High)',
      'attempts_desc': 'Attempts (Most)',
      'attempts_asc': 'Attempts (Least)',
      'type_asc': 'Type (A-Z)',
      'type_desc': 'Type (Z-A)'
    };
    return labels[sort];
  };

  // Helper function to get time filter label
  const getTimeFilterLabel = (timeFilter: TimeFilter): string => {
    const labels: Record<TimeFilter, string> = {
      'all': 'All Time',
      'last_hour': 'Last Hour',
      'last_6_hours': 'Last 6 Hours',
      'last_day': 'Last 24 Hours',
      'last_week': 'Last Week'
    };
    return labels[timeFilter];
  };

  // Reset filters
  const resetFilters = () => {
    setStatusFilter('all');
    setJobTypeFilter('all');
    setPriorityFilter('all');
    setTimeFilter('all');
    setSearchQuery('');
    setSortBy('createdAt_desc');
  };

  // Get statistics
  const getJobStats = () => {
    const pending = filteredJobs.filter(j => j.status === 'pending').length;
    const processing = filteredJobs.filter(j => j.status === 'processing').length;
    const completed = filteredJobs.filter(j => j.status === 'completed').length;
    const failed = filteredJobs.filter(j => j.status === 'failed').length;
    const retry = filteredJobs.filter(j => j.status === 'retry').length;

    return {
      total: filteredJobs.length,
      pending,
      processing,
      completed,
      failed,
      retry,
      averagePriority: filteredJobs.length > 0 
        ? filteredJobs.reduce((sum, j) => sum + (j.priority || 5), 0) / filteredJobs.length
        : 5
    };
  };

  return {
    // Filter state
    statusFilter,
    jobTypeFilter,
    priorityFilter,
    timeFilter,
    searchQuery,
    sortBy,
    setStatusFilter,
    setJobTypeFilter,
    setPriorityFilter,
    setTimeFilter,
    setSearchQuery,
    setSortBy,

    // Filtered data
    filteredJobs,
    groupedJobs,

    // Available options
    availableStatuses,
    availableJobTypes,

    // Helper functions
    getStatusLabel,
    getJobTypeLabel,
    getStatusBadgeColor,
    getPriorityLabel,
    getSortLabel,
    getTimeFilterLabel,
    resetFilters,
    getJobStats
  };
};