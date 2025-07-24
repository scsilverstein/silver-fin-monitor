import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PageContainer, 
  PageHeader, 
  StatsGrid, 
  LoadingState, 
  NoContentEmptyState,
  createStatItems,
  createPageActions 
} from '@/components/layout';
import { 
  Rss, 
  Podcast, 
  Youtube, 
  Database, 
  Sparkles,
  Plus,
  History,
  Filter,
  RefreshCw,
  FileText
} from 'lucide-react';
import { FeedCard } from '@/components/feeds/FeedCard';
import { FeedItems } from '@/components/feeds/FeedItems';
import { DurationFilter, type DurationOption } from '@/components/feeds/DurationFilter';
import { TranscriptionModal } from '@/components/ui/TranscriptionModal';
import { AddFeedModal } from '@/components/feeds/AddFeedModal';
import { HistoricalBackfillModal } from '@/components/feeds/HistoricalBackfillModal';
import { WhisperServiceStatus } from '@/components/whisper/WhisperServiceStatus';
import { useFeedsData } from '@/hooks/useFeedsData';
import { useFeedActions } from '@/hooks/useFeedActions';
import { useFeedItems } from '@/hooks/useFeedItems';
import { contentApi } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { filterByDuration } from '@/utils/dateFilters';
import { FeedListSkeleton } from '@/components/feeds/FeedSkeleton';

const feedTypeIcons = {
  rss: <Rss className="h-4 w-4" />,
  podcast: <Podcast className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  api: <Database className="h-4 w-4" />,
  reddit: <Sparkles className="h-4 w-4" />,
};

const feedTypeColors = {
  rss: 'bg-orange-100 text-orange-600',
  podcast: 'bg-purple-100 text-purple-600',
  youtube: 'bg-red-100 text-red-600',
  api: 'bg-blue-100 text-blue-600',
  reddit: 'bg-indigo-100 text-indigo-600',
};

