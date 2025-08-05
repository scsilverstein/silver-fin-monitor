// Core TypeScript interfaces and types for Silver Fin Monitor
// Following CLAUDE.md specification patterns

// Result pattern for error handling
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
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
  analysisDate: Date;
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
  createdAt: Date;
}

export interface AnalysisConstraints {
  minimumContent: Record<number, number>;
  analysisTypes: Record<string, TimeframePeriod[]>;
  maxDays: number;
  defaultDays: number;
}

// Database entities
export interface FeedSource {
  id: string;
  name: string;
  type: 'podcast' | 'rss' | 'youtube' | 'api' | 'multi_source' | 'reddit';
  url: string;
  lastProcessedAt?: Date;
  isActive: boolean;
  config: FeedConfig;
  createdAt: Date;
  updatedAt?: Date;
}

export interface FeedConfig {
  categories: string[];
  priority: 'low' | 'medium' | 'high';
  updateFrequency: string;
  transcriptSource?: string;
  extractGuests?: boolean;
  processTranscript?: boolean;
  customHeaders?: Record<string, string>;
  rateLimit?: {
    requests: number;
    period: string;
  };
  sources?: Array<{
    url: string;
    type: string;
  }>;
  extractVideoTranscript?: boolean;
  [key: string]: any; // Allow additional config properties
}

export interface RawFeed {
  id: string;
  sourceId: string;
  title?: string;
  description?: string;
  content?: string;
  publishedAt?: Date;
  externalId?: string;
  metadata: Record<string, any>;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export interface ProcessedContent {
  id: string;
  rawFeedId: string;
  processedText?: string;
  keyTopics: string[];
  sentimentScore?: number;
  entities: ContentEntities;
  summary?: string;
  processingMetadata: ProcessingMetadata;
  createdAt: Date;
}

export interface ContentEntity {
  name: string;
  type: string;
  metadata?: Record<string, any>;
}

export type ContentEntities = ContentEntity[];

export interface ProcessingMetadata {
  processorVersion: string;
  processingTime: number;
  models: {
    sentiment?: string;
    entities?: string;
    summary?: string;
  };
  [key: string]: any;
}

export interface DailyAnalysis {
  id: string;
  analysisDate: Date;
  marketSentiment?: string;
  keyThemes: string[];
  overallSummary?: string;
  aiAnalysis: Record<string, any>;
  confidenceScore?: number;
  sourcesAnalyzed: number;
  createdAt: Date;
}

export interface Prediction {
  id: string;
  dailyAnalysisId?: string;
  predictionType?: string;
  predictionText?: string;
  confidenceLevel?: number;
  timeHorizon: '1_week' | '1_month' | '3_months' | '6_months' | '1_year';
  predictionData: Record<string, any>;
  createdAt: Date;
}

// Queue system types
export interface QueueJob {
  id: string;
  jobType: string;
  priority: number;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retry';
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface JobPayload {
  feedFetch?: { sourceIds?: string[]; sourceId?: string };
  contentProcess?: { rawFeedId: string };
  dailyAnalysis?: { date: string };
  predictionComparison?: { date: string };
  cleanup?: Record<string, any>;
}

// Cache types
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: Date;
  createdAt: Date;
}

// Service interfaces following dependency injection pattern
export interface Database {
  connect(): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  transaction<T>(fn: (client: any) => Promise<T>): Promise<T>;
  disconnect(): Promise<void>;
  findById<T>(table: string, id: string): Promise<T | null>;
  findMany<T>(table: string, filter?: Record<string, any>, options?: any): Promise<T[]>;
  create<T>(table: string, data: Partial<T>): Promise<T>;
  update<T>(table: string, id: string, data: Partial<T>): Promise<T>;
  delete(table: string, id: string): Promise<void>;
  healthCheck(): Promise<Result<any>>;
  getClient(): any; // Returns the underlying database client (SupabaseClient)
  from(table: string): any; // Returns Supabase query builder
  rpc(fnName: string, params?: Record<string, any>): any; // Returns RPC function call
  tables: {
    feedSources: any;
    rawFeeds: any;
    processedContent: any;
    dailyAnalysis: any;
    predictions: any;
    entities: any;
    stockData: any;
    users: any;
    alerts: any;
    jobQueue: any;
    cacheStore: any;
  };
}

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  cleanup(): Promise<void>;
  healthCheck(): Promise<Result<any>>;
  invalidateByTag(tag: string): Promise<void>;
}

export interface Queue {
  enqueue(jobType: string, payload: Record<string, any>, priority?: number, delaySeconds?: number): Promise<string>;
  dequeue(): Promise<QueueJob | null>;
  complete(jobId: string): Promise<boolean>;
  fail(jobId: string, errorMessage: string): Promise<boolean>;
  getStats(): Promise<Record<string, number>>;
  start(): void;
  stop(): Promise<void>;
  healthCheck(): Promise<Result<any>>;
}

// Feed processing interfaces
export interface FeedProcessor {
  fetchLatest(): Promise<RawFeed[]>;
  processContent(feed: RawFeed): Promise<Result<ProcessedContent>>;
  validate(feed: RawFeed): boolean;
}

export interface BaseFeedProcessorDeps {
  db: Database;
  cache: Cache;
  logger: Logger;
}

// AI service interfaces
export interface AIAnalysisService {
  generateDailyAnalysis(content: ProcessedContent[]): Promise<Result<DailyAnalysis>>;
  generatePredictions(analysis: DailyAnalysis): Promise<Result<Prediction[]>>;
  comparePredictions(previousPrediction: Prediction, currentAnalysis: DailyAnalysis): Promise<Result<PredictionComparison>>;
}

export interface PredictionComparison {
  id: string;
  comparisonDate: Date;
  previousPredictionId: string;
  currentAnalysisId: string;
  accuracyScore: number;
  outcomeDescription: string;
  comparisonAnalysis: Record<string, any>;
  createdAt: Date;
}

// Configuration types
export interface Config {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  openai: OpenAIConfig;
  youtube?: YouTubeConfig;
  jwt: JWTConfig;
  cache: CacheConfig;
  queue: QueueConfig;
  logging: LoggingConfig;
}

export interface DatabaseConfig {
  url: string;
  anonKey: string;
  serviceKey: string;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  fallbackModel: string;
}

export interface YouTubeConfig {
  apiKey: string;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
}

export interface CacheConfig {
  defaultTtl: number;
}

export interface QueueConfig {
  maxRetries: number;
  defaultPriority: number;
  cleanupInterval: number;
}

export interface LoggingConfig {
  level: string;
}

// Logger interface
export interface Logger {
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

// API types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  path: string;
}

// Authentication types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
}

// Feed source creation/update types
export interface CreateFeedSourceData {
  name: string;
  type: FeedSource['type'];
  url: string;
  config: FeedConfig;
}

export interface UpdateFeedSourceData {
  name?: string;
  url?: string;
  isActive?: boolean;
  config?: Partial<FeedConfig>;
}

// Query filters
export interface FeedFilter {
  type?: string;
  category?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface ContentFilter {
  sourceId?: string;
  startDate?: Date;
  endDate?: Date;
  sentiment?: 'positive' | 'negative' | 'neutral';
  limit?: number;
  offset?: number;
}

// Processing status types
export interface ProcessingStats {
  totalFeeds: number;
  processedToday: number;
  pendingJobs: number;
  processingJobs: number;
  failedJobs: number;
  latestAnalysis?: Date;
}