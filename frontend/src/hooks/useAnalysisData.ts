import { useState, useEffect, useCallback } from 'react';
import { api, analysisApi, DailyAnalysis, ApiResponse } from '@/lib/api';

export const useAnalysisData = () => {
  const [analyses, setAnalyses] = useState<DailyAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const limit = 1000;

  const loadAnalyses = useCallback(async (
    pageNum = currentPage,
    startDate?: string | null,
    endDate?: string | null
  ) => {
    try {
      setError(null);
      // Default to last 90 days if no dates provided - use local date to avoid timezone issues
      const today = new Date();
      const defaultEndDate = today.getFullYear() + '-' + 
        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
        String(today.getDate()).padStart(2, '0');
      
      const startDateObj = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      const defaultStartDate = startDateObj.getFullYear() + '-' + 
        String(startDateObj.getMonth() + 1).padStart(2, '0') + '-' + 
        String(startDateObj.getDate()).padStart(2, '0');
      
      const params = {
        limit,
        offset: (pageNum - 1) * limit,
        startDate: startDate || defaultStartDate,
        endDate: endDate || defaultEndDate
      };
      
      // Make the API call
      const response = await api.get<ApiResponse<DailyAnalysis[]>>('/analysis', { params });
      
      if (response.data.success && response.data.data) {
        setAnalyses(response.data.data);
        
        // Use pagination info from API response meta if available
        if (response.data.meta) {
          setTotalItems(response.data.meta.total);
          setTotalPages(Math.ceil(response.data.meta.total / limit));
          setCurrentPage(response.data.meta.page);
        } else {
          // Fallback if no meta info
          setTotalItems(response.data.data.length);
          setTotalPages(Math.ceil(response.data.data.length / limit));
        }
      } else {
        setAnalyses([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to load analyses:', error);
      setError('Failed to load analyses');
      setAnalyses([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit]);

  const refreshAnalyses = useCallback(async (startDate?: string | null, endDate?: string | null) => {
    setRefreshing(true);
    await loadAnalyses(currentPage, startDate, endDate);
    setRefreshing(false);
  }, [currentPage, loadAnalyses]);

  const loadNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      loadAnalyses(nextPage);
    }
  }, [currentPage, totalPages, loadAnalyses]);

  const loadPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      loadAnalyses(prevPage);
    }
  }, [currentPage, loadAnalyses]);

  const generateAnalysis = useCallback(async (date?: string) => {
    try {
      const result = await analysisApi.generate(date);
      return result;
    } catch (error) {
      console.error('Failed to generate analysis:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, []); // Only run on mount

  return {
    analyses,
    loading,
    refreshing,
    currentPage,
    totalPages,
    totalItems,
    hasMore: currentPage < totalPages,
    error,
    refreshAnalyses,
    loadNextPage,
    loadPreviousPage,
    loadAnalyses,
    generateAnalysis
  };
};