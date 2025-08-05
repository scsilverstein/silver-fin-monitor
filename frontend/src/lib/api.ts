import axios, { AxiosError } from 'axios';

// Determine the API URL based on the environment
const getApiUrl = () => {
  // If explicitly set in environment, use that first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In development, use the Vite proxy
  if (import.meta.env.DEV) {
    return '/api/v1';
  }
  
  // In production, check deployment environment
  if (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('netlify.com')) {
    return '/api/v1';
  }
  
  // Default production fallback
  if (import.meta.env.PROD) {
    return '/api/v1';
  }
  
  // Final fallback to local server
  return 'http://localhost:3001/api/v1';
};

const API_BASE_URL = getApiUrl();

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Comment out verbose logging unless needed for debugging
    // console.log('=== API Request Debug ===');
    // console.log('Method:', config.method?.toUpperCase());
    // console.log('URL:', config.url);
    // console.log('Base URL:', config.baseURL);
    // console.log('Full URL:', `${config.baseURL}${config.url}`);
    // console.log('Headers:', JSON.stringify(config.headers, null, 2));
    // console.log('Request Data:', JSON.stringify(config.data, null, 2));
    // console.log('Has Token:', !!token);
    // console.log('Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'none');
    // console.log('======================');
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      const networkError = new Error('Network error - please check if the backend server is running');
      networkError.name = 'NetworkError';
      return Promise.reject(networkError);
    }

    // Handle HTTP errors
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    
    // Log detailed error information for debugging (except expected 404s)
    const isExpected404 = error.response?.status === 404 && error.config?.url === '/analysis/latest';
    if (!isExpected404) {
      console.error('API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method
      });
    }
    
    return Promise.reject(error);
  }
);

// API types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

// Auth API
export const authApi = {
  register: async (data: { email: string; password: string; fullName?: string }) => {
    const response = await api.post<ApiResponse<{ user: any; token: string; message: string }>>('/auth/register', data);
    return response.data.data!;
  },

  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<ApiResponse<{ user: any; token: string; message: string }>>('/auth/login', data);
    
    // Debug logging
    console.log('Login response:', response.data);
    
    // Handle both nested and non-nested response structures
    const responseData = response.data;
    const result = responseData.data || responseData;
    
    // Store token for future requests
    if (result.token) {
      console.log('Storing token from result:', result.token);
      localStorage.setItem('auth_token', result.token);
    } else if (responseData.token) {
      console.log('Storing token from responseData:', responseData.token);
      localStorage.setItem('auth_token', responseData.token);
    }
    
    const token = result.token || responseData.token;
    const user = result.user || responseData.user;
    
    console.log('Final token:', token);
    console.log('Final user:', user);
    
    if (!token || !user) {
      console.error('Missing token or user in response:', { responseData, result });
      throw new Error('Invalid login response structure');
    }
    
    return {
      token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    };
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
    }
    localStorage.removeItem('auth_token');
  },

  me: async () => {
    const response = await api.get<ApiResponse<{ user: any }>>('/auth/me');
    const result = response.data.data || response.data;
    return result.user;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post<ApiResponse<{ token: string; refreshToken: string }>>('/auth/refresh', { refreshToken });
    return response.data.data!;
  },

  changePassword: async (newPassword: string) => {
    const response = await api.put<ApiResponse<{ message: string }>>('/auth/password', { newPassword });
    return response.data.data!;
  },

  requestPasswordReset: async (email: string) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/password-reset-request', { email });
    return response.data.data!;
  }
};

// Feed Sources API
export interface FeedSource {
  id: string;
  name: string;
  type: 'rss' | 'podcast' | 'youtube' | 'api' | 'multi_source' | 'reddit';
  url: string;
  is_active: boolean;
  config: Record<string, any>;
  last_processed_at?: string;
  created_at: string;
  updated_at?: string;
  primary_entities?: any[];
  focus_sectors?: any[];
  reliability_score?: number;
}

