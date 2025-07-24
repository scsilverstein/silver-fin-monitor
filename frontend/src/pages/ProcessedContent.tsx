import React, { useState } from 'react';
import {
  PageContainer,
  PageHeader,
  StatsGrid,
  LoadingState,
  EmptyState,
  FilterBar,
  createStatItems,
  createPageActions,
  createFilter
} from '@/components/layout';
import { RefreshCw, FileText, Search, Calendar, Database } from 'lucide-react';
import { ProcessedContent } from '@/lib/api';
import { useProcessedContentData } from '@/hooks/useProcessedContentData';
import { useProcessedContentFilters } from '@/hooks/useContentFilters';
import { ContentFeed } from '@/components/processed-content/ContentFeed';
import { ContentResults } from '@/components/processed-content/ContentResults';
import { ContentModal } from '@/components/processed-content/ContentModal';

const ProcessedContentPage: React.FC = () => {
  const [selectedContent, setSelectedContent] = useState<ProcessedContent | null>(null);
  
  const {
    content,
    latestContent,
    feedSources,
    loading,
    searchLoading,
    refreshLatestContent,
    searchContent
  } = useProcessedContentData();
  
  const { filters, updateFilter } = useProcessedContentFilters();

  // Create stats for the page
  const contentStats = [
    createStatItems.count('latest', 'Latest Content', latestContent.length, {
      icon: <FileText className="h-4 w-4" />,
      status: 'info'
    }),
    createStatItems.count('total_sources', 'Feed Sources', feedSources.length, {
      icon: <Database className="h-4 w-4" />,
      status: 'success'
    }),
    createStatItems.count('search_results', 'Search Results', content.length, {
      icon: <Search className="h-4 w-4" />,
      status: content.length > 0 ? 'success' : 'default'
    })
  ];

  // Create filter definitions for the filter bar
  const filterDefinitions = [
    createFilter.select('sourceId', 'Feed Source', 
      [{ value: '', label: 'All Sources' }, ...feedSources.map(source => ({
        value: source.id,
        label: source.name,
        count: latestContent.filter(item => item.raw_feed?.source_id === source.id).length
      }))],
      filters.sourceId
    ),
    createFilter.select('dateRange', 'Date Range',
      [
        { value: '24h', label: 'Last 24 Hours' },
        { value: '7d', label: 'Last 7 Days' },
        { value: '30d', label: 'Last 30 Days' },
        { value: '90d', label: 'Last 90 Days' }
      ],
      filters.dateRange
    )
  ];

  const handleFilterChange = (key: string, value: any) => {
    updateFilter(key, value);
  };

  const activeFiltersCount = Object.values(filters).filter(value => value && value !== '').length;

  if (loading) {
    return (
      <PageContainer showBreadcrumbs>
        <LoadingState message="Loading processed content..." fullScreen />
      </PageContainer>
    );
  }

  return (
    <PageContainer showBreadcrumbs>
      <PageHeader
        title="Processed Content Library"
        subtitle="Browse and search through all processed content from your feeds"
        badges={[
          { label: `${latestContent.length} Recent Items`, variant: 'info' },
          { label: `${feedSources.length} Sources`, variant: 'outline' }
        ]}
        onRefresh={refreshLatestContent}
        refreshing={loading}
        secondaryActions={[
          createPageActions.filters(() => {})
        ]}
      />

      <StatsGrid stats={contentStats} columns={3} loading={loading} />

      <FilterBar
        searchQuery={filters.search}
        searchPlaceholder="Search content, entities, or topics..."
        onSearchChange={(value) => {
          updateFilter('search', value);
          if (value.trim()) {
            searchContent(value);
          }
        }}
        filters={filterDefinitions}
        onFilterChange={handleFilterChange}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={() => {
          updateFilter('search', '');
          updateFilter('sourceId', '');
          updateFilter('dateRange', '');
        }}
        showFilterToggle={true}
      />

      {/* Latest Content Feed */}
      <div className="space-y-4">
        <ContentFeed
          content={latestContent}
          feedSources={feedSources}
          onRefresh={refreshLatestContent}
          onItemClick={setSelectedContent}
        />
      </div>

      {/* Search Results */}
      {filters.search && (
        <div className="space-y-4">
          {searchLoading && (
            <LoadingState variant="dots" size="sm" className="py-0" />
          )}
          
          {content.length === 0 && !searchLoading ? (
            <EmptyState
              icon={<Search className="h-12 w-12 text-muted-foreground" />}
              title="No search results"
              description={`No content matches your search for "${filters.search}". Try adjusting your search terms or filters.`}
              actions={[{
                label: 'Clear Search',
                onClick: () => updateFilter('search', '')
              }]}
            />
          ) : (
            <ContentResults
              content={content}
              feedSources={feedSources}
              onItemClick={setSelectedContent}
            />
          )}
        </div>
      )}

      {selectedContent && (
        <ContentModal
          content={selectedContent}
          feedSources={feedSources}
          onClose={() => setSelectedContent(null)}
        />
      )}
    </PageContainer>
  );
};

export default ProcessedContentPage;