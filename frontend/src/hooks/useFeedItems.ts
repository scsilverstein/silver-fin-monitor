import { useState, useCallback } from 'react';
import { feedsApi } from '@/lib/api';

interface FeedItem {
  id: string;
  title: string;
  published_at: string;
  processing_status: string;
  external_id?: string;
  metadata?: any;
  content?: string;
  hasTranscription?: boolean;
  isAudioContent?: boolean;
  hasTextProcessing?: boolean;
  transcription?: string;
  processingData?: any;
}

export const useFeedItems = () => {
  const [feedItems, setFeedItems] = useState<Record<string, FeedItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  const loadFeedItems = useCallback(async (feedId: string) => {
    if (loadingItems.has(feedId)) return;

    try {
      setLoadingItems(prev => new Set(prev).add(feedId));
      const response = await feedsApi.getItems(feedId);
      // The response includes transcription data from the backend
      setFeedItems(prev => ({ ...prev, [feedId]: response }));
    } catch (error) {
      console.error('Failed to load feed items:', error);
      setFeedItems(prev => ({ ...prev, [feedId]: [] }));
    } finally {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(feedId);
        return next;
      });
    }
  }, [loadingItems]);

  const updateFeedItemStatus = useCallback((
    feedId: string, 
    itemId: string, 
    status: string
  ) => {
    setFeedItems(prev => ({
      ...prev,
      [feedId]: prev[feedId]?.map(item =>
        item.id === itemId
          ? { ...item, processing_status: status }
          : item
      ) || []
    }));
  }, []);

  return {
    feedItems,
    loadingItems,
    loadFeedItems,
    updateFeedItemStatus
  };
};