// Content API
export interface ProcessedContent {
  id: string;
  raw_feed_id: string;
  processed_text: string;
  key_topics: string[];
  sentiment_score: number;
  entities: {
    people: string[];
    tickers: string[];
    companies: string[];
    locations: string[];
  };
  summary: string;
  processing_metadata: Record<string, any>;
  title?: string;
  published_at?: string;
  created_at: string;
  // Frontend might use these
  rawFeedId?: string;
  processedText?: string;
  keyTopics?: string[];
  sentimentScore?: number;
  processingMetadata?: Record<string, any>;
  publishedAt?: string;
  createdAt?: string;
  // Added by the controller
  source_id?: string;
  source_name?: string;
  source_type?: string;
}

export const feedsApi = {
  list: async () => {
    const response = await api.get<ApiResponse<FeedSource[]>>('/feeds');
    return response.data.data!;
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<FeedSource>>(`/feeds/${id}`);
    return response.data.data!;
  },

  create: async (data: Partial<FeedSource>) => {
    console.log('=== Creating feed ===');
    console.log('Request data:', data);
    console.log('Auth token exists:', !!localStorage.getItem('auth_token'));
    
    try {
      const response = await api.post<ApiResponse<FeedSource>>('/feeds', data);
      console.log('Create feed success:', response.data);
      return response.data.data!;
    } catch (error) {
      console.error('Create feed error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        console.error('Error headers:', error.response?.headers);
        
        // Log the specific error details
        if (error.response?.data?.error) {
          console.error('Error details:', {
            code: error.response.data.error.code,
            message: error.response.data.error.message,
            details: error.response.data.error.details
          });
        }
      }
      throw error;
    }
  },

  update: async (id: string, data: Partial<FeedSource>) => {
    try {
      console.log(`Updating feed ${id} with data:`, data);
      const response = await api.put<ApiResponse<FeedSource>>(`/feeds/${id}`, data);
      console.log(`Feed ${id} update response:`, response.data);
      return response.data.data!;
    } catch (error) {
      console.error(`Failed to update feed ${id}:`, error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
      }
      throw error;
    }
  },

  delete: async (id: string) => {
    await api.delete(`/feeds/${id}`);
  },

  process: async (id: string) => {
    await api.post(`/feeds/${id}/process`, {});
  },

  getItems: async (id: string, params?: { limit?: number; offset?: number }) => {
    const response = await api.get<ApiResponse<any[]>>(`/feeds/${id}/items`, { params });
    return response.data.data!;
  },
  processItem: async (feedId: string, itemId: string) => {
    const response = await api.post<ApiResponse<{ jobId: string; feedId: string; itemId: string; message: string }>>(`/feeds/${feedId}/items/${itemId}/process`, {});
    return response.data.data!;
  },

  startHistoricalBackfill: async (options: { daysBack: number; forceRefetch?: boolean; generatePredictions?: boolean; generateAnalysis?: boolean }) => {
    const response = await api.post<ApiResponse<{ message: string; jobsQueued: number }>>('/feeds/historical-backfill', options);
    return response.data.data!;
  }
};

// Content API
export const contentApi = {
  list: async (params?: { limit?: number; offset?: number; sourceId?: string }) => {
    const response = await api.get<ApiResponse<ProcessedContent[]>>('/content', { params });
    return response.data.data!;
  },

  listBySource: async (sourceId: string, limit = 10) => {
    const response = await api.get<ApiResponse<ProcessedContent[]>>(`/content/source/${sourceId}`, {
      params: { limit }
    });
    return response.data.data!;
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<ProcessedContent>>(`/content/${id}`);
    return response.data.data!;
  },

  search: async (query: string) => {
    const response = await api.get<ApiResponse<ProcessedContent[]>>('/content/search', {
      params: { q: query }
    });
    return response.data.data!;
  },

  getStats: async (params?: { startDate?: string; endDate?: string }) => {
    const response = await api.get<ApiResponse<any>>('/content/stats', { params });
    return response.data.data!;
  }
};

