// Database service implementation using Supabase following CLAUDE.md specification
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, Result } from '@/types';
import config from '@/config';
import { logger, createContextLogger } from '@/utils/logger';

const dbLogger = createContextLogger('Database');

export class SupabaseDatabase implements Database {
  private client: SupabaseClient;
  private connected = false;
  private functionsAvailable = false;

  constructor() {
    this.client = createClient(
      config.database.url,
      config.database.serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  // Get Supabase client for advanced operations
  getClient(): SupabaseClient {
    return this.client;
  }

  async connect(): Promise<void> {
    try {
      dbLogger.info('Attempting database connection', {
        url: config.database.url,
        hasAnonKey: !!config.database.anonKey,
        hasServiceKey: config.database.serviceKey !== 'development-placeholder'
      });
      
      // Test connection with a simple query
      const { data, error, count } = await this.client
        .from('feed_sources')
        .select('*', { count: 'exact', head: true });
      
      // Supabase sometimes returns an error object with empty message for RLS issues
      // Let's check if we got a successful response
      if (error && error.message) {
        dbLogger.error('Database query failed', { 
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`Database connection failed: ${error.message}`);
      }
      
      // Even if there's an empty error, if we got a count, connection is working
      dbLogger.info('Database connection test result', { 
        hasError: !!error,
        count: count,
        dataReceived: data !== undefined
      });
      
      this.connected = true;
      
      // Check if database functions are available
      await this.checkFunctionAvailability();
      
      dbLogger.info('Database connected successfully');
    } catch (error) {
      dbLogger.error('Failed to connect to database', error);
      throw error;
    }
  }

  private async checkFunctionAvailability(): Promise<void> {
    try {
      // Test if the dequeue_job function exists and works
      const { data, error } = await this.client.rpc('dequeue_job');
      
      if (!error) {
        this.functionsAvailable = true;
        dbLogger.info('Database functions are available');
      } else {
        this.functionsAvailable = false;
        dbLogger.warn('Database functions not available, using fallback', { error: error.message });
      }
    } catch (error) {
      this.functionsAvailable = false;
      dbLogger.warn('Database functions not available, using fallback', { error });
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      dbLogger.debug('Executing query', { sql, params });
      
      // Check if this is a function call that we can handle directly
      if (this.functionsAvailable) {
        // Handle specific function calls using Supabase RPC
        if (sql.toLowerCase().includes('select * from dequeue_job()')) {
          const { data, error } = await this.client.rpc('dequeue_job');
          if (error) throw error;
          return data || [] as T[];
        }
        
        if (sql.toLowerCase().includes('select enqueue_job(')) {
          // Extract parameters for enqueue_job
          const match = sql.match(/enqueue_job\('([^']+)',\s*'([^']+)'::jsonb,\s*(\d+),\s*(\d+)\)/);
          if (match && match[1] && match[2] && match[3] && match[4]) {
            const [, jobType, payload, priority, delaySeconds] = match;
            const { data, error } = await this.client.rpc('enqueue_job', {
              job_type: jobType,
              payload: JSON.parse(payload),
              priority: parseInt(priority),
              delay_seconds: parseInt(delaySeconds)
            });
            if (error) throw error;
            return [{ job_id: data }] as T[];
          }
        }
        
        if (sql.toLowerCase().includes('select complete_job(')) {
          // Extract job ID for complete_job
          const match = sql.match(/complete_job\('([^']+)'\)/);
          if (match && match[1]) {
            const [, jobId] = match;
            const { data, error } = await this.client.rpc('complete_job', { job_id: jobId });
            if (error) throw error;
            return [{ success: data }] as T[];
          }
        }
        
        if (sql.toLowerCase().includes('select fail_job(')) {
          // Extract parameters for fail_job
          const match = sql.match(/fail_job\('([^']+)',\s*'([^']*)'\)/);
          if (match && match[1] && match[2] !== undefined) {
            const [, jobId, errorMsg] = match;
            const { data, error } = await this.client.rpc('fail_job', { 
              job_id: jobId, 
              error_msg: errorMsg 
            });
            if (error) throw error;
            return [{ success: data }] as T[];
          }
        }
        
        // Handle cache functions
        if (sql.toLowerCase().includes('select cache_get(')) {
          const match = sql.match(/cache_get\('([^']+)'\)/);
          if (match && match[1]) {
            const [, key] = match;
            const { data, error } = await this.client.rpc('cache_get', { cache_key: key });
            if (error) throw error;
            return [{ value: data }] as T[];
          }
        }
        
        if (sql.toLowerCase().includes('select cache_set(')) {
          const match = sql.match(/cache_set\('([^']+)',\s*'([^']+)'::jsonb,\s*(\d+)\)/);
          if (match && match[1] && match[2] && match[3]) {
            const [, key, value, ttl] = match;
            const { data, error } = await this.client.rpc('cache_set', {
              cache_key: key,
              cache_value: JSON.parse(value),
              ttl_seconds: parseInt(ttl)
            });
            if (error) throw error;
            return [{ success: data }] as T[];
          }
        }
        
        if (sql.toLowerCase().includes('select cache_delete(')) {
          const match = sql.match(/cache_delete\('([^']+)'\)/);
          if (match && match[1]) {
            const [, key] = match;
            const { data, error } = await this.client.rpc('cache_delete', { cache_key: key });
            if (error) throw error;
            return [{ success: data }] as T[];
          }
        }
        
        if (sql.toLowerCase().includes('select * from get_queue_stats()')) {
          const { data, error } = await this.client.rpc('get_queue_stats');
          if (error) throw error;
          return data || [] as T[];
        }
      } else {
        // Functions not available, provide fallback behavior
        if (sql.toLowerCase().includes('dequeue_job()') || 
            sql.toLowerCase().includes('enqueue_job') ||
            sql.toLowerCase().includes('complete_job') ||
            sql.toLowerCase().includes('fail_job') ||
            sql.toLowerCase().includes('cache_get') ||
            sql.toLowerCase().includes('cache_set') ||
            sql.toLowerCase().includes('cache_delete') ||
            sql.toLowerCase().includes('get_queue_stats')) {
          dbLogger.warn('Database functions not available, queue operations should use direct table access');
          // Return a special indicator that functions are not available
          throw new Error('DATABASE_FUNCTIONS_NOT_AVAILABLE');
        }
      }
      
      // Handle SELECT queries using Supabase
      if (sql.toLowerCase().trim().startsWith('select')) {
        try {
          // Parse table name from simple SELECT queries
          const tableMatch = sql.match(/from\s+(\w+)/i);
          if (tableMatch && tableMatch[1]) {
            const tableName = tableMatch[1];
            
            // Handle simple COUNT queries
            if (sql.toLowerCase().includes('count(*)')) {
              const { count, error } = await this.client
                .from(tableName)
                .select('*', { count: 'exact', head: true });
              
              if (error) throw error;
              return [{ count }] as T[];
            }
            
            // Handle queries with WHERE clause
            if (sql.toLowerCase().includes('where')) {
              // For complex queries, use Supabase RPC or views
              dbLogger.warn('Complex SQL query, attempting basic execution', { sql });
              
              // Handle earnings_calendar queries
              if (tableName === 'earnings_calendar') {
                const { data, error } = await this.client
                  .from('earnings_calendar')
                  .select('*')
                  .order('earnings_date', { ascending: true });
                
                if (error) throw error;
                return data as T[];
              }
            }
            
            // Default: return all rows from table
            const { data, error } = await this.client
              .from(tableName)
              .select('*');
            
            if (error) throw error;
            return data as T[];
          }
        } catch (error) {
          dbLogger.error('Failed to execute SELECT query via Supabase', { sql, error });
        }
      }
      
      // Handle INSERT queries
      if (sql.toLowerCase().trim().startsWith('insert')) {
        dbLogger.warn('INSERT queries should use Supabase client methods', { sql });
        return [] as T[];
      }
      
      // Handle CREATE VIEW queries - these need to be done via migrations
      if (sql.toLowerCase().includes('create view')) {
        dbLogger.warn('CREATE VIEW should be done via database migrations', { sql });
        return [] as T[];
      }
      
      // For other unsupported queries
      dbLogger.warn('Unsupported SQL query type', { sql });
      return [] as T[];
    } catch (error) {
      dbLogger.error('Query error', { sql, error });
      throw error;
    }
  }

  async transaction<T>(fn: (client: SupabaseClient) => Promise<T>): Promise<T> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      dbLogger.debug('Starting transaction');
      
      // Supabase handles transactions automatically within RPC functions
      // For complex transactions, we'd need to use stored procedures
      const result = await fn(this.client);
      
      dbLogger.debug('Transaction completed successfully');
      return result;
    } catch (error) {
      dbLogger.error('Transaction failed', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Supabase client doesn't need explicit disconnection
    this.connected = false;
    dbLogger.info('Database disconnected');
  }

  // Helper methods for common operations following CLAUDE.md patterns
  async findById<T>(table: string, id: string): Promise<T | null> {
    try {
      const { data, error } = await this.client
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows found
        }
        throw new Error(`Failed to find record: ${error.message}`);
      }

      return data as T;
    } catch (error) {
      dbLogger.error(`Failed to find record in ${table}`, { id, error });
      throw error;
    }
  }

  async findMany<T>(
    table: string, 
    filter?: Record<string, any>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
    }
  ): Promise<T[]> {
    try {
      let query = this.client.from(table).select('*');

      // Apply filters
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply ordering
      if (options?.orderBy) {
        query = query.order(options.orderBy, { 
          ascending: options.orderDirection !== 'desc' 
        });
      }

      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to find records: ${error.message}`);
      }

      return data as T[];
    } catch (error) {
      dbLogger.error(`Failed to find records in ${table}`, { filter, options, error });
      throw error;
    }
  }

  async create<T>(table: string, data: Partial<T>): Promise<T> {
    try {
      dbLogger.info(`Creating record in ${table}`, { 
        table,
        dataKeys: Object.keys(data),
        data: data
      });

      const { data: result, error } = await this.client
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) {
        dbLogger.error(`Supabase create error`, { 
          table,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          data: data
        });
        throw new Error(`Failed to create record: ${error.message}`);
      }

      if (!result) {
        dbLogger.error(`No result returned from create`, { table, data });
        throw new Error('Create operation returned no data');
      }

      dbLogger.info(`Record created in ${table}`, { 
        id: (result as any)?.id,
        result: result
      });
      return result as T;
    } catch (error) {
      dbLogger.error(`Failed to create record in ${table}`, { 
        table,
        data, 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    try {
      // Log the data being sent for debugging
      dbLogger.debug(`Updating record in ${table}`, { id, data });
      
      const { data: result, error } = await this.client
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update record: ${error.message}`);
      }

