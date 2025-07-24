import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

// Navigation utility types
export interface NavigationFilter {
  sourceId?: string;
  sourceName?: string;
  status?: string;
  jobType?: string;
  timeHorizon?: string;
  predictionType?: string;
  searchQuery?: string;
  entity?: string;
  topic?: string;
  dateFrom?: string;
  dateTo?: string;
  analysisId?: string;
}

export interface NavigationContext {
  from?: string;
  parentId?: string;
  breadcrumb?: string[];
}

// URL parameter keys
export const FILTER_KEYS = {
  sourceId: 'source',
  sourceName: 'source_name',
  status: 'status',
  jobType: 'job_type',
  timeHorizon: 'horizon',
  predictionType: 'pred_type',
  searchQuery: 'q',
  entity: 'entity',
  topic: 'topic',
  dateFrom: 'from',
  dateTo: 'to',
  analysisId: 'analysis'
} as const;

export const CONTEXT_KEYS = {
  from: 'from',
  parentId: 'parent',
  breadcrumb: 'breadcrumb'
} as const;

// Navigation utilities hook
export const useSmartNavigation = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const navigateWithFilters = useCallback((
    path: string, 
    filters: NavigationFilter = {}, 
    context: NavigationContext = {}
  ) => {
    const params = new URLSearchParams();
    
    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        const paramKey = FILTER_KEYS[key as keyof typeof FILTER_KEYS] || key;
        params.set(paramKey, value.toString());
      }
    });
    
    // Add context
    Object.entries(context).forEach(([key, value]) => {
      if (value) {
        const paramKey = CONTEXT_KEYS[key as keyof typeof CONTEXT_KEYS] || key;
        if (key === 'breadcrumb' && Array.isArray(value)) {
          params.set(paramKey, value.join('|'));
        } else {
          params.set(paramKey, value.toString());
        }
      }
    });

    navigate(`${path}?${params.toString()}`);
  }, [navigate]);

  const getCurrentFilters = useCallback((): NavigationFilter => {
    const filters: NavigationFilter = {};
    
    Object.entries(FILTER_KEYS).forEach(([key, paramKey]) => {
      const value = searchParams.get(paramKey);
      if (value) {
        (filters as any)[key] = value;
      }
    });
    
    return filters;
  }, [searchParams]);

  const getCurrentContext = useCallback((): NavigationContext => {
    const context: NavigationContext = {};
    
    Object.entries(CONTEXT_KEYS).forEach(([key, paramKey]) => {
      const value = searchParams.get(paramKey);
      if (value) {
        if (key === 'breadcrumb') {
          context[key as keyof NavigationContext] = value.split('|') as any;
        } else {
          (context as any)[key] = value;
        }
      }
    });
    
    return context;
  }, [searchParams]);

  const updateFilters = useCallback((newFilters: Partial<NavigationFilter>) => {
    const current = getCurrentFilters();
    const updated = { ...current, ...newFilters };
    
    const params = new URLSearchParams(searchParams);
    
    Object.entries(updated).forEach(([key, value]) => {
      const paramKey = FILTER_KEYS[key as keyof typeof FILTER_KEYS] || key;
      if (value) {
        params.set(paramKey, value.toString());
      } else {
        params.delete(paramKey);
      }
    });
    
    setSearchParams(params);
  }, [searchParams, setSearchParams, getCurrentFilters]);

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    Object.values(FILTER_KEYS).forEach(key => params.delete(key));
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  return {
    navigateWithFilters,
    getCurrentFilters,
    getCurrentContext,
    updateFilters,
    clearFilters,
    searchParams
  };
};

