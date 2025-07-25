import { useState, useEffect, useCallback } from 'react';
import { api, contentApi, ProcessedContent, ApiResponse } from '@/lib/api';

export const useContentData = () => {
  const [content, setContent] = useState<ProcessedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const limit = 10000; // Increased from 20 to show more content

  const loadContent = useCallback(async (
    pageNum = currentPage, 
    sentiment?: string | null,
    timeframe?: string | null
  ) => {
    try {
      setError(null);
      const params = {
        limit,
        offset: (pageNum - 1) * limit,
        ...(sentiment && { sentiment }),
        ...(timeframe && timeframe !== 'all' && { timeframe })
      };
      
      // Make the API call and get full response with metadata
      const response = await api.get<ApiResponse<ProcessedContent[] | { content: ProcessedContent[]; total: number; page: number; pageSize?: number }>>('/content', { params });
      
      if (response.data.success && response.data.data) {
        // Handle both formats: direct array or nested object with content property
        const contentData = Array.isArray(response.data.data) 
          ? response.data.data 
          : response.data.data.content || [];
        
        setContent(contentData);
        
        // Use pagination info from API response meta if available
        if (response.data.meta) {
          setTotalItems(response.data.meta.total);
          setTotalPages(Math.ceil(response.data.meta.total / limit));
          setCurrentPage(response.data.meta.page);
        } else if (!Array.isArray(response.data.data) && response.data.data.total !== undefined) {
          // Handle nested format pagination info
          setTotalItems(response.data.data.total);
          setTotalPages(Math.ceil(response.data.data.total / limit));
          setCurrentPage(response.data.data.page || 1);
        } else {
          // Fallback if no meta info
          setTotalItems(contentData.length);
          setTotalPages(Math.ceil(contentData.length / limit));
        }
      } else {
        setContent([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to load content:', error);
      setError('Failed to load content');
      setContent([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit]);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await contentApi.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load content stats:', error);
    }
  }, []);

  const refreshContent = useCallback(async (sentiment?: string | null, timeframe?: string | null) => {
    setRefreshing(true);
    await Promise.all([
      loadContent(currentPage, sentiment, timeframe),
      loadStats()
    ]);
    setRefreshing(false);
  }, [currentPage, loadContent, loadStats]);

  const loadNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      loadContent(nextPage);
    }
  }, [currentPage, totalPages, loadContent]);

  const loadPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      loadContent(prevPage);
    }
  }, [currentPage, loadContent]);

  useEffect(() => {
    loadContent();
    loadStats();
  }, []); // Only run on mount

  return {
    content,
    loading,
    refreshing,
    stats,
    currentPage,
    totalPages,
    totalItems,
    hasMore: currentPage < totalPages,
    error,
    refreshContent,
    loadNextPage,
    loadPreviousPage,
    loadContent
  };
};