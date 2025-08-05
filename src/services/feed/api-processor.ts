// API feed processor following CLAUDE.md specification
import { BaseFeedProcessor } from './base-processor';
import { ProcessedContent, RawFeed, Result, FeedSource, BaseFeedProcessorDeps } from '../../types';
import { NLPService } from '../nlp/nlp.service';
import axios, { AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface APIConfig {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey' | 'oauth2';
    credentials: any;
  };
  params?: Record<string, any>;
  body?: any;
  pagination?: {
    type: 'offset' | 'cursor' | 'page' | 'none';
    pageSize?: number;
    maxPages?: number;
    pageParam?: string;
    cursorParam?: string;
    offsetParam?: string;
  };
  dataPath?: string; // JSONPath to the data array in response
  mapping?: {
    id?: string;
    title?: string;
    description?: string;
    content?: string;
    publishedAt?: string;
    url?: string;
    author?: string;
    tags?: string;
  };
  rateLimit?: {
    requests: number;
    period: number; // milliseconds
  };
  transform?: (data: any) => any; // Custom transformation function
}

export class APIProcessor extends BaseFeedProcessor {
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private rateLimitReset: number = 0;
  private nlpService: NLPService;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    this.nlpService = new NLPService();
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      this.logger.info('Fetching API feed', { source: this.source.name, url: this.source.url });

      const config: APIConfig = (this.source.config as unknown as APIConfig) || {};

