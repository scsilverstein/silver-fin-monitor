import { useState, useEffect, useCallback } from 'react';
import { feedsApi, dashboardApi, FeedSource, RealtimeStats } from '@/lib/api';

export const useFeedsData = () => {
  const [feeds, setFeeds] = useState<FeedSource[]>([]);
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeeds = useCallback(async () => {
    try {
      setError(null);
      const data = await feedsApi.list();
      setFeeds(data);
    } catch (error) {
      console.error('Failed to load feeds:', error);
      setError('Failed to load feeds');
      setFeeds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await dashboardApi.stats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load realtime stats:', error);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFeeds(), loadStats()]);
    setRefreshing(false);
  }, [loadFeeds, loadStats]);

  useEffect(() => {
    loadFeeds();
    loadStats();
    
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [loadFeeds, loadStats]);

  return {
    feeds,
    stats,
    loading,
    refreshing,
    error,
    refreshAll,
    setFeeds
  };
};