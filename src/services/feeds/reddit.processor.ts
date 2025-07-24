import { FeedSource } from './processor';
import { logger } from '@/utils/logger';
import axios from 'axios';

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    created_utc: number;
    score: number;
    num_comments: number;
    url: string;
    permalink: string;
    subreddit: string;
    link_flair_text?: string;
    is_video: boolean;
    is_self: boolean;
    over_18: boolean;
    upvote_ratio: number;
    total_awards_received: number;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
    after: string | null;
  };
}

interface RedditConfig {
  subreddit: string;
  sort?: 'hot' | 'new' | 'top' | 'rising';
  time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
  minScore?: number;
  minComments?: number;
  minUpvoteRatio?: number;
  excludeNSFW?: boolean;
  flairFilter?: string[];
  authorFilter?: string[];
  includeComments?: boolean;
}

interface RedditItem {
  title: string;
  description: string;
  content: string;
  publishedAt: string;
  externalId: string;
  metadata: any;
}

export class RedditProcessor {
  private readonly userAgent = 'SilverFinMonitor/1.0';
  private readonly baseUrl = 'https://www.reddit.com';
  private source: FeedSource;

  constructor(source: FeedSource) {
    this.source = source;
  }

  async fetchLatest(): Promise<RedditItem[]> {
    try {
      const config = this.source.config as RedditConfig;
      const {
        subreddit,
        sort = 'hot',
        time = 'day',
        limit = 25,
        minScore = 10,
        minComments = 5,
        minUpvoteRatio = 0.7,
        excludeNSFW = true,
        flairFilter = [],
        authorFilter = [],
      } = config;

      // Build Reddit API URL
      let url = `${this.baseUrl}/r/${subreddit}/${sort}.json?limit=${limit}`;
      if (sort === 'top' && time) {
        url += `&t=${time}`;
      }

      logger.info('Fetching Reddit posts', { subreddit, sort, time, url });

      // Fetch posts from Reddit
      const response = await axios.get<RedditResponse>(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      const posts = response.data.data.children;
      logger.info(`Fetched ${posts.length} posts from r/${subreddit}`);

      // Filter posts based on quality criteria
      const filteredPosts = posts.filter(post => {
        const data = post.data;

        // Quality filters
        if (data.score < minScore) return false;
        if (data.num_comments < minComments) return false;
        if (data.upvote_ratio < minUpvoteRatio) return false;
        if (excludeNSFW && data.over_18) return false;

        // Flair filter
        if (flairFilter.length > 0 && data.link_flair_text) {
          const hasMatchingFlair = flairFilter.some(flair => 
            data.link_flair_text?.toLowerCase().includes(flair.toLowerCase())
          );
          if (!hasMatchingFlair) return false;
        }

        // Author filter (blocklist)
        if (authorFilter.length > 0) {
          if (authorFilter.includes(data.author.toLowerCase())) return false;
        }

        return true;
      });

      logger.info(`Filtered to ${filteredPosts.length} high-quality posts`);

      // Get last processed timestamp
      const lastProcessedDate = this.source.last_processed_at ? new Date(this.source.last_processed_at) : new Date(0);

      // Transform to RedditItem format
      const redditItems: RedditItem[] = await Promise.all(
        filteredPosts
          .filter(post => {
            const postDate = new Date(post.data.created_utc * 1000);
            return postDate > lastProcessedDate;
          })
          .map(async (post) => {
            const data = post.data;
            const postUrl = `${this.baseUrl}${data.permalink}`;
            
            // Fetch comments if enabled
            let topComments: string[] = [];
            if (config.includeComments) {
              try {
                topComments = await this.fetchTopComments(postUrl);
              } catch (error) {
                logger.warn('Failed to fetch comments', { postUrl, error });
              }
            }

            // Build content with post and comments
            let content = `Title: ${data.title}\n\n`;
            if (data.selftext) {
              content += `Post: ${data.selftext}\n\n`;
            }
            if (topComments.length > 0) {
              content += `Top Comments:\n${topComments.join('\n\n')}\n\n`;
            }

            return {
              title: data.title,
              description: data.selftext ? data.selftext.substring(0, 500) : '',
              content,
              publishedAt: new Date(data.created_utc * 1000).toISOString(),
              externalId: data.id,
              metadata: {
                url: postUrl,
                author: data.author,
                subreddit: data.subreddit,
                score: data.score,
                numComments: data.num_comments,
                upvoteRatio: data.upvote_ratio,
                flair: data.link_flair_text,
                isVideo: data.is_video,
                isSelfPost: data.is_self,
                awards: data.total_awards_received,
                externalUrl: data.url !== postUrl ? data.url : undefined,
              }
            };
          })
      );

      logger.info(`Returning ${redditItems.length} new Reddit posts`);
      return redditItems;
    } catch (error) {
      logger.error('Reddit fetch error', { 
        source: this.source.name, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  private async fetchTopComments(postUrl: string, limit = 5): Promise<string[]> {
    try {
      const response = await axios.get(`${postUrl}.json`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.data || response.data.length < 2) {
        return [];
      }

      const commentsData = response.data[1].data.children;
      const topComments = commentsData
        .filter((comment: any) => comment.kind === 't1' && comment.data.body)
        .sort((a: any, b: any) => b.data.score - a.data.score)
        .slice(0, limit)
        .map((comment: any) => {
          const data = comment.data;
          return `[${data.score} points] ${data.author}: ${data.body}`;
        });

      return topComments;
    } catch (error) {
      logger.error('Failed to fetch Reddit comments', { postUrl, error });
      return [];
    }
  }

}