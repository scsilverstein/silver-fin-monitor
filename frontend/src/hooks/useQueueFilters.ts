import { useState, useMemo } from 'react';
import { QueueJob } from '@/lib/api';

interface GroupedJob {
  status: string;
  jobs: QueueJob[];
  count: number;
  averagePriority: number;
  oldestJob?: Date;
}

export const useQueueFilters = (jobs: QueueJob[] = []) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // For client-side search filtering only (server-side filters status/jobType)
  const filteredJobs = useMemo(() => {
    if (!searchQuery) {
      return jobs;
    }
    
    const query = searchQuery.toLowerCase();
    return jobs.filter(job => 
      job.jobType.toLowerCase().includes(query) ||
      job.id.toLowerCase().includes(query) ||
      (job.errorMessage && job.errorMessage.toLowerCase().includes(query))
    );
  }, [jobs, searchQuery]);

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

  // Reset filters
  const resetFilters = () => {
    setStatusFilter('all');
    setJobTypeFilter('all');
    setSearchQuery('');
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
    searchQuery,
    setStatusFilter,
    setJobTypeFilter,
    setSearchQuery,

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
    resetFilters,
    getJobStats
  };
};