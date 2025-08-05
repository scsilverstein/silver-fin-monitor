// Feed store following CLAUDE.md specification
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../lib/api';
import { FeedSource, RawFeed, ProcessedContent } from '../types';

interface FeedState {
  // State
  sources: FeedSource[];
  feeds: RawFeed[];
  processedContent: ProcessedContent[];
  loading: boolean;
  error: string | null;
  filters: {
    sourceType?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  };

  // Actions
  fetchSources: () => Promise<void>;
  fetchFeeds: (sourceId?: string) => Promise<void>;
  fetchProcessedContent: (feedId?: string) => Promise<void>;
  createSource: (source: Partial<FeedSource>) => Promise<void>;
  updateSource: (id: string, updates: Partial<FeedSource>) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  processFeed: (sourceId: string) => Promise<void>;
  setFilters: (filters: FeedState['filters']) => void;
  clearError: () => void;
}

export const useFeedStore = create<FeedState>()(
  devtools(
    (set, get) => ({
      // Initial state
      sources: [],
      feeds: [],
      processedContent: [],
      loading: false,
      error: null,
      filters: {},

      // Fetch all feed sources
      fetchSources: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/feeds');
          if (response.data.success) {
            set({ sources: response.data.data, loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch sources', 
            loading: false 
          });
        }
      },

      // Fetch feeds with optional filtering
      fetchFeeds: async (sourceId?: string) => {
        set({ loading: true, error: null });
        try {
          const params: any = { ...get().filters };
          if (sourceId) params.source_id = sourceId;
          
          const response = await api.get('/feeds/content', { params });
          if (response.data.success) {
            set({ feeds: response.data.data, loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch feeds', 
            loading: false 
          });
        }
      },

      // Fetch processed content
      fetchProcessedContent: async (feedId?: string) => {
        set({ loading: true, error: null });
        try {
          const endpoint = feedId 
            ? `/feeds/content/${feedId}/processed` 
            : '/feeds/processed';
          
          const response = await api.get(endpoint);
          if (response.data.success) {
            set({ processedContent: response.data.data, loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch processed content', 
            loading: false 
          });
        }
      },

      // Create new feed source
      createSource: async (source) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post('/feeds', source);
          if (response.data.success) {
            const newSource = response.data.data;
            set(state => ({ 
              sources: [...state.sources, newSource], 
              loading: false 
            }));
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to create source', 
            loading: false 
          });
          throw error;
        }
      },

      // Update feed source
      updateSource: async (id, updates) => {
        set({ loading: true, error: null });
        try {
          const response = await api.put(`/feeds/${id}`, updates);
          if (response.data.success) {
            const updatedSource = response.data.data;
            set(state => ({ 
              sources: state.sources.map(s => 
                s.id === id ? updatedSource : s
              ), 
              loading: false 
            }));
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to update source', 
            loading: false 
          });
          throw error;
        }
      },

      // Delete feed source
      deleteSource: async (id) => {
        set({ loading: true, error: null });
        try {
          const response = await api.delete(`/feeds/${id}`);
          if (response.data.success) {
            set(state => ({ 
              sources: state.sources.filter(s => s.id !== id), 
              loading: false 
            }));
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to delete source', 
            loading: false 
          });
          throw error;
        }
      },

      // Process feed manually
      processFeed: async (sourceId) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post(`/feeds/${sourceId}/process`);
          if (response.data.success) {
            // Optionally refresh feeds
            await get().fetchFeeds(sourceId);
            set({ loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to process feed', 
            loading: false 
          });
          throw error;
        }
      },

      // Set filters
      setFilters: (filters) => {
        set({ filters });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      }
    }),
    { name: 'feed-store' }
  )
);