// Daily Analysis API
export interface DailyAnalysis {
  id: string;
  analysisDate: Date;
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  keyThemes: string[];
  overallSummary: string;
  aiAnalysis: Record<string, any>;
  confidenceScore: number;
  sourcesAnalyzed: number;
  createdAt: Date;
}

// Timeframe analysis types
export type TimeframePeriod = 'today' | 'week' | 'month' | 'quarter' | 'custom';

export interface Timeframe {
  id: string;
  label: string;
  description: string;
  value?: number;
  unit?: 'day' | 'days' | 'weeks' | 'months';
  type?: 'preset' | 'date-range' | 'rolling';
  icon: string;
  useCase: string;
  isDefault?: boolean;
}

export interface TimeframeQuery {
  period: TimeframePeriod;
  startDate?: string;
  endDate?: string;
  days?: number;
}

export interface TimeframeAnalysis {
  id: string;
  timeframe: TimeframeQuery;
  analysisDate: string;
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  keyThemes: string[];
  overallSummary: string;
  aiAnalysis: {
    marketDrivers: string[];
    riskFactors: string[];
    opportunities: string[];
    geopoliticalContext: string;
    economicIndicators: string[];
    trendAnalysis: {
      direction: 'upward' | 'downward' | 'sideways';
      strength: number;
      volatility: number;
    };
    timeframeSpecificInsights: string[];
  };
  confidenceScore: number;
  sourcesAnalyzed: number;
  contentDistribution: {
    totalItems: number;
    byDate: Record<string, number>;
    bySentiment: Record<string, number>;
    bySource: Record<string, number>;
  };
  createdAt: string;
}

export const analysisApi = {
  list: async () => {
    const response = await api.get<ApiResponse<DailyAnalysis[]>>('/analysis');
    return response.data.data!;
  },

  get: async (date: string) => {
    const response = await api.get<ApiResponse<DailyAnalysis>>(`/analysis/${date}`);
    return response.data.data!;
  },

  getLatest: async () => {
    try {
      const response = await api.get<ApiResponse<DailyAnalysis>>('/analysis/latest');
      return response.data.data!;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // No analysis available yet - this is expected
        return null;
      }
      throw error;
    }
  },

  generate: async (date?: string) => {
    const payload = date ? { date } : { date: new Date().toISOString().split('T')[0] };
    const response = await api.post<ApiResponse<{ jobId: string; message: string }>>(`/analysis/trigger`, payload);
    return response.data.data!;
  },

  // Timeframe analysis endpoints
  getAvailableTimeframes: async () => {
    const response = await api.get<ApiResponse<Timeframe[]>>('/analysis/timeframes/available');
    return response.data.data!;
  },

  getRecommendedTimeframe: async (purpose?: string) => {
    const params = purpose ? `?purpose=${encodeURIComponent(purpose)}` : '';
    const response = await api.get<ApiResponse<{ purpose: string; recommendedTimeframe: string }>>(`/analysis/timeframes/recommended${params}`);
    return response.data.data!;
  },

  getTimeframeAnalysis: async (timeframe: TimeframeQuery) => {
    const params = new URLSearchParams({
      period: timeframe.period,
      ...(timeframe.startDate && { startDate: timeframe.startDate }),
      ...(timeframe.endDate && { endDate: timeframe.endDate }),
      ...(timeframe.days && { days: timeframe.days.toString() })
    });
    
    const response = await api.get<ApiResponse<TimeframeAnalysis>>(`/analysis/timeframe?${params}`);
    return response.data.data!;
  }
};

// Predictions API
export interface Prediction {
  id: string;
  dailyAnalysisId: string;
  predictionType: string;
  predictionText: string;
  confidenceLevel: number;
  timeHorizon: '1_week' | '1_month' | '3_months' | '6_months' | '1_year';
  predictionData: Record<string, any>;
  createdAt: Date;
}

// Helper function to transform prediction from snake_case to camelCase
const transformPrediction = (pred: any): Prediction => ({
  id: pred.id,
  dailyAnalysisId: pred.daily_analysis_id,
  predictionType: pred.prediction_type,
  predictionText: pred.prediction_text,
  confidenceLevel: pred.confidence_level,
  timeHorizon: pred.time_horizon,
  predictionData: pred.prediction_data || {},
  createdAt: new Date(pred.created_at)
});

