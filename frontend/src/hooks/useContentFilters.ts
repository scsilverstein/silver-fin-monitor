import { useState, useMemo, useEffect } from 'react';
import { useSmartNavigation } from '@/utils/navigation';

interface ContentFilters {
  search: string;
  sourceId: string;
  sentimentRange: [number, number];
  dateRange: string;
}

interface ContentItem {
  id: string;
  title?: string;
  summary?: string;
  sentiment_score?: number;
  source?: { name: string };
  created_at?: string;
  [key: string]: any;
}

export const useProcessedContentFilters = (content: ContentItem[] = []) => {
  // Ensure content is always an array
  const safeContent = Array.isArray(content) ? content : [];
  const { getCurrentFilters, updateFilters } = useSmartNavigation();
  const urlFilters = getCurrentFilters();
  
  const [filters, setFilters] = useState<ContentFilters>({
    search: urlFilters.searchQuery || '',
    sourceId: urlFilters.sourceId || '',
    sentimentRange: [-1, 1],
    dateRange: '7d'
  });

  // Update filters when URL parameters change
  useEffect(() => {
    const urlFilters = getCurrentFilters();
    setFilters(prev => ({
      ...prev,
      search: urlFilters.searchQuery || '',
      sourceId: urlFilters.sourceId || '',
    }));
  }, [getCurrentFilters]);

  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());

  const updateFilter = <K extends keyof ContentFilters>(
    key: K,
    value: ContentFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // Update URL parameters for linkable filters
    if (key === 'search') {
      updateFilters({ searchQuery: value as string });
    } else if (key === 'sourceId') {
      updateFilters({ sourceId: value as string });
    }
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      sourceId: '',
      sentimentRange: [-1, 1],
      dateRange: '7d'
    });
    updateFilters({ searchQuery: '', sourceId: '' });
  };

  // Filter content based on current filters
  const filteredContent = useMemo(() => {
    return safeContent.filter((item) => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        
        // Search in title, summary, source name
        const searchableText = [
          item.title,
          item.summary,
          item.source_name
        ].filter(Boolean).join(' ').toLowerCase();
        
        // Also search in entities (companies, people, tickers, locations)
        const entityText = item.entities ? Object.values(item.entities)
          .flat()
          .join(' ')
          .toLowerCase() : '';
          
        // Also search in key topics
        const topicsText = item.key_topics ? item.key_topics.join(' ').toLowerCase() : '';
        
        const allSearchableText = `${searchableText} ${entityText} ${topicsText}`;
        
        if (!allSearchableText.includes(searchTerm)) {
          return false;
        }
      }

      // Source filter
      if (filters.sourceId && item.source_id !== filters.sourceId) {
        return false;
      }

      // Sentiment filter
      if (item.sentiment_score !== undefined) {
        if (item.sentiment_score < filters.sentimentRange[0] || 
            item.sentiment_score > filters.sentimentRange[1]) {
          return false;
        }
      }

      // Date filter (simplified)
      if (filters.dateRange !== 'all' && item.created_at) {
        const itemDate = new Date(item.created_at);
        const now = new Date();
        const daysDiff = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
        
        switch (filters.dateRange) {
          case '1d':
            if (daysDiff > 1) return false;
            break;
          case '7d':
            if (daysDiff > 7) return false;
            break;
          case '30d':
            if (daysDiff > 30) return false;
            break;
        }
      }

      return true;
    });
  }, [safeContent, filters]);

  const toggleExpanded = (itemId: string) => {
    setExpandedContent(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const getSentimentLabel = (score?: number): string => {
    if (score === undefined) return 'Neutral';
    if (score > 0.3) return 'Positive';
    if (score < -0.3) return 'Negative';
    return 'Neutral';
  };

  // Convenience getters/setters for backward compatibility
  const searchQuery = filters.search;
  const setSearchQuery = (value: string) => updateFilter('search', value);

  return {
    filters,
    updateFilter,
    resetFilters,
    setFilters,
    filteredContent,
    expandedContent,
    toggleExpanded,
    getSentimentLabel,
    searchQuery,
    setSearchQuery
  };
};