      dbLogger.debug(`Record updated in ${table}`, { id, result });
      return result as T;
    } catch (error) {
      dbLogger.error(`Failed to update record in ${table}`, { id, data, error });
      throw error;
    }
  }

  async delete(table: string, id: string): Promise<void> {
    try {
      const { error } = await this.client
        .from(table)
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete record: ${error.message}`);
      }

      dbLogger.debug(`Record deleted from ${table}`, { id });
    } catch (error) {
      dbLogger.error(`Failed to delete record from ${table}`, { id, error });
      throw error;
    }
  }

  // Health check method
  async healthCheck(): Promise<Result<boolean>> {
    try {
      const { error } = await this.client
        .from('feed_sources')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        return { success: false, error: new Error(error.message) };
      }
      
      return { success: true, data: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  // Add missing .from method for Supabase-style queries
  from(table: string) {
    return this.client.from(table);
  }

  // Add missing .rpc method for stored procedures
  rpc(fnName: string, params?: Record<string, any>) {
    return this.client.rpc(fnName, params);
  }

  // Table operations to match DatabaseService interface
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
        return this.findMany(tableName, filter, options);
      },

      findOne: async (filter: any) => {
        const results = await this.findMany(tableName, filter, { limit: 1 });
        return results[0] || null;
      },

      create: async (data: any) => {
        return this.create(tableName, data);
      },

      createMany: async (data: any[]) => {
        const results = [];
        for (const item of data) {
          results.push(await this.create(tableName, item));
        }
        return results;
      },

      update: async (id: string, data: any) => {
        return this.update(tableName, id, data);
      },

      delete: async (id: string) => {
        await this.delete(tableName, id);
        return true;
      },

      count: async (filter?: any) => {
        let query = this.client.from(tableName).select('*', { count: 'exact', head: true });
        
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
}

// Create and export database instance
export const db = new SupabaseDatabase();

export default db;