      // Check cache first
      const cacheKey = `api:latest:${this.source.id}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.info('Using cached API data', { source: this.source.name });
        return cached as RawFeed[];
      }

      // Apply rate limiting
      await this.enforceRateLimit(config.rateLimit);

      // Fetch data
      const allData: any[] = [];
      
      if (config.pagination && config.pagination.type !== 'none') {
        await this.fetchPaginated(this.source.url, config, allData);
      } else {
        const data = await this.fetchSingle(this.source.url, config);
        allData.push(...data);
      }

      // Transform to RawFeed format
      const rawFeeds = this.transformToRawFeeds(allData, this.source, config);

      // Filter by last processed date
      const filteredFeeds = rawFeeds.filter(feed => 
        !this.source.lastProcessedAt || (feed.publishedAt && feed.publishedAt > this.source.lastProcessedAt)
      );

      // Cache for 30 minutes
      await this.cache.set(cacheKey, filteredFeeds, 1800);

      this.logger.info('Fetched API data', { 
        source: this.source.name, 
        totalCount: allData.length,
        newCount: filteredFeeds.length 
      });

      return filteredFeeds;
    } catch (error) {
      this.logger.error('Failed to fetch API feed', { 
        source: this.source.name, 
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    try {
      this.logger.info('Processing API content', { id: rawFeed.id });

      // Extract entities
      const entities = await this.nlpService.extractEntities(rawFeed.content || '');
      
      // Extract key topics
      const topics = await this.nlpService.extractTopics(rawFeed.content || '');
      
      // Analyze sentiment
      const sentimentScore = await this.nlpService.analyzeSentiment(rawFeed.content || '');
      
      // Generate summary
      const summary = await this.nlpService.generateSummary(rawFeed.content || '', 400);

      // Extract any structured data from metadata
      const structuredData = this.extractStructuredData(rawFeed.metadata);

      const processedContent: ProcessedContent = {
        id: uuidv4(),
        rawFeedId: rawFeed.id,
        processedText: rawFeed.content,
        keyTopics: topics,
        sentimentScore: sentimentScore,
        entities: [
          ...entities.companies.map(name => ({ name, type: 'company' })),
          ...entities.people.map(name => ({ name, type: 'person' })),
          ...entities.locations.map(name => ({ name, type: 'location' })),
          ...entities.tickers.map(name => ({ name, type: 'ticker' }))
        ],
        summary,
        processingMetadata: {
          processorVersion: '1.0.0',
          processingTime: Date.now(),
          models: {
            sentiment: 'basic',
            entities: 'basic',
            summary: 'basic'
          },
          apiSource: rawFeed.metadata?.apiSource,
          structuredData: structuredData.length > 0 ? structuredData : undefined
        },
        createdAt: new Date()
      };

      return { success: true, data: processedContent };
    } catch (error) {
      this.logger.error('Failed to process API content', { 
        id: rawFeed.id, 
        error 
      });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async validateSource(source: any): Promise<boolean> {
    try {
      const config: APIConfig = source.config || {};
      
      // Try to make a test request
      const testConfig = {
        ...config,
        pagination: { ...config.pagination, maxPages: 1 }
      };

      const data = await this.fetchSingle(source.url, testConfig);
      
      // Validate that we can extract required fields
      if (data.length > 0) {
        const testItem = data[0];
        const mapped = this.mapDataItem(testItem, config.mapping || {});
        
        // Check for minimum required fields
        return !!(mapped.title || mapped.content || mapped.description);
      }

      return true; // Empty response is valid
    } catch (error) {
      this.logger.error('Failed to validate API source', { 
        source: source.name, 
        error 
      });
      return false;
    }
  }

  private async enforceRateLimit(rateLimit?: { requests: number; period: number }): Promise<void> {
    if (!rateLimit) return;

    const now = Date.now();
    
    // Reset counter if period has passed
    if (now > this.rateLimitReset) {
      this.requestCount = 0;
      this.rateLimitReset = now + rateLimit.period;
    }

    // Check if we've exceeded the limit
    if (this.requestCount >= rateLimit.requests) {
      const waitTime = this.rateLimitReset - now;
      if (waitTime > 0) {
        this.logger.info('Rate limit reached, waiting', { waitTime });
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.rateLimitReset = Date.now() + rateLimit.period;
      }
    }

    this.requestCount++;
    this.lastRequestTime = now;
  }

  private async fetchSingle(url: string, config: APIConfig): Promise<any[]> {
    const axiosConfig: AxiosRequestConfig = {
      method: config.method || 'GET',
      url,
      headers: this.buildHeaders(config),
      params: config.params,
      data: config.body,
      timeout: 30000
    };

    // Add authentication
    if (config.auth) {
      this.addAuthentication(axiosConfig, config.auth);
    }

    const response = await axios(axiosConfig);
    
    // Extract data using dataPath or root
    let data = response.data;
    if (config.dataPath) {
      data = this.extractByPath(data, config.dataPath);
    }

    // Ensure it's an array
    if (!Array.isArray(data)) {
      data = [data];
    }

    // Apply custom transformation if provided
    if (config.transform) {
      data = data.map(config.transform);
    }

    return data;
  }

  private async fetchPaginated(
    baseUrl: string, 
    config: APIConfig, 
    allData: any[]
  ): Promise<void> {
    const pagination = config.pagination!;
    let page = 0;
    let cursor: string | null = null;
    let offset = 0;
    let hasMore = true;

    while (hasMore && (!pagination.maxPages || page < pagination.maxPages)) {
      let url = baseUrl;
      const params = { ...config.params };

      // Add pagination parameters
      switch (pagination.type) {
        case 'page':
          params[pagination.pageParam || 'page'] = page + 1;
          params['pageSize'] = pagination.pageSize || 50;
          break;
        case 'offset':
          params[pagination.offsetParam || 'offset'] = offset;
          params['limit'] = pagination.pageSize || 50;
          break;
        case 'cursor':
          if (cursor) {
            params[pagination.cursorParam || 'cursor'] = cursor;
          }
          params['limit'] = pagination.pageSize || 50;
          break;
      }

      const pageConfig = { ...config, params };
      const data = await this.fetchSingle(url, pageConfig);
      
      if (data.length === 0) {
        hasMore = false;
      } else {
        allData.push(...data);
        page++;
        offset += data.length;

        // Extract next cursor if available
        if (pagination.type === 'cursor' && data.length > 0) {
          const lastItem = data[data.length - 1];
          cursor = lastItem.nextCursor || lastItem.id || null;
          if (!cursor) hasMore = false;
        }

        // Check if we got less than page size
        if (data.length < (pagination.pageSize || 50)) {
          hasMore = false;
        }
      }

      // Small delay between requests
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  private buildHeaders(config: APIConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Silver Fin Monitor/1.0',
      ...config.headers
    };

    return headers;
  }

  private addAuthentication(axiosConfig: AxiosRequestConfig, auth: APIConfig['auth']): void {
    if (!auth) return;

    switch (auth.type) {
      case 'bearer':
        axiosConfig.headers = {
          ...axiosConfig.headers,
          'Authorization': `Bearer ${auth.credentials.token}`
        };
        break;
      case 'basic':
        axiosConfig.auth = {
          username: auth.credentials.username,
          password: auth.credentials.password
        };
        break;
      case 'apikey':
        if (auth.credentials.header) {
          axiosConfig.headers = {
            ...axiosConfig.headers,
            [auth.credentials.header]: auth.credentials.key
          };
        } else {
          axiosConfig.params = {
            ...axiosConfig.params,
            [auth.credentials.param || 'apikey']: auth.credentials.key
          };
        }
        break;
      case 'oauth2':
        axiosConfig.headers = {
          ...axiosConfig.headers,
          'Authorization': `Bearer ${auth.credentials.accessToken}`
        };
        break;
    }
  }

  private extractByPath(data: any, path: string): any {
    const parts = path.split('.');
    let current = data;

    for (const part of parts) {
      if (current[part] !== undefined) {
        current = current[part];
      } else {
        return [];
      }
    }

    return current;
  }

  private transformToRawFeeds(
    data: any[], 
    source: any, 
    config: APIConfig
  ): RawFeed[] {
    const mapping = config.mapping || {};

    return data.map(item => {
      const mapped = this.mapDataItem(item, mapping);
      
      return {
        id: uuidv4(),
        sourceId: source.id,
        title: mapped.title || 'Untitled',
        description: mapped.description || '',
        content: mapped.content || mapped.description || mapped.title || '',
        publishedAt: mapped.publishedAt ? new Date(mapped.publishedAt) : new Date(),
        externalId: mapped.id || this.generateExternalId(item),
        metadata: {
          type: 'api',
          apiSource: source.name,
          originalData: item,
          author: mapped.author,
          tags: mapped.tags,
          url: mapped.url || source.url
        },
        processingStatus: 'pending' as const,
        createdAt: new Date()
      } as RawFeed;
    });
  }

  private mapDataItem(item: any, mapping: APIConfig['mapping']): any {
    const mapped: any = {};

    // Direct mapping
    if (mapping) {
      for (const [key, path] of Object.entries(mapping)) {
        if (path && typeof path === 'string') {
          mapped[key] = this.getValueByPath(item, path);
        }
      }
    }

    // Fallback to common field names
    mapped.id = mapped.id || item.id || item._id || item.guid;
    mapped.title = mapped.title || item.title || item.headline || item.name;
    mapped.description = mapped.description || item.description || item.summary || item.excerpt;
    mapped.content = mapped.content || item.content || item.body || item.text;
    mapped.publishedAt = mapped.publishedAt || item.publishedAt || item.published_at || 
                        item.createdAt || item.created_at || item.date;
    mapped.url = mapped.url || item.url || item.link || item.href;
    mapped.author = mapped.author || item.author || item.creator || item.by;
    mapped.tags = mapped.tags || item.tags || item.categories || item.keywords;

    return mapped;
  }

  private getValueByPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current[part] !== undefined) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private generateExternalId(item: any): string {
    // Try to generate a stable ID from item properties
    const candidates = [
      item.id,
      item._id,
      item.guid,
      item.url,
      item.link,
      JSON.stringify(item).substring(0, 100)
    ];

    for (const candidate of candidates) {
      if (candidate) {
        return String(candidate);
      }
    }

    return uuidv4();
  }

  private extractStructuredData(metadata: any): any[] {
    if (!metadata || !metadata.originalData) return [];

    const structured: any[] = [];
    const data = metadata.originalData;

    // Extract numeric values
    const numbers = this.extractNumbers(data);
    if (Object.keys(numbers).length > 0) {
      structured.push({
        type: 'metrics',
        data: numbers
      });
    }

    // Extract dates
    const dates = this.extractDates(data);
    if (dates.length > 0) {
      structured.push({
        type: 'dates',
        data: dates
      });
    }

    // Extract structured lists
    const lists = this.extractLists(data);
    if (lists.length > 0) {
      structured.push({
        type: 'lists',
        data: lists
      });
    }

    return structured;
  }

  private extractNumbers(obj: any, prefix = ''): Record<string, number> {
    const numbers: Record<string, number> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'number' && isFinite(value)) {
        numbers[fullKey] = value;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(numbers, this.extractNumbers(value, fullKey));
      }
    }

    return numbers;
  }

  private extractDates(obj: any): Array<{ key: string; date: Date }> {
    const dates: Array<{ key: string; date: Date }> = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;

    const extract = (o: any, prefix = '') => {
      for (const [key, value] of Object.entries(o)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'string' && dateRegex.test(value)) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            dates.push({ key: fullKey, date });
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          extract(value, fullKey);
        }
      }
    };

    extract(obj);
    return dates;
  }

  private extractLists(obj: any): Array<{ key: string; items: any[] }> {
    const lists: Array<{ key: string; items: any[] }> = [];

    const extract = (o: any, prefix = '') => {
      for (const [key, value] of Object.entries(o)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (Array.isArray(value) && value.length > 0) {
          lists.push({ key: fullKey, items: value });
        } else if (typeof value === 'object' && value !== null) {
          extract(value, fullKey);
        }
      }
    };

    extract(obj);
    return lists;
  }

  validate(feed: RawFeed): boolean {
    return !!(feed && feed.id && feed.content && feed.content.length > 0);
  }
}

export default APIProcessor;