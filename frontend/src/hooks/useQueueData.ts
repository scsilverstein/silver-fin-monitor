import { useState, useEffect } from 'react';
import { queueApi, QueueJob, QueueStats, QueueStatus } from '@/lib/api';
import { toast } from 'sonner';

export const useQueueData = (filters?: {
  statusFilter?: string;
  jobTypeFilter?: string;
}) => {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const jobsPerPage = 1000;

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);
      setError(null);

      // Prepare job query parameters
      const jobParams: Record<string, any> = {
        limit: jobsPerPage,
        offset: (currentPage - 1) * jobsPerPage
      };

      // Add filters if they exist
      if (filters?.statusFilter && filters.statusFilter !== 'all') {
        jobParams.status = filters.statusFilter;
      }
      if (filters?.jobTypeFilter && filters.jobTypeFilter !== 'all') {
        jobParams.jobType = filters.jobTypeFilter;
      }

      // Load stats, status, and jobs in parallel
      const [statsData, statusData, jobsData] = await Promise.all([
        queueApi.getStats(),
        queueApi.getStatus(),
        queueApi.listJobs(jobParams)
      ]);

      setStats(statsData);
      setStatus(statusData);
      setJobs(jobsData.data || []);
      setTotalJobs(jobsData.meta?.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load queue data';
      setError(errorMessage);
      toast.error('Failed to load queue data', { description: errorMessage });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadData(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, currentPage, filters?.statusFilter, filters?.jobTypeFilter]);

  const totalPages = Math.ceil(totalJobs / jobsPerPage);

  return {
    jobs,
    stats,
    status,
    loading,
    refreshing,
    error,
    autoRefresh,
    currentPage,
    totalPages,
    totalJobs,
    setAutoRefresh,
    setCurrentPage,
    refreshData: () => loadData()
  };
};