import { useState, useCallback } from 'react';
import { feedsApi, FeedSource } from '@/lib/api';

export const useFeedActions = (
  feeds: FeedSource[],
  setFeeds: (feeds: FeedSource[]) => void,
  onStatsRefresh?: () => void
) => {
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [updatingFeeds, setUpdatingFeeds] = useState<Set<string>>(new Set());

  const handleProcessFeed = useCallback(async (feedId: string) => {
    try {
      await feedsApi.process(feedId);
      setTimeout(() => onStatsRefresh?.(), 1000);
    } catch (error) {
      console.error('Failed to process feed:', error);
      throw error;
    }
  }, [onStatsRefresh]);

  const handleProcessFeedItem = useCallback(async (feedId: string, itemId: string) => {
    if (processingItems.has(itemId)) return;

    try {
      setProcessingItems(prev => new Set(prev).add(itemId));
      
      const result = await feedsApi.processItem(feedId, itemId);
      console.log('Feed item processing queued:', result);
      
      setTimeout(() => onStatsRefresh?.(), 1000);
      
      return result;
    } catch (error: any) {
      console.error('Failed to process feed item:', error);
      throw error;
    } finally {
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [processingItems, onStatsRefresh]);

  const handleToggleFeedActive = useCallback(async (feedId: string, currentActive: boolean) => {
    if (updatingFeeds.has(feedId)) return;
    
    setUpdatingFeeds(prev => new Set(prev).add(feedId));
    try {
      setFeeds(
        feeds.map(f => f.id === feedId ? { ...f, is_active: !currentActive } : f)
      );
      
      const updatedFeed = await feedsApi.update(feedId, { is_active: !currentActive });
      
      setFeeds(
        feeds.map(f => f.id === feedId ? updatedFeed : f)
      );
    } catch (error) {
      console.error('Failed to toggle feed active state:', error);
      setFeeds(
        feeds.map(f => f.id === feedId ? { ...f, is_active: currentActive } : f)
      );
      throw error;
    } finally {
      setUpdatingFeeds(prev => {
        const next = new Set(prev);
        next.delete(feedId);
        return next;
      });
    }
  }, [feeds, setFeeds, updatingFeeds]);

  const handleDeleteFeed = useCallback(async (feedId: string) => {
    if (!window.confirm('Are you sure you want to delete this feed?')) {
      return;
    }

    try {
      await feedsApi.delete(feedId);
      setFeeds(feeds.filter(f => f.id !== feedId));
    } catch (error) {
      console.error('Failed to delete feed:', error);
      throw error;
    }
  }, [feeds, setFeeds]);

  return {
    processingItems,
    updatingFeeds,
    handleProcessFeed,
    handleProcessFeedItem,
    handleToggleFeedActive,
    handleDeleteFeed
  };
};