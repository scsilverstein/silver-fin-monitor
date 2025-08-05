// SQL to Supabase Query Builder Parser
import { SupabaseClient } from '@supabase/supabase-js';

export interface ParsedQuery {
  type: 'select' | 'insert' | 'update' | 'delete' | 'raw';
  table?: string;
  fields?: string[];
  conditions?: any;
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
  data?: any;
  raw?: string;
}

export class SQLParser {
  // Basic SQL parser for common queries
  static parse(sql: string, params?: any[]): ParsedQuery {
    const normalizedSql = sql.trim().toLowerCase();
    
    // Handle cache functions specially
    if (normalizedSql.includes('cache_get') || normalizedSql.includes('cache_set') || normalizedSql.includes('cache_delete')) {
      return { type: 'raw', raw: sql };
    }
    
    // SELECT queries
    if (normalizedSql.startsWith('select')) {
      return this.parseSelect(sql, params);
    }
    
    // INSERT queries
    if (normalizedSql.startsWith('insert')) {
      return this.parseInsert(sql, params);
    }
    
    // UPDATE queries
    if (normalizedSql.startsWith('update')) {
      return this.parseUpdate(sql, params);
    }
    
    // DELETE queries
    if (normalizedSql.startsWith('delete')) {
      return this.parseDelete(sql, params);
    }
    
    // Default to raw
    return { type: 'raw', raw: sql };
  }
  
  private static parseSelect(sql: string, params?: any[]): ParsedQuery {
    const query: ParsedQuery = { type: 'select' };
    
    // Extract table name
    const fromMatch = sql.match(/from\s+(\w+)/i);
    if (fromMatch) {
      query.table = fromMatch[1];
    }
    
    // Extract fields
    const selectMatch = sql.match(/select\s+(.+?)\s+from/i);
    if (selectMatch) {
      const fieldsStr = selectMatch[1];
      if (fieldsStr.trim() === '*') {
        query.fields = ['*'];
      } else {
        query.fields = fieldsStr.split(',').map(f => f.trim());
      }
    }
    
    // Extract ORDER BY
    const orderByMatch = sql.match(/order\s+by\s+(.+?)(?:\s+limit|\s*$)/i);
    if (orderByMatch) {
      const orderParts = orderByMatch[1].split(',');
      query.orderBy = orderParts.map(part => {
        const [field, direction] = part.trim().split(/\s+/);
        return { 
          field, 
          direction: (direction?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
        };
      });
    }
    
    // Extract LIMIT
    const limitMatch = sql.match(/limit\s+(\d+)/i);
    if (limitMatch) {
      query.limit = parseInt(limitMatch[1]);
    }
    
    // Extract OFFSET
    const offsetMatch = sql.match(/offset\s+(\d+)/i);
    if (offsetMatch) {
      query.offset = parseInt(offsetMatch[1]);
    }
    
    // Extract WHERE conditions (basic support)
    const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|\s*$)/i);
    if (whereMatch) {
      query.conditions = this.parseWhereClause(whereMatch[1], params);
    }
    
