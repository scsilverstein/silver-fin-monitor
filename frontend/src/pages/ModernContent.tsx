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
import { RefreshCw, FileText, Filter, Clock, Eye } from 'lucide-react';
import { useContentData } from '@/hooks/useContentData';
import { useProcessedContentFilters } from '@/hooks/useContentFilters';
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
} from "@/components/ui/select";


export const ModernContent: React.FC = () => {
  const { 
    content, 
    loading, 
    refreshing, 
    currentPage, 
    totalPages,
    totalItems,
    hasMore, 
    stats,
    refreshContent, 
    loadNextPage,
    loadPreviousPage
  } = useContentData();
  
  const {
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
  } = useProcessedContentFilters(content);

  const [timeframe, setTimeframe] = React.useState('all');

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
      content.length > 0 
        ? Math.abs(content.reduce((sum, item) => sum + (item.sentiment_score || 0), 0) / content.length * 100)
        : 0
    ),
    createStatItems.count('entities', 'Unique Entities', 
      new Set(content.flatMap(item => 
        Object.values(item.entities || {}).flat()
      )).size
    )
  ];

  const timeframeOptions = [
    { value: 'all', label: 'All Time' },
    { value: '1d', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' }
  ];

  if (loading && content.length === 0) {
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
          { label: timeframeOptions.find(opt => opt.value === timeframe)?.label || 'All Time', variant: 'info' }
        ]}
        showSearch={true}
        searchQuery={searchQuery}
        searchPlaceholder="Search content, entities, or topics..."
        onSearchChange={setSearchQuery}
        onRefresh={() => refreshContent(null, timeframe)}
        refreshing={refreshing}
        secondaryActions={[
          createPageActions.filters(() => {})
        ]}
      >
        {/* Timeframe selector */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Timeframe:</span>
          <Select
            value={timeframe}
            onValueChange={(value) => {
              setTimeframe(value);
              refreshContent(null, value);
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
        </PageHeader>

        <div className="animate-in slide-in-up" style={{ animationDelay: '100ms' }}>
          <StatsGrid stats={contentStats} columns={4} loading={loading} />
        </div>

        <div className="space-y-4 animate-in slide-in-up" style={{ animationDelay: '150ms' }}>
        {loading && content.length > 0 && (
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
          ) : content.length > 0 ? (
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
                onClick: () => refreshContent(null, timeframe),
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
            })}
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