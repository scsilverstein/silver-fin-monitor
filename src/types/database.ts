// Database types stub file
// In a real implementation, this would be generated from Supabase

export interface Database {
  public: {
    Tables: {
      feed_sources: {
        Row: {
          id: string;
          name: string;
          type: string;
          url: string;
          is_active: boolean;
          config: any;
          last_processed_at: string | null;
          created_at: string;
        };
      };
      raw_feeds: {
        Row: {
          id: string;
          source_id: string;
          title: string;
          description: string;
          content: string;
          published_at: string;
          external_id: string;
          metadata: any;
          processing_status: string;
          created_at: string;
        };
      };
      processed_content: {
        Row: {
          id: string;
          raw_feed_id: string;
          processed_text: string;
          key_topics: string[];
          sentiment_score: number;
          entities: any;
          summary: string;
          processing_metadata: any;
          created_at: string;
        };
      };
      earnings_calendar: {
        Row: {
          id: string;
          symbol: string;
          company_name: string | null;
          earnings_date: string;
          time_of_day: string | null;
          fiscal_quarter: string | null;
          fiscal_year: number | null;
          eps_estimate: number | null;
          revenue_estimate: number | null;
          eps_actual: number | null;
          revenue_actual: number | null;
          eps_surprise: number | null;
          eps_surprise_percent: number | null;
          revenue_surprise: number | null;
          revenue_surprise_percent: number | null;
          importance_rating: number | null;
          confirmed: boolean;
          status: string;
          market_cap: number | null;
          previous_close: number | null;
          data_source: string;
          external_id: string | null;
          last_updated: string;
          created_at: string;
        };
      };
    };
  };
}