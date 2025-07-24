import { useState, useEffect } from 'react';
import { ProcessedContent, FeedSource, contentApi, feedsApi } from '@/lib/api';

export const useProcessedContentData = () => {
  const [content, setContent] = useState<ProcessedContent[]>([]);
  const [latestContent, setLatestContent] = useState<ProcessedContent[]>([]);
  const [feedSources, setFeedSources] = useState<FeedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  // Load latest content from all sources
  const loadLatestContent = async (): Promise<ProcessedContent[]> => {
    try {
      const sources = await feedsApi.list();
      const contentPromises = sources.slice(0, 5).map(source => 
        contentApi.listBySource(source.id, 3).catch(() => [])
      );
      const allContent = await Promise.all(contentPromises);
      
      // Flatten and sort by creation date
      const flatContent = allContent.flat();
      return flatContent
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
    } catch (error) {
      console.error('Failed to load latest content:', error);
      return [];
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [sources, latest] = await Promise.all([
          feedsApi.list(),
          loadLatestContent()
        ]);
        
        setFeedSources(sources);
        setLatestContent(latest);
      } catch (error) {
        console.error('Failed to load content data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const refreshLatestContent = async () => {
    const latest = await loadLatestContent();
    setLatestContent(latest);
  };

  const searchContent = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      setSearchLoading(true);
      const results = await contentApi.search(query);
      setContent(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  return {
    content,
    latestContent,
    feedSources,
    loading,
    searchLoading,
    refreshLatestContent,
    searchContent
  };
};