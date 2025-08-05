import { queueApi } from '@/lib/api';
import { toast } from 'sonner';

export const useQueueActions = (refreshData: () => void) => {
  const handlePauseResume = async (isProcessing: boolean) => {
    try {
      if (isProcessing) {
        await queueApi.pauseQueue();
        toast.success('Queue processing paused');
      } else {
        await queueApi.resumeQueue();
        toast.success('Queue processing resumed');
      }
      refreshData();
    } catch (err) {
      toast.error('Failed to pause/resume queue');
    }
  };

  const handleClearCompleted = async () => {
    try {
      const result = await queueApi.clearCompleted();
      toast.success(`Cleared ${result.deletedCount} completed jobs`);
      refreshData();
    } catch (err) {
      toast.error('Failed to clear completed jobs');
    }
  };

  const handleClearFailed = async () => {
    try {
      const result = await queueApi.clearFailed();
      toast.success(`Cleared ${result.deletedCount} failed jobs`);
      refreshData();
    } catch (err) {
      toast.error('Failed to clear failed jobs');
    }
  };

  const handleRetryAllFailed = async () => {
    try {
      const result = await queueApi.retryAllFailed();
      toast.success(`Retried ${result.retriedCount} out of ${result.totalFailed} failed jobs`);
      refreshData();
    } catch (err) {
      toast.error('Failed to retry failed jobs');
    }
  };

  const handleAddJob = async () => {
    try {
      await queueApi.enqueueJob({
        jobType: 'cleanup',
        priority: 5
      });
      toast.success('Cleanup job added to queue');
      refreshData();
    } catch (err) {
      toast.error('Failed to add job');
    }
  };

  const handleJobDelete = async (id: string) => {
    try {
      await queueApi.deleteJob(id);
      toast.success('Job deleted');
      refreshData();
    } catch (err) {
      toast.error('Failed to delete job');
    }
  };

  const handleJobRetry = async (id: string) => {
    try {
      await queueApi.retryJob(id);
      toast.success('Job retry queued');
      refreshData();
    } catch (err) {
      toast.error('Failed to retry job');
    }
  };

  const handleJobCancel = async (id: string) => {
    try {
      await queueApi.cancelJob(id);
      toast.success('Job cancelled');
      refreshData();
    } catch (err) {
      toast.error('Failed to cancel job');
    }
  };

  const handleJobReset = async (id: string) => {
    try {
      await queueApi.resetJob(id);
      toast.success('Job reset successfully');
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reset job');
    }
  };

  return {
    handlePauseResume,
    handleClearCompleted,
    handleClearFailed,
    handleRetryAllFailed,
    handleAddJob,
    handleJobDelete,
    handleJobRetry,
    handleJobCancel,
    handleJobReset
  };
};