// Navigation shortcuts for common patterns
export const createNavigationShortcuts = () => {
  const { navigateWithFilters } = useSmartNavigation();

  return {
    // Go to feed details with context
    goToFeedDetails: (feedId: string, feedName?: string) => {
      navigateWithFilters('/feeds', { 
        sourceId: feedId,
        sourceName: feedName 
      });
    },

    // Go to content filtered by source
    goToContentBySource: (sourceId: string, sourceName?: string, from?: string) => {
      navigateWithFilters('/content', 
        { sourceId, sourceName },
        { from, breadcrumb: ['Feeds', sourceName || 'Source'] }
      );
    },

    // Go to queue jobs filtered by source
    goToQueueBySource: (sourceId: string, sourceName?: string) => {
      navigateWithFilters('/queue', 
        { sourceId, sourceName },
        { from: 'feeds', breadcrumb: ['Feeds', sourceName || 'Source', 'Jobs'] }
      );
    },

    // Go to predictions from analysis
    goToPredictionsFromAnalysis: (analysisId: string, analysisDate?: string) => {
      navigateWithFilters('/predictions', 
        { analysisId },
        { from: 'analysis', parentId: analysisId, breadcrumb: ['Analysis', analysisDate || 'Date', 'Predictions'] }
      );
    },

    // Go to content by entity
    goToContentByEntity: (entity: string, from?: string) => {
      navigateWithFilters('/content', 
        { entity, searchQuery: entity },
        { from, breadcrumb: ['Entities', entity] }
      );
    },

    // Go to content by topic
    goToContentByTopic: (topic: string, from?: string) => {
      navigateWithFilters('/content', 
        { topic, searchQuery: topic },
        { from, breadcrumb: ['Topics', topic] }
      );
    },

    // Go to analysis from content
    goToAnalysisFromContent: (contentDate: string) => {
      navigateWithFilters('/analysis', 
        { dateFrom: contentDate, dateTo: contentDate },
        { from: 'content', breadcrumb: ['Content', 'Analysis'] }
      );
    }
  };
};

// Breadcrumb generator
export const generateBreadcrumbs = (
  currentPath: string, 
  context: NavigationContext,
  filters: NavigationFilter
): Array<{ label: string; path: string; filters?: NavigationFilter }> => {
  const breadcrumbs: Array<{ label: string; path: string; filters?: NavigationFilter }> = [];

  // Add home
  breadcrumbs.push({ label: 'Dashboard', path: '/dashboard' });

  // Add context breadcrumbs
  if (context.breadcrumb) {
    context.breadcrumb.forEach((label, index) => {
      if (index < context.breadcrumb!.length - 1) {
        // Determine path based on label
        let path = '/';
        if (label.toLowerCase().includes('feed')) path = '/feeds';
        else if (label.toLowerCase().includes('content')) path = '/content';
        else if (label.toLowerCase().includes('analysis')) path = '/analysis';
        else if (label.toLowerCase().includes('prediction')) path = '/predictions';
        else if (label.toLowerCase().includes('queue')) path = '/queue';
        
        breadcrumbs.push({ label, path });
      }
    });
  }

  // Add current page
  const pageLabels: Record<string, string> = {
    '/feeds': 'Feed Sources',
    '/content': 'Content',
    '/processed-content': 'Processed Content',
    '/analysis': 'Analysis',
    '/predictions': 'Predictions',
    '/queue': 'Queue Management',
    '/timeframe-analysis': 'Timeframe Analysis'
  };

  const currentLabel = pageLabels[currentPath] || currentPath.replace('/', '').replace('-', ' ');
  breadcrumbs.push({ label: currentLabel, path: currentPath, filters });

  return breadcrumbs;
};

// Link formatting utilities
export const formatEntityLink = (entityName: string, entityType?: string) => ({
  label: entityName,
  href: `/content?entity=${encodeURIComponent(entityName)}`,
  badge: entityType,
  icon: getEntityIcon(entityType)
});

export const formatTopicLink = (topic: string) => ({
  label: topic,
  href: `/content?topic=${encodeURIComponent(topic)}`,
  icon: 'tag'
});

export const formatSourceLink = (sourceId: string, sourceName: string, sourceType?: string) => ({
  label: sourceName,
  href: `/content?source=${sourceId}&source_name=${encodeURIComponent(sourceName)}`,
  badge: sourceType,
  icon: getSourceIcon(sourceType)
});

// Icon helpers
const getEntityIcon = (entityType?: string) => {
  switch (entityType) {
    case 'company': return 'building';
    case 'person': return 'user';
    case 'ticker': return 'trending-up';
    case 'currency': return 'dollar-sign';
    case 'location': return 'map-pin';
    case 'exchange': return 'shuffle';
    case 'crypto': return 'zap';
    case 'commodity': return 'package';
    default: return 'tag';
  }
};

const getSourceIcon = (sourceType?: string) => {
  switch (sourceType) {
    case 'rss': return 'rss';
    case 'podcast': return 'mic';
    case 'youtube': return 'play-circle';
    case 'api': return 'code';
    case 'multi_source': return 'layers';
    case 'reddit': return 'message-circle';
    default: return 'globe';
  }
};