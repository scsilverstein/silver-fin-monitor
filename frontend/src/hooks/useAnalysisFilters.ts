import { useState, useMemo, useCallback } from 'react';
import { DailyAnalysis } from '@/lib/api';

export interface AnalysisFilters {
  searchQuery: string;
  sentiment: 'all' | 'bullish' | 'bearish' | 'neutral';
  dateRange: 'all' | '7d' | '30d' | '90d' | 'custom';
  startDate?: string;
  endDate?: string;
  minConfidence?: number;
}

export const useAnalysisFilters = (analyses: DailyAnalysis[]) => {
  const [filters, setFilters] = useState<AnalysisFilters>({
    searchQuery: '',
    sentiment: 'all',
    dateRange: 'all',
    minConfidence: 0
  });

  const [expandedAnalyses, setExpandedAnalyses] = useState<Set<string>>(new Set());

  const updateFilter = useCallback((key: keyof AnalysisFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      sentiment: 'all',
      dateRange: 'all',
      minConfidence: 0
    });
  }, []);

  const toggleExpanded = useCallback((analysisId: string) => {
    setExpandedAnalyses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(analysisId)) {
        newSet.delete(analysisId);
      } else {
        newSet.add(analysisId);
      }
      return newSet;
    });
  }, []);

  const filteredAnalyses = useMemo(() => {
    let result = [...analyses];

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(analysis => 
        analysis.overallSummary?.toLowerCase().includes(query) ||
        analysis.keyThemes?.some(theme => theme.toLowerCase().includes(query)) ||
        analysis.marketSentiment?.toLowerCase().includes(query) ||
        JSON.stringify(analysis.aiAnalysis).toLowerCase().includes(query)
      );
    }

    // Sentiment filter
    if (filters.sentiment !== 'all') {
      result = result.filter(analysis => 
        analysis.marketSentiment === filters.sentiment
      );
    }

    // Confidence filter
    if (filters.minConfidence && filters.minConfidence > 0) {
      result = result.filter(analysis => 
        analysis.confidenceScore >= filters.minConfidence
      );
    }

    return result;
  }, [analyses, filters]);

  const getSentimentColor = useCallback((sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'text-green-600 bg-green-50';
      case 'bearish':
        return 'text-red-600 bg-red-50';
      case 'neutral':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  }, []);

  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  }, []);

  return {
    filters,
    updateFilter,
    resetFilters,
    setFilters,
    filteredAnalyses,
    expandedAnalyses,
    toggleExpanded,
    getSentimentColor,
    getConfidenceColor,
    searchQuery: filters.searchQuery,
    setSearchQuery: (value: string) => updateFilter('searchQuery', value)
  };
};