export const predictionsApi = {
  list: async (filters?: { timeHorizon?: string; type?: string }) => {
    const response = await api.get<ApiResponse<any[]>>('/analysis/predictions', { params: filters });
    const predictions = response.data.data || [];
    return predictions.map(transformPrediction);
  },

  accuracy: async () => {
    const response = await api.get<ApiResponse<any>>('/analysis/accuracy');
    return response.data.data!;
  },

  generate: async (analysisId: string) => {
    const response = await api.post<ApiResponse<{ jobId: string; message: string; analysisId: string; analysisDate: string; existingPredictions: number }>>(`/analysis/${analysisId}/predictions`);
    return response.data.data!;
  },

  getByAnalysis: async (analysisId: string) => {
    const response = await api.get<ApiResponse<any[]>>(`/analysis/${analysisId}/predictions`);
    const predictions = response.data.data || [];
    return predictions.map(transformPrediction);
  }
};

// Dashboard API
export interface DashboardOverview {
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  lastAnalysisDate: string | null;
  confidenceScore: number;
  activeFeedSources: number;
  feedTypes: Record<string, number>;
  recentContentCount: number;
  keyThemes: string[];
  marketDrivers: string[];
  riskFactors: string[];
  activePredictions: Prediction[];
  contributingSources?: {
    sourceIds: string[];
    sources: Array<{ id: string; name: string; count: number }>;
    sourceBreakdown: any[];
  };
}

export interface DashboardTrends {
  sentimentTrend: Array<{
    date: string;
    sentiment: number;
    volume: number;
  }>;
  dailyAnalyses: Array<{
    analysis_date: string;
    market_sentiment: string;
    confidence_score: number;
  }>;
  topicTrends: Array<{
    date: string;
    topics: Array<{ topic: string; count: number }>;
  }>;
}

export interface DashboardAccuracy {
  overall: number;
  byType: Array<{
    type: string;
    accuracy: number;
    total: number;
  }>;
  byHorizon: Array<{
    horizon: string;
    accuracy: number;
    total: number;
  }>;
  recentComparisons: any[];
}

export interface RealtimeStats {
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  transcription: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    feedsAwaitingTranscription: number;
  };
  processing: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  timestamp: string;
}

export const dashboardApi = {
  overview: async () => {
    const response = await api.get<ApiResponse<DashboardOverview>>('/dashboard/overview', {
      params: { _t: Date.now() } // Cache busting
    });
    return response.data.data!;
  },

  trends: async (days: number = 7) => {
    const response = await api.get<ApiResponse<DashboardTrends>>('/dashboard/trends', { params: { days } });
    return response.data.data!;
  },

  themes: async (timeframe: 'week' | 'month' | 'year' = 'week') => {
    const response = await api.get<ApiResponse<{
      timeframe: string;
      startDate: string;
      endDate: string;
      themes: string[];
      marketDrivers: string[];
      riskFactors: string[];
      analysisCount: number;
    }>>('/dashboard/themes', { params: { timeframe } });
    return response.data.data!;
  },

  predictions: async (filters?: { timeHorizon?: string; type?: string }) => {
    const response = await api.get<ApiResponse<any>>('/dashboard/predictions', { params: filters });
    return response.data.data!;
  },

  accuracy: async () => {
    const response = await api.get<ApiResponse<DashboardAccuracy>>('/dashboard/accuracy');
    return response.data.data!;
  },

  stats: async () => {
    const response = await api.get<ApiResponse<RealtimeStats>>('/dashboard/stats');
    return response.data.data!;
  },

  transcription: async (limit: number = 20) => {
    const response = await api.get<ApiResponse<any>>('/dashboard/transcription', { params: { limit } });
    return response.data.data!;
  }
};

