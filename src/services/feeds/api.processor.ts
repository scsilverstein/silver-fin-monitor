// API feed processor following CLAUDE.md specification
import axios, { AxiosInstance } from 'axios';
import { FeedSource, RawFeed, ProcessedContent, Result, BaseFeedProcessorDeps } from '@/types';
import { BaseFeedProcessor } from './base.processor';
import { v4 as uuidv4 } from 'uuid';

interface APIConfig {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    credentials: string;
  };
  pagination?: {
    type: 'offset' | 'cursor' | 'page';
    limitParam: string;
    offsetParam?: string;
    pageParam?: string;
    cursorParam?: string;
    limitValue: number;
  };
  dataPath?: string; // JSONPath to data array
  idPath?: string; // JSONPath to item ID
  titlePath?: string; // JSONPath to title
  contentPath?: string; // JSONPath to content
  datePath?: string; // JSONPath to date
  transformResponse?: string; // Custom transformation function name
}

export class APIProcessor extends BaseFeedProcessor {
  private axios: AxiosInstance;
  private apiConfig: APIConfig;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    
    // Parse API-specific config
    this.apiConfig = (source.config as any).apiConfig || {};
    
    // Configure axios instance
    this.axios = axios.create({
      timeout: 30000,
      headers: {
        ...this.source.config.customHeaders,
        ...this.apiConfig.headers
      }
    });

    // Set up authentication
    this.setupAuthentication();
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      await this.checkRateLimit();
      
      this.contextLogger.info('Fetching API feed', { 
        source: this.source.name,
        url: this.source.url 
      });

      // Fetch data from API
      const data = await this.fetchAPIData();
      
      this.contextLogger.debug('API data fetched', { 
        source: this.source.name,
        itemCount: data.length 
      });

      // Process API items
      const rawFeeds: RawFeed[] = [];
      
      for (const item of data) {
        // Extract ID
        const externalId = this.extractValue(item, this.apiConfig.idPath) || 
                          this.generateExternalId(item);
        
        // Check if already processed
        if (await this.feedExists(externalId)) {
          continue;
        }

        // Extract content fields
        const title = this.extractValue(item, this.apiConfig.titlePath) || 
                     'Untitled';
        const content = this.extractValue(item, this.apiConfig.contentPath) || 
                       JSON.stringify(item);
        const publishedAt = this.extractValue(item, this.apiConfig.datePath);

        // Create raw feed
        const rawFeed = await this.saveRawFeed({
          sourceId: this.source.id,
          title,
          description: this.extractSummary(content, 200),
          content,
          publishedAt: publishedAt ? this.parseDate(publishedAt) : new Date(),
          externalId,
          metadata: {
            rawData: item,
            apiSource: this.source.name
          },
          processingStatus: 'pending'
        });

        rawFeeds.push(rawFeed);
      }

      // Update last processed timestamp
      await this.updateLastProcessed();

      this.contextLogger.info('API feed processed', { 
        source: this.source.name,
        newItems: rawFeeds.length 
      });

