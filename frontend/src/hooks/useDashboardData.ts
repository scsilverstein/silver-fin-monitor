import { useState, useEffect, useCallback } from 'react';
import { dashboardApi, DashboardOverview, RealtimeStats } from '@/lib/api';

export const useDashboardData = () => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [trends, setTrends] = useState<any>(null);
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [accuracy, setAccuracy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);
      const [overviewData, trendsData, accuracyData] = await Promise.all([
        dashboardApi.overview(),
        dashboardApi.trends(),
        dashboardApi.accuracy()
      ]);
      
      setOverview(overviewData);
      setTrends(trendsData);
      setAccuracy(accuracyData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRealtimeStats = useCallback(async () => {
    try {
      const data = await dashboardApi.stats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load realtime stats:', error);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDashboardData(), loadRealtimeStats()]);
    setRefreshing(false);
  }, [loadDashboardData, loadRealtimeStats]);

  useEffect(() => {
    loadDashboardData();
    loadRealtimeStats();
    
    const interval = setInterval(loadRealtimeStats, 10000);
    return () => clearInterval(interval);
  }, [loadDashboardData, loadRealtimeStats]);

  return {
    overview,
    trends,
    stats,
    accuracy,
    loading,
    refreshing,
    error,
    refreshData
  };
};