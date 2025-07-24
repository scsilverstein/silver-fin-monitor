export interface EarningsCalendar {
  id: string;
  symbol: string;
  company_name?: string;
  earnings_date: string; // ISO date string
  time_of_day?: 'before_market' | 'after_market' | 'during_market';
  fiscal_quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  fiscal_year?: number;
  
  // Estimates
  eps_estimate?: number;
  revenue_estimate?: number; // in thousands
  
  // Actuals
  eps_actual?: number;
  revenue_actual?: number; // in thousands
  
  // Calculated fields
  eps_surprise?: number;
  eps_surprise_percent?: number;
  revenue_surprise?: number;
  revenue_surprise_percent?: number;
  
  // Metadata
  importance_rating?: number; // 0-5 scale
  confirmed: boolean;
  status: 'scheduled' | 'reported' | 'delayed' | 'cancelled';
  
  // Market data
  market_cap?: number; // in thousands
  previous_close?: number;
  
  // Source tracking
  data_source: string;
  external_id?: string;
  last_updated: string;
  created_at: string;
}

export interface EarningsPerformance {
  id: string;
  symbol: string;
  earnings_date: string;
  
  // Price performance
  price_1d_before?: number;
  price_at_close?: number;
  price_1d_after?: number;
  price_3d_after?: number;
  price_7d_after?: number;
  
  // Volume metrics
  avg_volume_30d?: number;
  volume_on_date?: number;
  volume_1d_after?: number;
  
  // Performance calculations
  return_1d?: number;
  return_3d?: number;
  return_7d?: number;
  
  // Volatility
  implied_volatility?: number;
  realized_volatility_7d?: number;
  
  created_at: string;
}

export interface EarningsEstimate {
  id: string;
  symbol: string;
  earnings_date: string;
  estimate_date: string;
  
  eps_estimate?: number;
  revenue_estimate?: number;
  
  analyst_count?: number;
  high_estimate?: number;
  low_estimate?: number;
  
  data_source: string;
  created_at: string;
}

export interface EarningsReport {
  id: string;
  earnings_calendar_id: string;
  filing_type: '10-Q' | '10-K' | '8-K' | '10-Q/A' | '10-K/A';
  filing_date: string;
  accession_number?: string;
  cik?: string;
  
  // Document content
  document_url?: string;
  document_html?: string;
  document_text?: string;
  
  // Processed sections
  business_section?: string;
  financial_statements?: string;
  risk_factors?: string;
  management_discussion?: string;
  
  // AI processing results
  key_themes?: string[];
  sentiment_score?: number;
  risk_assessment?: string;
  opportunities?: string;
  summary?: string;
  
  // Financial metrics
  extracted_metrics?: Record<string, any>;
  
  // Processing status
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_metadata?: Record<string, any>;
  ai_analysis_completed: boolean;
  
  processed_at?: string;
  created_at: string;
}

export interface EarningsReportSection {
  id: string;
  earnings_report_id: string;
  section_type: 'income_statement' | 'balance_sheet' | 'cash_flow' | 'md_a' | 'risk_factors' | 'business' | 'notes';
  section_title?: string;
  section_content?: string;
  section_order?: number;
  
  // AI processing
  section_summary?: string;
  key_points?: string[];
  sentiment_score?: number;
  extracted_figures?: Record<string, any>;
  
  created_at: string;
}

export interface EarningsCallTranscript {
  id: string;
  earnings_calendar_id: string;
  call_date: string;
  call_time?: string;
  duration_minutes?: number;
  
  // Content
  full_transcript?: string;
  prepared_remarks?: string;
  qa_section?: string;
  
  // Participants
  management_participants?: Array<{
    name: string;
    title: string;
    company: string;
  }>;
  analyst_participants?: Array<{
    name: string;
    firm: string;
  }>;
  
  // AI analysis
  key_themes?: string[];
  sentiment_score?: number;
  management_tone?: 'confident' | 'cautious' | 'defensive' | 'optimistic' | 'neutral';
  forward_guidance?: string;
  analyst_concerns?: string[];
  
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  ai_analysis_completed: boolean;
  processed_at?: string;
  created_at: string;
}

