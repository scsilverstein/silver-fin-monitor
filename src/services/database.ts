import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Minimal database service for Netlify Functions
class Database {
  private client: SupabaseClient | null = null;
  private connected = false;

  async connect() {
    // Skip connection in Netlify function to prevent timeout
    if (process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT) {
      console.log('Skipping database connection in serverless environment');
      this.connected = true;
      return;
    }

    if (this.connected) return;

    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.warn('Database credentials not found, skipping connection');
        return;
      }

      this.client = createClient(supabaseUrl, supabaseKey);
      this.connected = true;
      console.log('Database connected');
    } catch (error) {
      console.error('Database connection error:', error);
      // Don't throw, allow function to continue
    }
  }

  async query(sql: string, params?: any[]) {
    if (!this.client) {
      console.warn('Database not connected, returning empty result');
      return [];
    }

    try {
      const { data, error } = await this.client.rpc('query', { sql, params });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Query error:', error);
      return [];
    }
  }

  async disconnect() {
    // No-op for Supabase client
    this.connected = false;
  }
}

export const db = new Database();