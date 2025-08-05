// Analysis store following CLAUDE.md specification
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../lib/api';
import { DailyAnalysis, Prediction, PredictionComparison } from '../types';

interface AnalysisState {
  // State
  analyses: DailyAnalysis[];
  currentAnalysis: DailyAnalysis | null;
  predictions: Prediction[];
  comparisons: PredictionComparison[];
  accuracyMetrics: {
    overall_accuracy: number;
    by_type: Record<string, number>;
    by_horizon: Record<string, number>;
    confidence_calibration: number;
    total_evaluated: number;
    total_pending: number;
  } | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchAnalyses: (days?: number) => Promise<void>;
  fetchAnalysisById: (id: string) => Promise<void>;
  fetchAnalysisByDate: (date: string) => Promise<void>;
  generateAnalysis: (date?: string) => Promise<void>;
  fetchPredictions: (analysisId?: string) => Promise<void>;
  fetchComparisons: () => Promise<void>;
  fetchAccuracyMetrics: () => Promise<void>;
  evaluatePrediction: (predictionId: string) => Promise<void>;
  clearError: () => void;
}

export const useAnalysisStore = create<AnalysisState>()(
  devtools(
    (set, get) => ({
      // Initial state
      analyses: [],
      currentAnalysis: null,
      predictions: [],
      comparisons: [],
      accuracyMetrics: null,
      loading: false,
      error: null,

      // Transform analysis from snake_case to camelCase
      transformAnalysis: (analysis: any): DailyAnalysis => ({
        id: analysis.id,
        analysisDate: new Date(analysis.analysis_date),
        marketSentiment: analysis.market_sentiment,
        keyThemes: analysis.key_themes || [],
        overallSummary: analysis.overall_summary,
        aiAnalysis: analysis.ai_analysis || {},
        confidenceScore: analysis.confidence_score,
        sourcesAnalyzed: analysis.sources_analyzed,
        createdAt: new Date(analysis.created_at)
      }),

      // Fetch recent analyses
      fetchAnalyses: async (days = 30) => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/analysis', {
            params: { days }
          });
          if (response.data.success) {
            const analyses = response.data.data.map(get().transformAnalysis);
            set({ 
              analyses,
              currentAnalysis: analyses[0] || null,
              loading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch analyses', 
            loading: false 
          });
        }
      },

      // Fetch specific analysis by ID
      fetchAnalysisById: async (id) => {
        set({ loading: true, error: null });
        try {
          const response = await api.get(`/analysis/${id}`);
          if (response.data.success) {
            set({ 
              currentAnalysis: get().transformAnalysis(response.data.data),
              loading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch analysis', 
            loading: false 
          });
        }
      },

      // Fetch analysis by date
      fetchAnalysisByDate: async (date) => {
        set({ loading: true, error: null });
        try {
          const response = await api.get(`/analysis/date/${date}`);
          if (response.data.success) {
            set({ 
              currentAnalysis: get().transformAnalysis(response.data.data),
              loading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch analysis', 
            loading: false 
          });
        }
      },

      // Generate new analysis
      generateAnalysis: async (date) => {
        set({ loading: true, error: null });
        try {
          const payload = date ? { date, force: true } : { force: true };
          const response = await api.post('/analysis/trigger', payload);
          
          if (response.data.success) {
            // Just return the job info, don't update state yet
            // The analysis will be available when the job completes
            set({ loading: false });
            return response.data.data;
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to generate analysis', 
            loading: false 
          });
          throw error;
        }
      },

      // Fetch predictions
      fetchPredictions: async (analysisId) => {
        set({ loading: true, error: null });
        try {
          const params = analysisId ? { analysis_id: analysisId } : {};
          const response = await api.get('/analysis/predictions', { params });
          
          if (response.data.success) {
            set({ 
              predictions: response.data.data,
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

      // Fetch prediction comparisons
      fetchComparisons: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/analysis/predictions/comparisons');
          if (response.data.success) {
            set({ 
              comparisons: response.data.data,
              loading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch comparisons', 
            loading: false 
          });
        }
      },

      // Fetch accuracy metrics
      fetchAccuracyMetrics: async () => {
        set({ loading: true, error: null });
        try {
          const response = await api.get('/analysis/predictions/accuracy');
          if (response.data.success) {
            set({ 
              accuracyMetrics: response.data.data,
              loading: false 
            });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to fetch accuracy metrics', 
            loading: false 
          });
        }
      },

      // Evaluate specific prediction
      evaluatePrediction: async (predictionId) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post(`/analysis/predictions/${predictionId}/evaluate`);
          if (response.data.success) {
            // Refresh comparisons and metrics
            await Promise.all([
              get().fetchComparisons(),
              get().fetchAccuracyMetrics()
            ]);
            set({ loading: false });
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Failed to evaluate prediction', 
            loading: false 
          });
          throw error;
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      }
    }),
    { name: 'analysis-store' }
  )
);