// Queue API
export interface QueueJob {
  id: string;
  jobType: string;
  payload: Record<string, any>;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retry';
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  scheduledAt: string | Date;
  startedAt?: string | Date;
  completedAt?: string | Date;
  createdAt: string | Date;
  expiresAt?: string | Date;
}

export interface QueueStats {
  currentQueue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retry: number;
  };
  recentJobs: Array<{
    job_type: string;
    status: string;
    count: number;
    avg_duration: number;
  }>;
  timestamp: Date;
}

export interface QueueStatus {
  isProcessing: boolean;
  timestamp: string | Date;
}

export const queueApi = {
  // Get queue statistics
  getStats: async () => {
    const response = await api.get<ApiResponse<QueueStats>>('/queue/stats');
    return response.data.data!;
  },

  // Get queue processing status
  getStatus: async () => {
    const response = await api.get<ApiResponse<QueueStatus>>('/queue/status');
    return response.data.data!;
  },

  // List jobs with pagination and filtering
  listJobs: async (params?: {
    status?: string;
    jobType?: string;
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get<ApiResponse<QueueJob[]>>('/queue/jobs', { params });
    return response.data;
  },

  // Get specific job details
  getJob: async (id: string) => {
    const response = await api.get<ApiResponse<QueueJob>>(`/queue/jobs/${id}`);
    return response.data.data!;
  },

  // Enqueue a new job
  enqueueJob: async (data: {
    jobType: string;
    payload?: Record<string, any>;
    priority?: number;
    delaySeconds?: number;
  }) => {
    const response = await api.post<ApiResponse<{ jobId: string; message: string }>>('/queue/jobs', data);
    return response.data.data!;
  },

  // Retry a specific job
  retryJob: async (id: string) => {
    const response = await api.post<ApiResponse<{ originalJobId: string; newJobId: string; message: string }>>(`/queue/jobs/${id}/retry`);
    return response.data.data!;
  },

  // Cancel a specific job
  cancelJob: async (id: string) => {
    const response = await api.post<ApiResponse<{ message: string }>>(`/queue/jobs/${id}/cancel`);
    return response.data.data!;
  },

  // Delete a specific job
  deleteJob: async (id: string) => {
    const response = await api.delete<ApiResponse<{ message: string }>>(`/queue/jobs/${id}`);
    return response.data.data!;
  },

  // Clear jobs (with filters)
  clearJobs: async (params?: { status?: string; olderThan?: number }) => {
    const response = await api.delete<ApiResponse<{ deletedCount: number; message: string }>>('/queue/jobs', { params });
    return response.data.data!;
  },

  // Clear completed jobs only
  clearCompleted: async (olderThan: number = 1) => {
    const response = await api.post<ApiResponse<{ deletedCount: number; message: string }>>('/queue/clear/completed', { olderThan });
    return response.data.data!;
  },

  // Clear failed jobs only
  clearFailed: async (olderThan: number = 1) => {
    const response = await api.post<ApiResponse<{ deletedCount: number; message: string }>>('/queue/clear/failed', { olderThan });
    return response.data.data!;
  },

  // Retry all failed jobs
  retryAllFailed: async () => {
    const response = await api.post<ApiResponse<{
      retriedCount: number;
      totalFailed: number;
      message: string;
    }>>('/queue/retry/failed');
    return response.data.data!;
  },

  // Pause queue processing
  pauseQueue: async () => {
    const response = await api.post<ApiResponse<{ message: string }>>('/queue/pause');
    return response.data.data!;
  },

  // Resume queue processing
  resumeQueue: async () => {
    const response = await api.post<ApiResponse<{ message: string }>>('/queue/resume');
    return response.data.data!;
  },

  // Worker Management APIs
  getWorkerStatus: async () => {
    const response = await api.get<ApiResponse<{
      isRunning: boolean;
      concurrency: number;
      activeJobs: number;
      activeJobIds: string[];
      workerCount: number;
    }>>('/queue/worker/status');
    return response.data.data!;
  },

  startWorker: async () => {
    const response = await api.post<ApiResponse<{ message: string; status?: any }>>('/queue/worker/start');
    return response.data.data!;
  },

  stopWorker: async () => {
    const response = await api.post<ApiResponse<{ message: string; status?: any }>>('/queue/worker/stop');
    return response.data.data!;
  },

  restartWorker: async () => {
    const response = await api.post<ApiResponse<{ message: string; status?: any }>>('/queue/worker/restart');
    return response.data.data!;
  },

  resetJob: async (id: string) => {
    const response = await api.post<ApiResponse<{ message: string }>>(`/queue/jobs/${id}/reset`);
    return response.data.data!;
  }
};

// Whisper Service API
export interface WhisperStatus {
  isRunning: boolean;
  version?: string;
  modelLoaded?: string;
  lastUsed?: string;
  totalTranscriptions?: number;
  averageProcessingTime?: number;
}

export const whisperApi = {
  // Get Whisper service status
  getStatus: async () => {
    const response = await api.get<ApiResponse<WhisperStatus>>('/services/whisper/status');
    return response.data.data!;
  },

  // Start Whisper service
  start: async () => {
    const response = await api.post<ApiResponse<{ message: string; status: string }>>('/services/whisper/start');
    return response.data.data!;
  },

  // Stop Whisper service
  stop: async () => {
    const response = await api.post<ApiResponse<{ message: string; status: string }>>('/services/whisper/stop');
    return response.data.data!;
  },

  // Restart Whisper service
  restart: async () => {
    const response = await api.post<ApiResponse<{ message: string; status: string }>>('/services/whisper/restart');
    return response.data.data!;
  },

  // Get transcription queue status
  getTranscriptionQueue: async () => {
    const response = await api.get<ApiResponse<{
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      totalProcessingTime?: number;
    }>>('/services/whisper/queue');
    return response.data.data!;
  }
};

// Subscription API
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: string | null;
  features: string[];
  limits: Record<string, number>;
  isPopular: boolean;
}