      return rawFeeds;
    } catch (error) {
      this.contextLogger.error('API feed fetch error', { 
        source: this.source.name,
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    return this.withErrorHandling(async () => {
      this.contextLogger.debug('Processing API content', { 
        feedId: rawFeed.id,
        title: rawFeed.title 
      });

      // Update status to processing
      await this.updateProcessingStatus(rawFeed.id, 'processing');

      // Process content based on type
      let processedText = rawFeed.content || '';
      
      // If content is JSON, format it nicely
      try {
        const parsed = JSON.parse(processedText);
        processedText = this.formatJSONContent(parsed);
      } catch {
        // Content is not JSON, use as-is
        processedText = this.normalizeText(processedText);
      }

      // Extract key topics
      const keyTopics = this.extractKeyTopics(processedText);

      // Generate summary
      const summary = this.extractSummary(processedText);

      // Extract entities from metadata
      const entities = this.extractEntitiesFromMetadata(rawFeed.metadata?.rawData);

      // Create processed content
      const processed = await this.db.create<ProcessedContent>('processed_content', {
        rawFeedId: rawFeed.id,
        processedText: processedText,
        keyTopics: keyTopics,
        summary,
        entities,
        processingMetadata: {
          processorVersion: '1.0.0',
          processingTime: Date.now(),
          sourceType: 'api',
          apiEndpoint: this.source.url,
          models: {}
        }
      });

      // Update status to completed
      await this.updateProcessingStatus(rawFeed.id, 'completed');

      this.contextLogger.debug('API content processed', { 
        feedId: rawFeed.id,
        processedId: processed.id 
      });

      return processed;
    }, 'processContent');
  }

  private setupAuthentication(): void {
    if (!this.apiConfig.auth) return;

    const { type, credentials } = this.apiConfig.auth;

    switch (type) {
      case 'bearer':
        this.axios.defaults.headers.common['Authorization'] = `Bearer ${credentials}`;
        break;
      case 'basic':
        this.axios.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
        break;
      case 'apikey':
        // API key could be in header or query param
        // Assume header by default, can be customized
        this.axios.defaults.headers.common['X-API-Key'] = credentials;
        break;
    }
  }

  private async fetchAPIData(): Promise<any[]> {
    const method = this.apiConfig.method || 'GET';
    const allData: any[] = [];
    let hasMore = true;
    let cursor: string | null = null;
    let page = 1;
    let offset = 0;

    while (hasMore) {
      // Build request parameters
      const params: Record<string, any> = {};
      
      if (this.apiConfig.pagination) {
        const { type, limitParam, limitValue } = this.apiConfig.pagination;
        params[limitParam] = limitValue;

        switch (type) {
          case 'offset':
            if (this.apiConfig.pagination.offsetParam) {
              params[this.apiConfig.pagination.offsetParam] = offset;
            }
            break;
          case 'page':
            if (this.apiConfig.pagination.pageParam) {
              params[this.apiConfig.pagination.pageParam] = page;
            }
            break;
          case 'cursor':
            if (cursor && this.apiConfig.pagination.cursorParam) {
              params[this.apiConfig.pagination.cursorParam] = cursor;
            }
            break;
        }
      }

      // Make request
      const response = await this.axios.request({
        method,
        url: this.source.url,
        params: method === 'GET' ? params : undefined,
        data: method === 'POST' ? params : undefined
      });

      // Extract data from response
      let data = response.data;
      
      // Navigate to data path if specified
      if (this.apiConfig.dataPath) {
        data = this.extractValue(data, this.apiConfig.dataPath) || [];
      }

      // Ensure data is an array
      if (!Array.isArray(data)) {
        data = [data];
      }

      allData.push(...data);

      // Check for more data
      if (this.apiConfig.pagination) {
        const { type, limitValue } = this.apiConfig.pagination;
        
        if (data.length < limitValue) {
          hasMore = false;
        } else {
          switch (type) {
            case 'offset':
              offset += limitValue;
              break;
            case 'page':
              page++;
              break;
            case 'cursor':
              // Extract next cursor from response
              cursor = this.extractNextCursor(response.data);
              hasMore = cursor !== null;
              break;
          }
        }
      } else {
        hasMore = false;
      }

      // Respect rate limits between pagination requests
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return allData;
  }

  private extractValue(obj: any, path?: string): any {
    if (!path) return obj;

    // Simple JSONPath implementation
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (part.includes('[') && part.includes(']')) {
        // Array access
        const bracketIndex = part.indexOf('[');
        const arrayName = part.substring(0, bracketIndex);
        const indexStr = part.substring(bracketIndex + 1, part.length - 1);
        const index = parseInt(indexStr);
        if (arrayName && current) {
          current = current[arrayName]?.[index];
        }
      } else {
        current = current[part];
      }

      if (current === undefined) return null;
    }

    return current;
  }

  private extractNextCursor(response: any): string | null {
    // Common cursor locations
    const cursorPaths = [
      'next_cursor',
      'nextCursor',
      'cursor',
      'pagination.next',
      'metadata.next_cursor'
    ];

    for (const path of cursorPaths) {
      const cursor = this.extractValue(response, path);
      if (cursor) return cursor;
    }

    return null;
  }

  private generateExternalId(item: any): string {
    // Generate ID from item properties
    const idComponents = [
      this.source.id,
      JSON.stringify(item).substring(0, 100),
      new Date().toISOString()
    ];
    
    return Buffer.from(idComponents.join('|')).toString('base64');
  }

  private formatJSONContent(data: any): string {
    // Format JSON data into readable text
    const lines: string[] = [];

    const format = (obj: any, indent = ''): void => {
      if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            lines.push(`${indent}${key}:`);
            format(value, indent + '  ');
          } else {
            lines.push(`${indent}${key}: ${value}`);
          }
        });
      } else {
        lines.push(`${indent}${obj}`);
      }
    };

    format(data);
    return lines.join('\n');
  }

  private extractKeyTopics(content: string): string[] {
    const topics = new Set<string>();

    // Add source categories
    this.source.config.categories.forEach(cat => topics.add(cat.toLowerCase()));

    // Extract topics based on common patterns
    const patterns = [
      /\b(market|economy|finance|stock|crypto|bitcoin)\b/gi,
      /\b(inflation|recession|growth|earnings|trading)\b/gi,
      /\b(investment|analysis|forecast|trend|prediction)\b/gi
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => topics.add(match.toLowerCase()));
      }
    });

    return Array.from(topics).slice(0, 10);
  }

  private extractEntitiesFromMetadata(rawData: any): Record<string, any> {
    const entities: Record<string, any> = {};

    if (!rawData || typeof rawData !== 'object') {
      return entities;
    }

    // Common entity field names
    const entityMappings = {
      companies: ['company', 'companies', 'organization', 'org'],
      people: ['person', 'people', 'author', 'speaker', 'analyst'],
      locations: ['location', 'locations', 'region', 'country', 'city'],
      tickers: ['ticker', 'tickers', 'symbol', 'symbols', 'stock']
    };

    Object.entries(entityMappings).forEach(([entityType, fields]) => {
      fields.forEach(field => {
        if (rawData[field]) {
          entities[entityType] = Array.isArray(rawData[field]) 
            ? rawData[field] 
            : [rawData[field]];
        }
      });
    });

    return entities;
  }

  protected parseDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  protected extractSummary(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) return content;
    
    // Find the last complete sentence within maxLength
    const truncated = content.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclamation = truncated.lastIndexOf('!');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (lastSentenceEnd > maxLength * 0.8) {
      return content.substring(0, lastSentenceEnd + 1).trim();
    }
    
    return truncated.trim() + '...';
  }
}