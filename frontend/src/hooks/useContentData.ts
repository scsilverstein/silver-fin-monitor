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
  const [currentFilters, setCurrentFilters] = useState<{ sentiment?: string | null; timeframe?: string | null; sortBy?: string; sortOrder?: string }>({ sentiment: null, timeframe: 'all', sortBy: 'date', sortOrder: 'desc' });
  
  const limit = 10000; // Show all content without pagination

  const loadContent = useCallback(async (
    pageNum = currentPage, 
    sentiment?: string | null,
    timeframe?: string | null,
    sortBy?: string,
    sortOrder?: string
  ) => {
    try {
      setError(null);
      let effectiveSentiment = currentFilters.sentiment;
      let effectiveTimeframe = currentFilters.timeframe;
      
      let effectiveSortBy = currentFilters.sortBy;
      let effectiveSortOrder = currentFilters.sortOrder;
      
      // Update current filters if provided
      if (sentiment !== undefined || timeframe !== undefined || sortBy !== undefined || sortOrder !== undefined) {
        const newFilters = {
          sentiment: sentiment !== undefined ? sentiment : currentFilters.sentiment,
          timeframe: timeframe !== undefined ? timeframe : currentFilters.timeframe,
          sortBy: sortBy !== undefined ? sortBy : currentFilters.sortBy,
          sortOrder: sortOrder !== undefined ? sortOrder : currentFilters.sortOrder
        };
        setCurrentFilters(newFilters);
        
        // Use the new filters
        effectiveSentiment = newFilters.sentiment;
        effectiveTimeframe = newFilters.timeframe;
        effectiveSortBy = newFilters.sortBy;
        effectiveSortOrder = newFilters.sortOrder;
      }
      
      const params = {
        limit,
        offset: (pageNum - 1) * limit,
        ...(effectiveSentiment && { sentiment: effectiveSentiment }),
        ...(effectiveTimeframe && effectiveTimeframe !== 'all' && { timeframe: effectiveTimeframe }),
        ...(effectiveSortBy && { sortBy: effectiveSortBy }),
        ...(effectiveSortOrder && { sortOrder: effectiveSortOrder })
      };
      
      console.log('Loading content with params:', params);
      console.log('Current filters state:', { sentiment, timeframe, effectiveSentiment, effectiveTimeframe });
      setLoading(true);
      
      // Make the API call and get full response with metadata
      const response = await api.get<ApiResponse<ProcessedContent[] | { content: ProcessedContent[]; total: number; page: number; pageSize?: number }>>('/content', { params });
      
      console.log('API Response:', {
        success: response.data.success,
        dataLength: Array.isArray(response.data.data) ? response.data.data.length : response.data.data?.content?.length,
        meta: response.data.meta
      });
      
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

  const refreshContent = useCallback(async (sentiment?: string | null, timeframe?: string | null, sortBy?: string, sortOrder?: string) => {
    setRefreshing(true);
    setCurrentPage(1); // Reset to first page when filters change
    setContent([]); // Clear content to show loading state
    await Promise.all([
      loadContent(1, sentiment, timeframe, sortBy, sortOrder),
      loadStats()
    ]);
    setRefreshing(false);
  }, [loadContent, loadStats]);

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
    // Load with initial filter values
    loadContent(1, currentFilters.sentiment, currentFilters.timeframe);
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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