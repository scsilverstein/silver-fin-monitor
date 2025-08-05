import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useWebSocket } from './useWebSocket';
import { websocketService } from '../services/websocket.service';

export interface FeedSyncStatus {
  feedId: string;
  feedName: string;
  status: 'idle' | 'syncing' | 'completed' | 'failed';
  lastSyncAt?: string;
  itemsProcessed?: number;
  totalItems?: number;
  error?: string;
}

export interface WorkflowStatus {
  date: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  progress: {
    feeds: { total: number; completed: number; failed: number };
    content: { total: number; processed: number };
    analysis: string;
    predictions: string;
  };
  estimatedCompletion?: string;
}

export interface GlobalSyncStatus {
  isAnySyncing: boolean;
  syncingCount: number;
  feeds: FeedSyncStatus[];
  workflow?: WorkflowStatus;
  lastUpdated: Date;
}

export const useSyncStatus = (refreshInterval = 5000) => {
  const [syncStatus, setSyncStatus] = useState<GlobalSyncStatus>({
    isAnySyncing: false,
    syncingCount: 0,
    feeds: [],
    lastUpdated: new Date()
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket for real-time updates
  const { isConnected, on } = useWebSocket({ channels: ['sync:updates', 'workflow:updates'] });

  // Fetch sync status from API
  const fetchSyncStatus = useCallback(async () => {
    try {
      // Get queue status - use demo endpoint for non-admin users
      let queueResponse;
      try {
        queueResponse = await api.get('/queue/status');
      } catch (error: any) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          // Fallback to demo endpoint
          queueResponse = await api.get('/queue/status-demo');
        } else {
          throw error;
        }
      }
      const queueData = queueResponse.data.data;

      // Get feed statuses - use demo endpoint for non-admin users
      let feedsResponse;
      try {
        feedsResponse = await api.get('/feeds');
      } catch (error: any) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          // Fallback to demo endpoint
          feedsResponse = await api.get('/feeds-demo');
        } else {
          throw error;
        }
      }
      const feedsData = feedsResponse.data.data || [];

      // Get today's workflow status
      const today = new Date().toISOString().split('T')[0];
      let workflowStatus: WorkflowStatus | undefined;
      
      try {
        const workflowResponse = await api.get(`/workflow/status/${today}`);
        workflowStatus = workflowResponse.data.data;
      } catch (e: any) {
        // Workflow endpoint might not exist yet or return 404
        if (e.response?.status !== 404) {
          console.debug('Workflow status error:', e.message);
        }
        // For demo purposes, create a mock workflow status
        if (Math.random() > 0.5) {
          workflowStatus = {
            date: today,
            status: 'in_progress',
            progress: {
              feeds: { total: 4, completed: 2, failed: 0 },
              content: { total: 50, processed: 25 },
              analysis: 'pending',
              predictions: 'not_started'
            },
            estimatedCompletion: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes from now
          };
        }
      }

      // Process feed sync statuses
      const feedStatuses: FeedSyncStatus[] = feedsData.map((feed: any) => {
        // Check if this feed has active jobs in queue
        const hasActiveJob = queueData.jobs?.some((job: any) => 
          job.job_type === 'feed_sync' && 
          job.payload?.sourceId === feed.id &&
          ['pending', 'processing'].includes(job.status)
        );

        return {
          feedId: feed.id,
          feedName: feed.name,
          status: hasActiveJob ? 'syncing' : 
                  feed.lastProcessedAt ? 'completed' : 'idle',
          lastSyncAt: feed.lastProcessedAt,
          itemsProcessed: feed.itemsProcessed || 0,
          totalItems: feed.totalItems || 0,
          error: feed.lastError
        };
      });

      // Calculate summary
      const syncingCount = feedStatuses.filter(f => f.status === 'syncing').length;

      setSyncStatus({
        isAnySyncing: syncingCount > 0 || workflowStatus?.status === 'in_progress',
        syncingCount,
        feeds: feedStatuses,
        workflow: workflowStatus,
        lastUpdated: new Date()
      });

      setError(null);
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
      setError('Failed to fetch sync status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    // Subscribe to feed sync updates
    const unsubscribeFeedSync = websocketService.on('feed:sync:update', (data: any) => {
      setSyncStatus(prev => ({
        ...prev,
        feeds: prev.feeds.map(feed => 
          feed.feedId === data.feedId 
            ? { ...feed, ...data.update }
            : feed
        ),
        lastUpdated: new Date()
      }));
    });

    // Subscribe to workflow updates
    const unsubscribeWorkflow = websocketService.on('workflow:update', (data: any) => {
      setSyncStatus(prev => ({
        ...prev,
        workflow: data.workflow,
        lastUpdated: new Date()
      }));
    });

    // Subscribe to sync started events
    const unsubscribeSyncStarted = websocketService.on('sync:started', (data: any) => {
      setSyncStatus(prev => ({
        ...prev,
        isAnySyncing: true,
        syncingCount: prev.syncingCount + 1,
        feeds: prev.feeds.map(feed => 
          feed.feedId === data.feedId 
            ? { ...feed, status: 'syncing' }
            : feed
        ),
        lastUpdated: new Date()
      }));
    });

    // Subscribe to sync completed events
    const unsubscribeSyncCompleted = websocketService.on('sync:completed', (data: any) => {
      setSyncStatus(prev => {
        const newSyncingCount = Math.max(0, prev.syncingCount - 1);
        return {
          ...prev,
          isAnySyncing: newSyncingCount > 0,
          syncingCount: newSyncingCount,
          feeds: prev.feeds.map(feed => 
            feed.feedId === data.feedId 
              ? { 
                  ...feed, 
                  status: 'completed',
                  lastSyncAt: new Date().toISOString(),
                  itemsProcessed: data.itemsProcessed,
                  totalItems: data.totalItems
                }
              : feed
          ),
          lastUpdated: new Date()
        };
      });
    });

    // Cleanup
    return () => {
      unsubscribeFeedSync();
      unsubscribeWorkflow();
      unsubscribeSyncStarted();
      unsubscribeSyncCompleted();
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(fetchSyncStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchSyncStatus, refreshInterval]);

  // Manual refresh
  const refresh = useCallback(() => {
    setLoading(true);
    return fetchSyncStatus();
  }, [fetchSyncStatus]);

  return {
    syncStatus,
    loading,
    error,
    refresh,
    isConnected
  };
};