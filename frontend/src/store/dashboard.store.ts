// Dashboard store following CLAUDE.md specification
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../lib/api';

interface DashboardState {
  // State
  overview: {
    totalSources: number;
    activeSources: number;
    todayFeeds: number;
    processedToday: number;
    latestAnalysis: any | null;
    recentPredictions: any[];
    marketSentiment: {
      label: string;
      score: number;
      confidence: number;
    } | null;
    systemHealth: {
      feedProcessing: string;
      aiAnalysis: string;
      queueStatus: string;
      lastUpdate: Date;
    } | null;
  } | null;
  trends: {
    sentimentHistory: Array<{
      date: string;
      sentiment: number;
      volume: number;
    }>;
    topicEvolution: Array<{
      date: string;
      topics: Array<{ topic: string; count: number }>;
    }>;
    predictionAccuracy: Array<{
      date: string;
      accuracy: number;
      count: number;
    }>;
  } | null;
  keyThemes: Array<{
    theme: string;
    frequency: number;
    sentiment: number;
    sources: string[];
  }>;
  activePredictions: any[];
  loading: boolean;
  error: string | null;
  refreshInterval: number | null;

  // Actions
  fetchOverview: () => Promise<void>;
  fetchTrends: (days?: number) => Promise<void>;
  fetchKeyThemes: () => Promise<void>;
  fetchActivePredictions: () => Promise<void>;
  setRefreshInterval: (interval: number | null) => void;
  refreshAll: () => Promise<void>;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set, get) => ({
      // Initial state
      overview: null,
      trends: null,
      keyThemes: [],
      activePredictions: [],
      loading: false,
      error: null,
      refreshInterval: null,

      // Fetch dashboard overview
      fetchOverview: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/dashboard/overview');
          if (response.data.success) {
            set({ 
              overview: response.data.data,
              loading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch overview', 
            loading: false 
          });
        }
      },

      // Fetch trends data
      fetchTrends: async (days = 30) => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/dashboard/trends', {
            params: { days }
          });
          if (response.data.success) {
            set({ 
              trends: response.data.data,
              loading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch trends', 
            loading: false 
          });
        }
      },

      // Fetch key themes
      fetchKeyThemes: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/dashboard/themes');
          if (response.data.success) {
            set({ 
              keyThemes: response.data.data,
              loading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch themes', 
            loading: false 
          });
        }
      },

      // Fetch active predictions
      fetchActivePredictions: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/dashboard/predictions');
          if (response.data.success) {
            set({ 
              activePredictions: response.data.data,
              loading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch predictions', 
            loading: false 
          });
        }
      },

      // Set refresh interval
      setRefreshInterval: (interval) => {
        const currentInterval = get().refreshInterval;
        if (currentInterval) {
          clearInterval(currentInterval);
        }
        
        if (interval && interval > 0) {
          const intervalId = setInterval(() => {
            get().refreshAll();
          }, interval) as unknown as number;
          set({ refreshInterval: intervalId });
        } else {
          set({ refreshInterval: null });
        }
      },

      // Refresh all dashboard data
      refreshAll: async () => {
        // Don't show loading state for background refresh
        try {
          await Promise.all([
            get().fetchOverview(),
            get().fetchTrends(),
            get().fetchKeyThemes(),
            get().fetchActivePredictions()
          ]);
        } catch (error) {
          console.error('Dashboard refresh error:', error);
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      }
    }),
    { name: 'dashboard-store' }
  )
);