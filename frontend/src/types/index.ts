// Core types for Silver Fin Monitor frontend
// Following CLAUDE.md specification

// API Response types
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

// User & Auth types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Feed types
export interface FeedSource {
  id: string;
  name: string;
  type: 'rss' | 'podcast' | 'youtube' | 'api' | 'multi_source';
  url: string;
  config: {
    categories: string[];
    priority: 'low' | 'medium' | 'high';
    update_frequency: string;
    extract_entities?: boolean;
    process_transcript?: boolean;
    [key: string]: any;
  };
  is_active: boolean;
  last_processed_at?: string;
  created_at: string;
}

export interface RawFeed {
  id: string;
  source_id: string;
  title: string;
  description?: string;
  content?: string;
  published_at: string;
  external_id: string;
  metadata: Record<string, any>;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface ProcessedContent {
  id: string;
  raw_feed_id: string;
  processed_text: string;
  key_topics: string[];
  sentiment_score: number;
  entities: {
    companies: string[];
    people: string[];
    locations: string[];
    tickers: string[];
  };
  summary: string;
  processing_metadata: Record<string, any>;
  created_at: string;
}

// Analysis types
export interface DailyAnalysis {
  id: string;
  analysisDate: string;
  marketSentiment: 'bullish' | 'bearish' | 'neutral' | 'cautiously_optimistic' | 'cautiously_pessimistic';
  keyThemes: string[];
  overallSummary: string;
  aiAnalysis: {
    keyDrivers: string[];
    riskFactors: string[];
    opportunities: string[];
    outlook: string;
    [key: string]: any;
  };
  confidenceScore: number;
  sourcesAnalyzed: number;
  createdAt: string;
}

export interface Prediction {
  id: string;
  daily_analysis_id: string;
  prediction_type: 'market_direction' | 'sector_performance' | 'economic_indicator' | 'geopolitical_event';
  prediction_text: string;
  confidence_level: number;
  time_horizon: '1_week' | '2_weeks' | '1_month' | '3_months' | '6_months' | '1_year';
  prediction_data: Record<string, any>;
  created_at: string;
}

export interface PredictionComparison {
  id: string;
  prediction_id: string;
  comparison_date: string;
  actual_outcome: string;
  accuracy_score: number;
  analysis: Record<string, any>;
  created_at: string;
}

// Dashboard types
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
}

export interface MarketTrend {
  date: string;
  sentiment: number;
  volume: number;
  confidence: number;
}

export interface AccuracyMetrics {
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
}

// Queue types
export interface QueueJob {
  id: string;
  job_type: 'feed_fetch' | 'content_process' | 'daily_analysis' | 'prediction_compare';
  payload: Record<string, any>;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retry';
  attempts: number;
  max_attempts: number;
  error_message?: string;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retry: number;
  average_processing_time?: number;
}

// Stock Scanner types
export interface StockSymbol {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  market_cap?: number;
  is_active: boolean;
}

export interface StockFundamentals {
  id: string;
  symbol_id: string;
  date: string;
  price: number;
  pe_ratio?: number;
  forward_pe?: number;
  eps?: number;
  forward_eps?: number;
  market_cap?: number;
  metadata: Record<string, any>;
}

export interface StockScannerResult {
  id: string;
  symbol_id: string;
  scan_date: string;
  momentum_score: number;
  value_score: number;
  composite_score: number;
  changes: {
    earnings_1d?: number;
    earnings_5d?: number;
    earnings_30d?: number;
    pe_1d?: number;
    pe_5d?: number;
    pe_30d?: number;
  };
  peer_comparison: {
    industry_percentile?: number;
    sector_percentile?: number;
    peer_count: number;
  };
  alerts: string[];
}

// Alias for compatibility
export type ScannerResult = StockScannerResult;

export interface StockAlert {
  id: string;
  symbol: string;
  alertType: 'bullish_momentum' | 'value_opportunity' | 'bearish_divergence' | 'peer_outperformance';
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  metadata?: Record<string, any>;
}

// Cache types
export interface CacheEntry {
  key: string;
  value: any;
  expires_at: string;
  created_at: string;
}

// Settings types
export interface UserSettings {
  notifications: {
    email: boolean;
    browser: boolean;
    analysis_complete: boolean;
    prediction_due: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'system';
    timezone: string;
    dateFormat: string;
  };
  preferences: {
    defaultDashboardView: string;
    feedRefreshInterval: number;
    autoGenerateAnalysis: boolean;
  };
}

// Component Props types
export interface TableColumn<T> {
  header: string;
  accessor: keyof T | ((item: T) => any);
  className?: string;
  sortable?: boolean;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

// Form types
export interface FeedFormData {
  name: string;
  type: FeedSource['type'];
  url: string;
  categories: string[];
  priority: 'low' | 'medium' | 'high';
  updateFrequency: string;
  extractEntities: boolean;
  processTranscript: boolean;
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Real-time update types
export interface RealtimeEvent {
  type: 'feed_update' | 'analysis_complete' | 'prediction_generated' | 'queue_update';
  payload: any;
  timestamp: string;
}

// Notification types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

// Export all types
export * from './entityAnalytics';