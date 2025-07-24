import { supabase } from './client';
import { logger } from '@/utils/logger';

export class DatabaseCacheService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const { data, error } = await supabase
        .rpc('cache_get', { cache_key: key });

      if (error || !data) return null;
      
      // Parse JSON if it's a string
      if (typeof data === 'string') {
        return JSON.parse(data) as T;
      }
      
      return data as T;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    try {
      const { error } = await supabase
        .rpc('cache_set', {
          cache_key: key,
          cache_value: JSON.stringify(value),
          ttl_seconds: ttlSeconds
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const { error } = await supabase
        .rpc('cache_delete', { cache_key: key });

      if (error) throw error;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      throw error;
    }
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached) return cached;

      const fresh = await fetchFn();
      await this.set(key, fresh, ttlSeconds);
      return fresh;
    } catch (error) {
      logger.error('Cache getOrSet error', { key, error });
      throw error;
    }
  }
}

export const cacheService = new DatabaseCacheService();