export interface UserSubscription {
  tier: string;
  status: string;
  limits: Record<string, any>;
  subscription?: any;
}

export interface UsageStats {
  [key: string]: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export interface ApiKey {
  id: string;
  key_name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

export const subscriptionApi = {
  // Get current subscription details
  getSubscription: async () => {
    const response = await api.get<ApiResponse<UserSubscription>>('/subscription');
    return response.data.data!;
  },

  // Get usage statistics
  getUsage: async () => {
    const response = await api.get<ApiResponse<UsageStats>>('/subscription/usage');
    return response.data.data!;
  },

  // Get available plans
  getPlans: async () => {
    const response = await api.get<ApiResponse<SubscriptionPlan[]>>('/subscription/plans');
    return response.data.data!;
  },

  // Create checkout session
  createCheckout: async (planId: string) => {
    const response = await api.post<ApiResponse<{ checkoutUrl: string; message: string }>>('/subscription/checkout', { planId });
    return response.data.data!;
  },

  // Cancel subscription
  cancelSubscription: async () => {
    const response = await api.post<ApiResponse<{ message: string }>>('/subscription/cancel');
    return response.data.data!;
  }
};

// API Keys API
export const apiKeysApi = {
  // Generate new API key
  generate: async () => {
    const response = await api.post<ApiResponse<{ apiKey: string; message: string }>>('/api-keys');
    return response.data.data!;
  },

  // List API keys
  list: async () => {
    const response = await api.get<ApiResponse<ApiKey[]>>('/api-keys');
    return response.data.data!;
  },

  // Revoke API key
  revoke: async (keyId: string) => {
    const response = await api.delete<ApiResponse<{ message: string }>>(`/api-keys/${keyId}`);
    return response.data.data!;
  }
};

// Generic fetchApi utility function
export const fetchApi = async (endpoint: string, options?: { method?: string; data?: any }) => {
  const method = options?.method || 'GET';
  const config: any = { method };
  
  if (options?.data) {
    config.data = options.data;
  }

  const response = await api.request({ ...config, url: endpoint });
  return response.data.data || response.data;
};