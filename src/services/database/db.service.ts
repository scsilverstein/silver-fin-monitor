import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '../../config';
import winston from 'winston';
import { Database } from '../../types';
import { executeQuery } from './sql-parser';

export interface DatabaseConfig {
  url: string;
  anonKey: string;
  serviceKey?: string;
}

export interface QueryResult<T = any> {
  data: T[] | T | null;
  error: Error | null;
  count?: number;
}

export class DatabaseService implements Database {
  private supabase: SupabaseClient;
  private logger: winston.Logger;

  constructor(config: DatabaseConfig, logger: winston.Logger) {
    this.supabase = createClient(
      config.url,
      config.serviceKey || config.anonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: false
        }
      }
    );
    this.logger = logger;
  }

  // Generic query method
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      // Use the SQL parser to execute queries
      const result = await executeQuery(this.supabase, sql, params);
      return result as T[];
    } catch (error) {
      this.logger.error('Database query error:', { sql, error });
      throw error;
    }
  }

  // Transaction support
  async transaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    const tx = new DatabaseTransaction(this.supabase, this.logger);
    try {
      await tx.begin();
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  // Table-specific methods
  tables = {
    feedSources: this.createTableOperations('feed_sources'),
    rawFeeds: this.createTableOperations('raw_feeds'),
    processedContent: this.createTableOperations('processed_content'),
    dailyAnalysis: this.createTableOperations('daily_analysis'),
    predictions: this.createTableOperations('predictions'),
    entities: this.createTableOperations('entities'),
    stockData: this.createTableOperations('stock_data'),
    users: this.createTableOperations('users'),
    alerts: this.createTableOperations('alerts'),
    jobQueue: this.createTableOperations('job_queue'),
    cacheStore: this.createTableOperations('cache_store')
  };

  // Create standard CRUD operations for a table
  private createTableOperations(tableName: string) {
    return {
      findMany: async (filter?: any, options?: any) => {
        let query = this.supabase.from(tableName).select(options?.select || '*');
        
        if (filter) {
          Object.entries(filter).forEach(([key, value]) => {
            if (value !== undefined) {
              query = query.eq(key, value);
            }
          });
        }

        if (options?.orderBy) {
          query = query.order(options.orderBy.field, { ascending: options.orderBy.ascending ?? true });
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        if (options?.offset) {
          query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      },

      findOne: async (filter: any) => {
        const results = await this.tables[tableName as keyof typeof this.tables].findMany(filter, { limit: 1 });
        return results[0] || null;
      },

      create: async (data: any) => {
        const { data: result, error } = await this.supabase
          .from(tableName)
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return result;
      },

      createMany: async (data: any[]) => {
        const { data: results, error } = await this.supabase
          .from(tableName)
          .insert(data)
          .select();
        
        if (error) throw error;
        return results;
      },

      update: async (id: string, data: any) => {
        const { data: result, error } = await this.supabase
          .from(tableName)
          .update(data)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return result;
      },

      delete: async (id: string) => {
        const { error } = await this.supabase
          .from(tableName)
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return true;
      },

      count: async (filter?: any) => {
        let query = this.supabase.from(tableName).select('*', { count: 'exact', head: true });
        
        if (filter) {
          Object.entries(filter).forEach(([key, value]) => {
            if (value !== undefined) {
              query = query.eq(key, value);
            }
          });
        }

        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      }
    };
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  // Additional Database interface methods
  async connect(): Promise<void> {
    // Supabase auto-connects, this is a no-op for compatibility
    this.logger.info('Database connected');
  }

  async disconnect(): Promise<void> {
    // Supabase handles connection pooling, this is a no-op for compatibility
    this.logger.info('Database disconnected');
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    
    return data as T;
  }

  async findMany<T>(table: string, filter?: Record<string, any>, options?: any): Promise<T[]> {
    let query = this.supabase.from(table).select(options?.select || '*');
    
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key, value);
        }
      });
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy.field, { ascending: options.orderBy.ascending ?? true });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as T[];
  }

  async create<T>(table: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(table)
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result as T;
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return result as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from(table)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async healthCheck(): Promise<{ success: boolean; data?: any; error?: Error }> {
    try {
      await this.query('SELECT 1');
      return { success: true, data: { status: 'healthy' } };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  // Get Supabase client for advanced operations
  getClient(): SupabaseClient {
    return this.supabase;
  }

  // Additional helper methods
  from(table: string) {
    return this.supabase.from(table);
  }

  rpc(fnName: string, params?: Record<string, any>) {
    return this.supabase.rpc(fnName, params);
  }
}

// Transaction helper class
class DatabaseTransaction {
  private supabase: SupabaseClient;
  private logger: winston.Logger;
  private inTransaction = false;

  constructor(supabase: SupabaseClient, logger: winston.Logger) {
    this.supabase = supabase;
    this.logger = logger;
  }

  async begin(): Promise<void> {
    await this.supabase.rpc('begin_transaction');
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (this.inTransaction) {
      await this.supabase.rpc('commit_transaction');
      this.inTransaction = false;
    }
  }

  async rollback(): Promise<void> {
    if (this.inTransaction) {
      await this.supabase.rpc('rollback_transaction');
      this.inTransaction = false;
    }
  }
}

// Singleton instance
let dbInstance: DatabaseService | null = null;

export const getDatabase = (logger: winston.Logger): DatabaseService => {
  if (!dbInstance) {
    dbInstance = new DatabaseService(
      {
        url: config.database.url,
        anonKey: config.database.anonKey,
        serviceKey: config.database.serviceKey
      },
      logger
    );
  }
  return dbInstance;
};

export default DatabaseService;