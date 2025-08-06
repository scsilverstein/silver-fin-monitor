// Stock scanner store following CLAUDE.md specification
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../lib/api';
import { StockSymbol, StockFundamentals, ScannerResult, StockAlert } from '../types';

interface StockState {
  // State
  symbols: StockSymbol[];
  watchlist: StockSymbol[];
  fundamentals: Record<string, StockFundamentals>;
  scannerResults: ScannerResult[];
  alerts: StockAlert[];
  peerComparison: any | null;
  marketMapData: any[];
  loading: boolean;
  error: string | null;
  filters: {
    scan_type?: 'momentum' | 'value' | 'earnings_revision' | 'all';
    min_score?: number;
    sector?: string;
    market_cap?: string;
    limit?: number;
  };

  // Actions
  fetchSymbols: () => Promise<void>;
  addSymbol: (symbol: Partial<StockSymbol>) => Promise<void>;
  removeSymbol: (symbol: string) => Promise<void>;
  fetchFundamentals: (symbol: string) => Promise<void>;
  fetchScannerResults: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchPeerComparison: (symbol: string) => Promise<void>;
  fetchWatchlist: () => Promise<void>;
  addToWatchlist: (symbol: string) => Promise<void>;
  removeFromWatchlist: (symbol: string) => Promise<void>;
  runScanner: () => Promise<void>;
  fetchMarketMapData: (index?: string, size?: string) => Promise<void>;
  setFilters: (filters: StockState['filters']) => void;
  clearError: () => void;
}

export const useStockStore = create<StockState>()(
  devtools(
    (set, get) => ({
      // Initial state
      symbols: [],
      watchlist: [],
      fundamentals: {},
      scannerResults: [],
      alerts: [],
      peerComparison: null,
      marketMapData: [],
      loading: false,
      error: null,
      filters: {
        scan_type: 'all',
        limit: 50
      },

      // Fetch all tracked symbols
      fetchSymbols: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/stocks/symbols');
          if (response.data.success) {
            set({ symbols: response.data.data, loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch symbols', 
            loading: false 
          });
        }
      },

      // Add new symbol to track
      addSymbol: async (symbol) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post('/stocks/symbols', symbol);
          if (response.data.success) {
            const newSymbol = response.data.data;
            set(state => ({ 
              symbols: [...state.symbols, newSymbol], 
              loading: false 
            }));
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to add symbol', 
            loading: false 
          });
          throw error;
        }
      },

      // Remove symbol from tracking
      removeSymbol: async (symbol) => {
        set({ loading: true, error: null });
        try {
          const response = await api.delete(`/stocks/symbols/${symbol}`);
          if (response.data.success) {
            set(state => ({ 
              symbols: state.symbols.filter(s => s.symbol !== symbol),
              loading: false 
            }));
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to remove symbol', 
            loading: false 
          });
          throw error;
        }
      },

      // Fetch fundamentals for a symbol
      fetchFundamentals: async (symbol) => {
        set({ loading: true, error: null });
        try {
          const response = await api.get(`/stocks/fundamentals/${symbol}`);
          if (response.data.success) {
            set(state => ({ 
              fundamentals: {
                ...state.fundamentals,
                [symbol]: response.data.data
              },
              loading: false 
            }));
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch fundamentals', 
            loading: false 
          });
        }
      },

      // Fetch scanner results
      fetchScannerResults: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/stocks/scanner/results', {
            params: get().filters
          });
          if (response.data.success) {
            set({ scannerResults: response.data.data, loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch scanner results', 
            loading: false 
          });
        }
      },

      // Fetch alerts
      fetchAlerts: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/stocks/scanner/alerts');
          if (response.data.success) {
            set({ alerts: response.data.data, loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch alerts', 
            loading: false 
          });
        }
      },

      // Fetch peer comparison
      fetchPeerComparison: async (symbol) => {
        set({ loading: true, error: null });
        try {
          const response = await api.get(`/stocks/peers/${symbol}`);
          if (response.data.success) {
            set({ peerComparison: response.data.data, loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch peer comparison', 
            loading: false 
          });
        }
      },

      // Fetch watchlist
      fetchWatchlist: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/stocks/watchlist');
          if (response.data.success) {
            set({ watchlist: response.data.data, loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch watchlist', 
            loading: false 
          });
        }
      },

      // Add to watchlist
      addToWatchlist: async (symbol) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post('/stocks/watchlist', { symbol });
          if (response.data.success) {
            await get().fetchWatchlist();
            set({ loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to add to watchlist', 
            loading: false 
          });
          throw error;
        }
      },

      // Remove from watchlist
      removeFromWatchlist: async (symbol) => {
        set({ loading: true, error: null });
        try {
          const response = await api.delete(`/stocks/watchlist/${symbol}`);
          if (response.data.success) {
            set(state => ({ 
              watchlist: state.watchlist.filter(s => s.symbol !== symbol),
              loading: false 
            }));
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to remove from watchlist', 
            loading: false 
          });
          throw error;
        }
      },

      // Run scanner manually
      runScanner: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.post('/stocks/scanner/run');
          if (response.data.success) {
            // Refresh results after running
            await get().fetchScannerResults();
            set({ loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to run scanner', 
            loading: false 
          });
          throw error;
        }
      },

      // Fetch market map data
      fetchMarketMapData: async (index = 'sp500', size) => {
        set({ loading: true, error: null });
        try {
          const params: any = { index };
          if (size) {
            params.size = size;
          }
          
          const response = await api.get('/stocks/market-map', { params });
          if (response.data.success) {
            set({ marketMapData: response.data.data, loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch market map data', 
            loading: false 
          });
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
    { name: 'stock-store' }
  )
);