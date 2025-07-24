import { FeedSource } from '../processor';
import { logger } from '@/utils/logger';
import { supabase } from '../../database/client';
import axios, { AxiosRequestConfig } from 'axios';

interface APIItem {
  title: string;
  description: string;
  content: string;
  publishedAt: string;
  externalId: string;
  metadata: any;
}

interface APIProcessorConfig {
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data_path?: string; // JSONPath to data array
  pagination?: {
    type: 'offset' | 'page' | 'cursor';
    param_name: string;
    limit_param?: string;
    limit?: number;
  };
  auth?: {
    type: 'bearer' | 'api_key' | 'basic';
    token?: string;
    key_param?: string;
    username?: string;
    password?: string;
  };
  mappings?: {
    title: string;
    description?: string;
    content?: string;
    published_at?: string;
    id: string;
  };
}

export class APIProcessor {
  private source: FeedSource;
  private config: APIProcessorConfig;

  constructor(source: FeedSource) {
    this.source = source;
    this.config = source.config || {};
  }

  async fetchLatest(): Promise<APIItem[]> {
    try {
      logger.info('Fetching API feed', { source: this.source.name, url: this.source.url });

      const items: APIItem[] = [];
      
      // Get last processed date
      const lastProcessed = this.source.last_processed_at ? 
        new Date(this.source.last_processed_at) : 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Build request config
      const requestConfig: AxiosRequestConfig = {
        method: this.config.method || 'GET',
        url: this.source.url,
        headers: this.buildHeaders(),
        params: this.config.params || {}
      };

      // Add authentication
      this.addAuthentication(requestConfig);

      // Fetch data with pagination support
      let hasMore = true;
      let offset = 0;
      let cursor = null;

      while (hasMore) {
        // Add pagination params
        if (this.config.pagination) {
          this.addPaginationParams(requestConfig, offset, cursor);
        }

        const response = await axios(requestConfig);
        const data = this.extractData(response.data);

        if (!Array.isArray(data)) {
          logger.error('API response is not an array', { source: this.source.name });
          break;
        }

        // Process items
        for (const item of data) {
          const processedItem = await this.processItem(item, lastProcessed);
          if (processedItem) {
            items.push(processedItem);
          }
        }

        // Check for more pages
        if (this.config.pagination) {
          hasMore = this.hasMorePages(response.data, data.length);
          offset += data.length;
          cursor = this.extractCursor(response.data);
        } else {
          hasMore = false;
        }
      }

      logger.info('Fetched API items', { 
        source: this.source.name, 
        newItems: items.length 
      });

      return items;
    } catch (error) {
      logger.error('API fetch error', { source: this.source.name, error });
      throw error;
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'Silver Fin Monitor/1.0',
      'Accept': 'application/json',
      ...this.config.headers
    };

    return headers;
  }

  private addAuthentication(config: AxiosRequestConfig): void {
    if (!this.config.auth) return;

    switch (this.config.auth.type) {
      case 'bearer':
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${this.config.auth.token}`
        };
        break;
      case 'api_key':
        if (this.config.auth.key_param) {
          config.params = {
            ...config.params,
            [this.config.auth.key_param]: this.config.auth.token
          };
        }
        break;
      case 'basic':
        const credentials = Buffer.from(
          `${this.config.auth.username}:${this.config.auth.password}`
        ).toString('base64');
        config.headers = {
          ...config.headers,
          'Authorization': `Basic ${credentials}`
        };
        break;
    }
  }

  private addPaginationParams(config: AxiosRequestConfig, offset: number, cursor: string | null): void {
    if (!this.config.pagination) return;

    switch (this.config.pagination.type) {
      case 'offset':
        config.params[this.config.pagination.param_name] = offset;
        if (this.config.pagination.limit_param) {
          config.params[this.config.pagination.limit_param] = this.config.pagination.limit || 100;
        }
        break;
      case 'page':
        config.params[this.config.pagination.param_name] = Math.floor(offset / (this.config.pagination.limit || 100)) + 1;
        break;
      case 'cursor':
        if (cursor) {
          config.params[this.config.pagination.param_name] = cursor;
        }
        break;
    }
  }

  private extractData(response: any): any[] {
    if (!this.config.data_path) {
      return Array.isArray(response) ? response : [];
    }

    // Simple JSONPath implementation
    const paths = this.config.data_path.split('.');
    let data = response;

    for (const path of paths) {
      if (data && typeof data === 'object' && path in data) {
        data = data[path];
      } else {
        return [];
      }
    }

    return Array.isArray(data) ? data : [];
  }

  private async processItem(item: any, lastProcessed: Date): Promise<APIItem | null> {
    const mappings = this.config.mappings || {
      title: 'title',
      description: 'description',
      content: 'content',
      published_at: 'published_at',
      id: 'id'
    };

    // Extract mapped fields
    const title = this.getNestedValue(item, mappings.title) || 'Untitled';
    const description = mappings.description ? this.getNestedValue(item, mappings.description) : '';
    const content = mappings.content ? this.getNestedValue(item, mappings.content) : description;
    const publishedAt = mappings.published_at ? this.getNestedValue(item, mappings.published_at) : new Date().toISOString();
    const externalId = this.getNestedValue(item, mappings.id) || `${this.source.id}-${Date.now()}`;

    // Check if item is new
    const itemDate = new Date(publishedAt);
    if (itemDate <= lastProcessed) {
      return null;
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from('raw_feeds')
      .select('id')
      .eq('source_id', this.source.id)
      .eq('external_id', externalId)
      .single();

    if (existing) {
      return null;
    }

    return {
      title,
      description,
      content,
      publishedAt: itemDate.toISOString(),
      externalId,
      metadata: {
        raw: item,
        source: this.source.name
      }
    };
  }

  private getNestedValue(obj: any, path: string): any {
    const paths = path.split('.');
    let value = obj;

    for (const p of paths) {
      if (value && typeof value === 'object' && p in value) {
        value = value[p];
      } else {
        return null;
      }
    }

    return value;
  }

  private hasMorePages(response: any, currentPageSize: number): boolean {
    if (!this.config.pagination) return false;

    // Check common pagination indicators
    if ('has_more' in response) return response.has_more;
    if ('hasMore' in response) return response.hasMore;
    if ('next' in response) return !!response.next;
    if ('next_cursor' in response) return !!response.next_cursor;
    
    // If we got a full page, assume there might be more
    const limit = this.config.pagination.limit || 100;
    return currentPageSize >= limit;
  }

  private extractCursor(response: any): string | null {
    if (!this.config.pagination || this.config.pagination.type !== 'cursor') {
      return null;
    }

    // Check common cursor field names
    if ('next_cursor' in response) return response.next_cursor;
    if ('cursor' in response) return response.cursor;
    if ('next' in response && typeof response.next === 'string') return response.next;

    return null;
  }
}