export interface EarningsContentMapping {
  id: string;
  earnings_calendar_id: string;
  processed_content_id: string;
  content_source: 'filing' | 'transcript' | 'news' | 'analysis';
  relevance_score?: number;
  created_at: string;
}

export interface EarningsCalendarWithStats extends EarningsCalendar {
  time_bucket: 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'future';
  days_until: number;
  reporting_status: 'reported' | 'missed' | 'scheduled';
  has_reports: boolean;
  has_transcripts: boolean;
  related_content_count: number;
}

export interface EarningsPerformanceStats {
  avg_eps_surprise_percent?: number;
  avg_revenue_surprise_percent?: number;
  avg_return_1d?: number;
  avg_return_3d?: number;
  surprise_accuracy_rate?: number;
  beat_rate?: number;
}

// API Response types
export interface UpcomingEarningsResponse {
  symbol: string;
  company_name?: string;
  earnings_date: string;
  time_of_day?: string;
  eps_estimate?: number;
  revenue_estimate?: number;
  importance_rating?: number;
  days_until: number;
}

// Polygon.io API types
export interface PolygonEarningsResponse {
  status: string;
  results?: PolygonEarningsResult[];
  next_url?: string;
}

export interface PolygonEarningsResult {
  ticker: string;
  name?: string;
  earnings_date?: string;
  time_of_day?: string;
  fiscal_quarter?: string;
  fiscal_year?: number;
  eps_estimate?: number;
  revenue_estimate?: number;
  eps_actual?: number;
  revenue_actual?: number;
  importance?: number;
  confirmed?: boolean;
  market_cap?: number;
  previous_close?: number;
}

// Filter and query types
export interface EarningsCalendarFilters {
  symbol?: string;
  start_date?: string;
  end_date?: string;
  importance_min?: number;
  status?: 'scheduled' | 'reported' | 'delayed' | 'cancelled';
  time_of_day?: 'before_market' | 'after_market' | 'during_market';
  confirmed_only?: boolean;
}

export interface EarningsCalendarQuery {
  filters?: EarningsCalendarFilters;
  limit?: number;
  offset?: number;
  sort_by?: 'earnings_date' | 'importance_rating' | 'market_cap';
  sort_direction?: 'asc' | 'desc';
}

// Calendar view types for frontend
export interface EarningsCalendarDay {
  date: string;
  earnings: EarningsCalendarWithStats[];
  total_companies: number;
  high_importance_count: number;
  market_cap_total: number;
}

export interface EarningsCalendarWeek {
  week_start: string;
  week_end: string;
  days: EarningsCalendarDay[];
  total_earnings: number;
}

export interface EarningsCalendarMonth {
  month: string;
  year: number;
  weeks: EarningsCalendarWeek[];
  total_earnings: number;
  major_earnings: EarningsCalendarWithStats[];
}

// Analysis types
export interface EarningsImpactAnalysis {
  symbol: string;
  expected_impact: 'high' | 'medium' | 'low';
  risk_factors: string[];
  opportunities: string[];
  analyst_sentiment: 'bullish' | 'bearish' | 'neutral';
  price_target_change_probability: number;
  sector_impact_potential: 'high' | 'medium' | 'low';
}

export interface EarningsSeasonSummary {
  period: string; // e.g., "Q4 2024"
  total_companies: number;
  companies_reported: number;
  companies_scheduled: number;
  overall_beat_rate: number;
  sector_performance: {
    sector: string;
    beat_rate: number;
    avg_surprise_percent: number;
    total_companies: number;
  }[];
  market_reaction_summary: {
    avg_post_earnings_move: number;
    positive_reactions: number;
    negative_reactions: number;
  };
}

// UI Component prop types
export interface EarningsCalendarViewProps {
  view: 'day' | 'week' | 'month';
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewChange: (view: 'day' | 'week' | 'month') => void;
  filters?: EarningsCalendarFilters;
  onFiltersChange?: (filters: EarningsCalendarFilters) => void;
}

export interface EarningsCardProps {
  earning: EarningsCalendarWithStats;
  showPerformance?: boolean;
  onClick?: (earning: EarningsCalendarWithStats) => void;
  compact?: boolean;
}

export interface EarningsStatsProps {
  symbol: string;
  stats: EarningsPerformanceStats;
  loading?: boolean;
}