export const ModernFeeds: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFeeds, setExpandedFeeds] = useState<Set<string>>(new Set());
  const [selectedTranscript, setSelectedTranscript] = useState<any>(null);
  const [showAddFeedModal, setShowAddFeedModal] = useState(false);
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [durationFilter, setDurationFilter] = useState<DurationOption>('7d');

  const { feeds, stats, loading, refreshing, refreshAll, setFeeds } = useFeedsData();
  
  const {
    processingItems,
    updatingFeeds,
    handleProcessFeed,
    handleProcessFeedItem,
    handleToggleFeedActive,
    handleDeleteFeed
  } = useFeedActions(feeds, setFeeds, refreshAll);

  const { feedItems, loadingItems, loadFeedItems, updateFeedItemStatus } = useFeedItems();

  // Auto-reload expanded feed items
  useEffect(() => {
    if (expandedFeeds.size === 0) return;

    const interval = setInterval(() => {
      expandedFeeds.forEach(feedId => {
        loadFeedItems(feedId);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [expandedFeeds, loadFeedItems]);

  const filteredFeeds = useMemo(() => {
    return feeds.filter(feed =>
      feed.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feed.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [feeds, searchQuery]);

  // Create stats for the feeds page
  const feedStats = [
    createStatItems.count('total', 'Total Feeds', feeds.length, {
      icon: <Database className="h-4 w-4" />,
      status: feeds.length > 0 ? 'success' : 'warning'
    }),
    createStatItems.count('active', 'Active Feeds', feeds.filter(f => f.isActive).length, {
      icon: <Sparkles className="h-4 w-4" />,
      status: 'success'
    }),
    createStatItems.count('processing', 'Processing', stats?.processing || 0, {
      icon: <RefreshCw className="h-4 w-4" />,
      status: 'info'
    }),
    createStatItems.count('total_items', 'Total Items', stats?.totalItems || 0, {
      icon: <FileText className="h-4 w-4" />
    })
  ];

  // Get feed type stats
  const feedTypeStats = feeds.reduce((acc, feed) => {
    acc[feed.type] = (acc[feed.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const toggleFeedExpanded = useCallback((feedId: string) => {
    setExpandedFeeds(prev => {
      const next = new Set(prev);
      if (next.has(feedId)) {
        next.delete(feedId);
      } else {
        next.add(feedId);
        loadFeedItems(feedId);
      }
      return next;
    });
  }, [loadFeedItems]);

  const handleProcessItem = useCallback(async (feedId: string, itemId: string) => {
    try {
      const result = await handleProcessFeedItem(feedId, itemId);
      updateFeedItemStatus(feedId, itemId, 'processing');
      
      toast.success(`Processing started! Job ID: ${result?.jobId}`);
      
      // For audio items (transcripts), check more frequently and for longer
      const isAudioItem = feedItems[feedId]?.some(item => 
        item.metadata?.audioUrl || item.metadata?.audio_url || item.isAudioContent
      );
      
      if (isAudioItem) {
        // Check every 10 seconds for up to 2 minutes for audio processing
        let attempts = 0;
        const maxAttempts = 12; // 2 minutes
        const checkInterval = setInterval(() => {
          attempts++;
          loadFeedItems(feedId);
          
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            toast('Transcript processing may take longer than expected', { icon: '⏱️' });
          }
        }, 10000);
        
        // Store interval ID to clear it if needed
        setTimeout(() => clearInterval(checkInterval), 120000); // Clear after 2 minutes
      } else {
        // Regular content processing - 5 seconds
        setTimeout(() => {
          loadFeedItems(feedId);
        }, 5000);
      }
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'FEED_INACTIVE') {
        toast.error('Cannot process items from an inactive feed.');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to process item');
      }
    }
  }, [handleProcessFeedItem, updateFeedItemStatus, loadFeedItems]);

  const handleViewContent = useCallback(async (item: any) => {
    try {
      // Check if the item has processed content
      if (item.processed_content && item.processed_content.length > 0) {
        // Use the processed content ID
        const processedContentId = item.processed_content[0].id;
        const content = await contentApi.get(processedContentId);
        console.log('Processed Content:', content);
        toast.success('Processed content loaded - check console');
      } else {
        // Show raw item data if not processed yet
        console.log('Raw Feed Item (not processed yet):', {
          id: item.id,
          title: item.title,
          description: item.description,
          content: item.content,
          published_at: item.published_at,
          metadata: item.metadata
        });
        toast('Raw content shown - item not processed yet (check console)', {
          icon: 'ℹ️',
        });
      }
    } catch (error) {
      console.error('Failed to load content:', error);
      toast.error('Failed to load content');
    }
  }, []);

  const handleViewTranscript = useCallback((item: any) => {
    console.log('handleViewTranscript called with item:', item);
    
    // Get transcript from multiple possible sources
    const transcript = item.transcription || 
                      (item.content && item.content.length > 100 ? item.content : null) ||
                      item.metadata?.transcription?.text ||
                      'No transcript available';
    
    console.log('Transcript found:', transcript);
    
    const transcriptData = {
      title: item.title,
      transcript,
      metadata: {
        duration: item.metadata?.duration,
        publishedAt: item.published_at,
        source: item.metadata?.audio_url || item.metadata?.audioUrl,
        hasTranscription: item.hasTranscription,
        isAudioContent: item.isAudioContent
      }
    };
    
    console.log('Setting selectedTranscript to:', transcriptData);
    setSelectedTranscript(transcriptData);
    
    // Show a toast to confirm the action
    toast('Opening transcript...', { icon: '📄' });
  }, []);

  const handleAddFeed = useCallback(() => {
    setShowAddFeedModal(true);
  }, []);

  const handleAddFeedSuccess = useCallback(() => {
    refreshAll();
    setShowAddFeedModal(false);
  }, [refreshAll]);

  const handleBackfillSuccess = useCallback(() => {
    refreshAll();
    setShowBackfillModal(false);
  }, [refreshAll]);

  if (loading) {
    return (
      <PageContainer showBreadcrumbs>
        <PageHeader
          title="Feed Sources"
          subtitle="Manage your content feed sources and processing"
          showSkeleton
        />
        <div className="animate-in slide-in-up">
          <StatsGrid stats={feedStats} columns={4} loading={true} />
          <div className="mt-6">
            <FeedListSkeleton count={6} />
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer showBreadcrumbs>
      <PageHeader
        title="Feed Sources"
        subtitle="Manage your content feed sources and processing"
        badges={[
          { 
            label: `${feeds.filter(f => f.isActive).length}/${feeds.length} Active`, 
            variant: feeds.some(f => f.isActive) ? 'success' : 'outline' 
          },
          { 
            label: (() => {
              try {
                return Object.keys(feedTypeStats).length > 0 
                  ? Object.entries(feedTypeStats)
                      .map(([type, count]) => `${count} ${type}`)
                      .join(', ')
                  : 'No feeds';
              } catch (error) {
                console.error('Error creating feed type stats label:', error);
                return `${feeds.length} total feeds`;
              }
            })(),
            variant: 'outline' 
          }
        ]}
        showSearch={true}
        searchQuery={searchQuery}
        searchPlaceholder="Search feeds..."
        onSearchChange={setSearchQuery}
        onRefresh={refreshAll}
        refreshing={refreshing}
        primaryActions={[
          {
            label: 'Add Feed',
            icon: <Plus className="h-4 w-4" />,
            onClick: handleAddFeed
          }
        ]}
        secondaryActions={[
          {
            label: 'Historical Backfill',
            icon: <History className="h-4 w-4" />,
            onClick: () => setShowBackfillModal(true),
            variant: 'outline'
          }
        ]}
      />

      <div className="animate-in slide-in-up" style={{ animationDelay: '100ms' }}>
        <StatsGrid stats={feedStats} columns={4} loading={loading} />
      </div>

      <div className="flex items-center justify-between mb-6 animate-in slide-in-up" style={{ animationDelay: '150ms' }}>
        <WhisperServiceStatus />
        <DurationFilter 
          selected={durationFilter} 
          onChange={setDurationFilter}
        />
      </div>

      <div className="space-y-4 stagger-in">
        {filteredFeeds.length === 0 ? (
          searchQuery ? (
            <div className="text-center py-12 animate-in slide-in-up">
              <p className="text-muted-foreground">
                No feeds match your search for "{searchQuery}"
              </p>
            </div>
          ) : (
            <NoContentEmptyState 
              onAddFeed={handleAddFeed}
              onRefresh={refreshAll}
            />
          )
        ) : (
          filteredFeeds.map((feed, index) => (
            <div key={feed.id} className="animate-in slide-in-up" style={{ animationDelay: `${index * 50}ms` }}>
              <FeedCard
                feed={feed}
                expanded={expandedFeeds.has(feed.id)}
                updating={updatingFeeds.has(feed.id)}
                icon={feedTypeIcons[feed.type as keyof typeof feedTypeIcons] || feedTypeIcons.rss}
                colorClass={feedTypeColors[feed.type as keyof typeof feedTypeColors] || feedTypeColors.rss}
                onToggleExpand={() => toggleFeedExpanded(feed.id)}
                onToggleActive={() => handleToggleFeedActive(feed.id, feed.isActive)}
                onProcess={() => handleProcessFeed(feed.id)}
                onDelete={() => handleDeleteFeed(feed.id)}
              >
                <FeedItems
                  items={filterByDuration(feedItems[feed.id] || [], durationFilter)}
                  loading={loadingItems.has(feed.id)}
                  processingItems={processingItems}
                  onProcessItem={(itemId) => handleProcessItem(feed.id, itemId)}
                  onViewContent={handleViewContent}
                  onViewTranscript={handleViewTranscript}
                />
              </FeedCard>
            </div>
          ))
        )}
      </div>

        {selectedTranscript && (
          <TranscriptionModal
            isOpen={!!selectedTranscript}
            onClose={() => setSelectedTranscript(null)}
            title={selectedTranscript.title}
            transcript={selectedTranscript.transcript}
            metadata={selectedTranscript.metadata}
          />
        )}

      <AddFeedModal
        isOpen={showAddFeedModal}
        onClose={() => setShowAddFeedModal(false)}
        onSuccess={handleAddFeedSuccess}
      />

      <HistoricalBackfillModal
        isOpen={showBackfillModal}
        onClose={() => setShowBackfillModal(false)}
        onSuccess={handleBackfillSuccess}
      />
    </PageContainer>
  );
};