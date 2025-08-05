import React from 'react';
import {
  PageContainer,
  PageHeader,
  StatsGrid,
  LoadingState,
  EmptyState,
  NoSearchResultsEmptyState,
  createStatItems,
  createPageActions
} from '@/components/layout';
import { RefreshCw, FileText, Filter, Clock, Eye, ArrowUp, ArrowDown } from 'lucide-react';
import { useContentData } from '@/hooks/useContentData';
import { useProcessedContentFilters } from '@/hooks/useContentFilters';
import { useQueueTrigger, QueueTriggerType } from '@/hooks/useQueueTrigger';
import { ContentCard } from '@/components/content/ContentCard';
import { ContentEntityDisplay } from '@/components/content/ContentEntityDisplay';
import { ContentPagination } from '@/components/content/ContentPagination';
import { ContentSkeleton } from '@/components/content/ContentSkeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";


export const ModernContent: React.FC = () => {
  const [timeframe, setTimeframe] = React.useState('all');
  const [sortBy, setSortBy] = React.useState<'date' | 'sentiment'>('date');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [sentimentFilter, setSentimentFilter] = React.useState<string | null>(null);
  
  const { 
    content, 
    loading, 
    refreshing, 
    currentPage, 
    totalPages,
    totalItems,
    hasMore, 
    refreshContent, 
    loadNextPage,
    loadPreviousPage
  } = useContentData();

  // Trigger queue job when page loads
  const { triggerManually: triggerContentRefresh } = useQueueTrigger({
    type: QueueTriggerType.CONTENT_REFRESH,
    cooldownMinutes: 30,
    enabled: true
  });
  
  // Sync initial filters with data loading
  React.useEffect(() => {
    // Initial load is handled by useContentData hook
  }, []);
  
  const {
    resetFilters,
    expandedContent,
    toggleExpanded,
    getSentimentLabel,
    searchQuery,
    setSearchQuery
  } = useProcessedContentFilters(content);
  
  // Use backend-filtered content directly, only apply client-side search filtering
  const filteredContent = React.useMemo(() => {
    if (!searchQuery) return content;
    
    const searchTerm = searchQuery.toLowerCase();
    return content.filter((item) => {
      // Search in title, summary, source name
      const searchableText = [
        item.title,
        item.summary,
        item.source_name
      ].filter(Boolean).join(' ').toLowerCase();
      
      // Also search in entities
      const entityText = item.entities ? Object.values(item.entities)
        .flat()
        .join(' ')
        .toLowerCase() : '';
        
      // Also search in key topics
      const topicsText = item.key_topics ? item.key_topics.join(' ').toLowerCase() : '';
      
      const allSearchableText = `${searchableText} ${entityText} ${topicsText}`;
      
      return allSearchableText.includes(searchTerm);
    });
  }, [content, searchQuery]);

  // Create stats for the content page
  const contentStats = [
    createStatItems.count('total', 'Total Items', totalItems || 0, {
      icon: <FileText className="h-4 w-4" />,
      status: (totalItems || 0) > 0 ? 'success' : 'warning'
    }),
    createStatItems.count('filtered', 'Filtered Results', filteredContent.length, {
      icon: <Filter className="h-4 w-4" />,
      status: 'info'
    }),
    createStatItems.percentage('avg_sentiment', 'Avg Sentiment', 
      Array.isArray(filteredContent) && filteredContent.length > 0 
        ? Math.abs(filteredContent.reduce((sum, item) => sum + (item.sentiment_score || 0), 0) / filteredContent.length * 100)
        : 0
    ),
    createStatItems.count('entities', 'Unique Entities', 
      Array.isArray(filteredContent) ? new Set(filteredContent.flatMap(item => 
        Object.values(item.entities || {}).flat()
      )).size : 0
    )
  ];

  const timeframeOptions = [
    { value: 'all', label: 'All Time' },
    { value: '1d', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' }
  ];

  if (loading && (!Array.isArray(content) || content.length === 0)) {
    return <ContentSkeleton />;
  }

  return (
    <PageContainer showBreadcrumbs>
      <div className="animate-in slide-in-up">
        <PageHeader
        title="Content Library"
        subtitle="Browse and analyze processed content from your feeds"
        badges={[
          { label: `${totalItems || 0} Total Items`, variant: 'outline' },
          { label: timeframeOptions.find(opt => opt.value === timeframe)?.label || 'All Time', variant: 'info' },
          { label: `Sorted by ${sortBy === 'date' ? 'Date' : 'Sentiment'} ${sortOrder === 'asc' ? '↑' : '↓'}`, variant: 'secondary' }
        ]}
        showSearch={true}
        searchQuery={searchQuery}
        searchPlaceholder="Search content, entities, or topics..."
        onSearchChange={setSearchQuery}
        onRefresh={async () => {
          await refreshContent(sentimentFilter, timeframe);
          await triggerContentRefresh();
        }}
        refreshing={refreshing}
        secondaryActions={[
          createPageActions.filters(() => {})
        ]}
      >
        {/* Filter Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Timeframe selector */}
          <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Timeframe:</span>
          <Select
            value={timeframe}
            onValueChange={(value) => {
              setTimeframe(value);
              refreshContent(sentimentFilter, value, sortBy, sortOrder);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              {timeframeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>

          {/* Sentiment filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Sentiment:</span>
            <Select
              value={sentimentFilter || 'all'}
              onValueChange={(value) => {
                const newValue = value === 'all' ? null : value;
                setSentimentFilter(newValue);
                refreshContent(newValue, timeframe, sortBy, sortOrder);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        </PageHeader>

        {/* Dedicated Sort Controls Section */}
        <div className="animate-in slide-in-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center justify-between p-4 bg-card border rounded-lg shadow-sm">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-semibold text-foreground">Sort Content</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
                  <Select
                    value={sortBy}
                    onValueChange={(value) => {
                      setSortBy(value as 'date' | 'sentiment');
                      refreshContent(sentimentFilter, timeframe, value, sortOrder);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="sentiment">Sentiment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Order:</span>
                  <button
                    onClick={() => {
                      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                      setSortOrder(newOrder);
                      refreshContent(sentimentFilter, timeframe, sortBy, newOrder);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
                    title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortOrder === 'asc' ? (
                      <>
                        <ArrowUp className="h-4 w-4" />
                        <span>Ascending</span>
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-4 w-4" />
                        <span>Descending</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Showing {filteredContent.length} items sorted by {sortBy === 'date' ? 'date' : 'sentiment'} {sortOrder === 'asc' ? '↑' : '↓'}
            </div>
          </div>
        </div>

        <div className="animate-in slide-in-up" style={{ animationDelay: '100ms' }}>
          <StatsGrid stats={contentStats} columns={4} loading={loading} />
        </div>

        <div className="space-y-4 animate-in slide-in-up" style={{ animationDelay: '150ms' }}>
        {loading && Array.isArray(content) && content.length > 0 && (
          <LoadingState message="Loading more content..." variant="refresh" size="sm" className="py-4" />
        )}
        
        {filteredContent.length === 0 ? (
          searchQuery ? (
            <NoSearchResultsEmptyState 
              searchQuery={searchQuery}
              onClearSearch={() => {
                setSearchQuery('');
                resetFilters();
              }}
            />
          ) : Array.isArray(content) && content.length > 0 ? (
            <EmptyState
              icon={<Filter className="h-12 w-12 text-muted-foreground" />}
              title="No content matches filters"
              description="All content has been filtered out. Try adjusting your filters or search terms."
              actions={[{
                label: 'Clear Filters',
                onClick: resetFilters
              }]}
            />
          ) : (
            <EmptyState
              icon={<FileText className="h-12 w-12 text-muted-foreground" />}
              title="No content available"
              description="No processed content found. Make sure your feeds are processing correctly."
              actions={[{
                label: 'Refresh',
                onClick: () => refreshContent(sentimentFilter, timeframe),
                icon: <RefreshCw className="h-4 w-4" />
              }]}
            />
          )
        ) : (
          <div className="stagger-in">
            {filteredContent.map((item, index) => {
                const isExpanded = expandedContent.has(item.id);
                return (
                  <div key={item.id} className="animate-in slide-in-up" style={{ animationDelay: `${200 + index * 50}ms` }}>
                    <ContentCard
                      content={item}
                      expanded={isExpanded}
                      getSentimentLabel={getSentimentLabel}
                      onToggleExpand={() => toggleExpanded(item.id)}
                      onViewDetails={() => console.log('View details for:', item.id)}
                    >
                      <div className="space-y-4">
                        {item.processed_text && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Content Preview</h4>
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {item.processed_text}
                            </p>
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-medium mb-3">Extracted Entities</h4>
                          <ContentEntityDisplay content={item} />
                        </div>
                      </div>
                    </ContentCard>
                  </div>
                );
              })
            }
          </div>
        )}

          <div className="animate-in slide-in-up" style={{ animationDelay: '500ms' }}>
            <ContentPagination
              currentPage={currentPage}
              totalPages={totalPages}
              hasMore={hasMore}
              onPreviousPage={loadPreviousPage}
              onNextPage={loadNextPage}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
};