    return query;
  }
  
  private static parseInsert(sql: string, params?: any[]): ParsedQuery {
    const query: ParsedQuery = { type: 'insert' };
    
    // Extract table name
    const tableMatch = sql.match(/insert\s+into\s+(\w+)/i);
    if (tableMatch) {
      query.table = tableMatch[1];
    }
    
    // For parameterized queries, assume data is in params
    if (params && params.length > 0) {
      query.data = params[0];
    }
    
    return query;
  }
  
  private static parseUpdate(sql: string, params?: any[]): ParsedQuery {
    const query: ParsedQuery = { type: 'update' };
    
    // Extract table name
    const tableMatch = sql.match(/update\s+(\w+)/i);
    if (tableMatch) {
      query.table = tableMatch[1];
    }
    
    // For parameterized queries, assume data is in params
    if (params && params.length > 0) {
      query.data = params[0];
    }
    
    // Extract WHERE conditions
    const whereMatch = sql.match(/where\s+(.+?)$/i);
    if (whereMatch) {
      query.conditions = this.parseWhereClause(whereMatch[1], params?.slice(1));
    }
    
    return query;
  }
  
  private static parseDelete(sql: string, params?: any[]): ParsedQuery {
    const query: ParsedQuery = { type: 'delete' };
    
    // Extract table name
    const tableMatch = sql.match(/delete\s+from\s+(\w+)/i);
    if (tableMatch) {
      query.table = tableMatch[1];
    }
    
    // Extract WHERE conditions
    const whereMatch = sql.match(/where\s+(.+?)$/i);
    if (whereMatch) {
      query.conditions = this.parseWhereClause(whereMatch[1], params);
    }
    
    return query;
  }
  
  private static parseWhereClause(whereStr: string, params?: any[]): any {
    // Very basic WHERE clause parsing
    // In a real implementation, this would be more sophisticated
    const conditions: any = {};
    
    // Handle simple equality conditions
    const equalityMatch = whereStr.match(/(\w+)\s*=\s*\$?(\d+|\w+|'[^']*')/g);
    if (equalityMatch) {
      equalityMatch.forEach((match, index) => {
        const [field, value] = match.split('=').map(s => s.trim());
        if (value.startsWith('$') && params) {
          const paramIndex = parseInt(value.substring(1)) - 1;
          conditions[field] = params[paramIndex];
        } else {
          conditions[field] = value.replace(/'/g, '');
        }
      });
    }
    
    return conditions;
  }
}

// Execute parsed query using Supabase client
export async function executeQuery(client: SupabaseClient, sql: string, params?: any[]): Promise<any[]> {
  const parsed = SQLParser.parse(sql, params);
  
  if (parsed.type === 'raw') {
    // For cache functions and other RPC calls
    if (parsed.raw?.includes('cache_get')) {
      const { data, error } = await client.rpc('cache_get', { cache_key: params?.[0] });
      if (error) throw error;
      return [{ value: data }];
    }
    if (parsed.raw?.includes('cache_set')) {
      const { error } = await client.rpc('cache_set', { 
        cache_key: params?.[0], 
        cache_value: params?.[1], 
        ttl_seconds: params?.[2] 
      });
      if (error) throw error;
      return [];
    }
    if (parsed.raw?.includes('cache_delete')) {
      const { error } = await client.rpc('cache_delete', { cache_key: params?.[0] });
      if (error) throw error;
      return [];
    }
    
    // For other raw queries, throw error
    throw new Error(`Unsupported SQL query: ${sql}`);
  }
  
  if (!parsed.table) {
    throw new Error('Table name not found in query');
  }
  
  switch (parsed.type) {
    case 'select': {
      let query = client.from(parsed.table).select(parsed.fields?.join(',') || '*');
      
      // Apply conditions
      if (parsed.conditions) {
        Object.entries(parsed.conditions).forEach(([field, value]) => {
          query = query.eq(field, value);
        });
      }
      
      // Apply ordering
      if (parsed.orderBy) {
        parsed.orderBy.forEach(({ field, direction }) => {
          query = query.order(field, { ascending: direction === 'asc' });
        });
      }
      
      // Apply limit
      if (parsed.limit) {
        query = query.limit(parsed.limit);
      }
      
      // Apply offset
      if (parsed.offset) {
        query = query.range(parsed.offset, parsed.offset + (parsed.limit || 10) - 1);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
    
    case 'insert': {
      const { data, error } = await client
        .from(parsed.table)
        .insert(parsed.data)
        .select();
      if (error) throw error;
      return data || [];
    }
    
    case 'update': {
      let query = client.from(parsed.table).update(parsed.data);
      
      // Apply conditions
      if (parsed.conditions) {
        Object.entries(parsed.conditions).forEach(([field, value]) => {
          query = query.eq(field, value);
        });
      }
      
      const { data, error } = await query.select();
      if (error) throw error;
      return data || [];
    }
    
    case 'delete': {
      let query = client.from(parsed.table).delete();
      
      // Apply conditions
      if (parsed.conditions) {
        Object.entries(parsed.conditions).forEach(([field, value]) => {
          query = query.eq(field, value);
        });
      }
      
      const { error } = await query;
      if (error) throw error;
      return [];
    }
    
    default:
      throw new Error(`Unsupported query type: ${parsed.type}`);
  }
}