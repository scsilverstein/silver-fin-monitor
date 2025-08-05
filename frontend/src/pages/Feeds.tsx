import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedsApi, queueApi } from '@/lib/api';
import {
  ModernCard,
  CardContent,
  CardHeader,
  CardTitle,
  ModernButton,
  ModernBadge,
  ModernInput,
  LegacySelect as Select
} from '@/components/ui';
import { Plus, Play, Pause, Trash2, Edit, Rss, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const Feeds: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFeed, setEditingFeed] = useState<string | null>(null);
  const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null);
  const [isProcessingFeeds, setIsProcessingFeeds] = useState(false);

  const { data: feeds, isLoading, refetch } = useQuery({
    queryKey: ['feeds'],
    queryFn: feedsApi.list,
    // Trigger automatic feed processing when data is loaded
    onSuccess: () => {
      // Auto-refresh feeds every 5 minutes when on this page
      const now = new Date();
      if (!lastAutoRefresh || (now.getTime() - lastAutoRefresh.getTime()) > 5 * 60 * 1000) {
        setLastAutoRefresh(now);
        triggerFeedProcessing();
      }
    }
  });

  // Get queue status to show active processing
  const { data: queueStats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: queueApi.getStats,
    refetchInterval: 5000, // Refresh every 5 seconds
    enabled: true
  });

  // Auto-refresh every 30 seconds to show updated processing status
  React.useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [queryClient]);

  // Trigger background feed processing
  const triggerFeedProcessing = async () => {
    try {
      // Trigger background processing via the manual trigger endpoint
      await fetch('/.netlify/functions/trigger-feed-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {
        // Silently fail - this is background processing
      });
    } catch (error) {
      // Silently fail - this is background processing
    }
  };

  // Manual refresh with feed processing
  const handleRefreshFeeds = async () => {
    setIsProcessingFeeds(true);
    try {
      await triggerFeedProcessing();
      // Refetch data after triggering processing
      setTimeout(() => {
        refetch();
      }, 2000);
    } finally {
      // Stop showing processing indicator after 10 seconds
      setTimeout(() => {
        setIsProcessingFeeds(false);
      }, 10000);
    }
  };

  const createMutation = useMutation({
    mutationFn: feedsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
      setShowAddForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      feedsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
      setEditingFeed(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: feedsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
    }
  });

  const processMutation = useMutation({
    mutationFn: feedsApi.process,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
    }
  });

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      rss: 'bg-blue-100 text-blue-800',
      podcast: 'bg-purple-100 text-purple-800',
      youtube: 'bg-red-100 text-red-800',
      api: 'bg-green-100 text-green-800',
      multi_source: 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Check if there are active feed processing jobs
  const activeFeedJobs = queueStats?.currentQueue?.processing || 0;
  const pendingFeedJobs = queueStats?.currentQueue?.pending || 0;
  const hasActiveJobs = activeFeedJobs > 0 || pendingFeedJobs > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feed Sources</h1>
          <p className="text-muted-foreground">
            Manage your market intelligence sources
            {(isProcessingFeeds || hasActiveJobs) && (
              <span className="ml-2 inline-flex items-center text-blue-600">
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                {isProcessingFeeds ? 'Processing feeds...' : 
                 `${activeFeedJobs + pendingFeedJobs} jobs ${activeFeedJobs > 0 ? 'active' : 'queued'}`}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <ModernButton
            variant="outline"
            onClick={handleRefreshFeeds}
            disabled={isProcessingFeeds}
            title="Refresh all feeds and trigger processing"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isProcessingFeeds ? 'animate-spin' : ''}`} />
            {isProcessingFeeds ? 'Processing...' : 'Refresh & Process'}
          </ModernButton>
          <ModernButton onClick={() => setShowAddForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Feed
          </ModernButton>
        </div>
      </div>

      {hasActiveJobs && (
        <ModernCard className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-blue-900">
                  Queue Status: {activeFeedJobs} processing, {pendingFeedJobs} pending
                </span>
              </div>
              <div className="text-xs text-blue-700">
                Jobs are automatically processed in the background
              </div>
            </div>
          </CardContent>
        </ModernCard>
      )}

      {showAddForm && (
        <ModernCard>
          <CardHeader>
            <CardTitle>Add New Feed Source</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createMutation.mutate({
                  name: formData.get('name') as string,
                  type: formData.get('type') as any,
                  url: formData.get('url') as string,
                  config: {
                    categories: [formData.get('category') as string],
                    priority: formData.get('priority') as string,
                    updateFrequency: 'hourly'
                  }
                });
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <ModernInput name="name" required placeholder="Feed name" />
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select name="type" required>
                    <option value="">Select type</option>
                    <option value="rss">RSS Feed</option>
                    <option value="podcast">Podcast</option>
                    <option value="youtube">YouTube Channel</option>
                    <option value="api">API</option>
                    <option value="multi_source">Multi-Source</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">URL</label>
                  <ModernInput name="url" type="url" required placeholder="https://..." />
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <ModernInput name="category" required placeholder="finance" />
                </div>
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select name="priority" required>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <ModernButton type="submit" loading={createMutation.isPending}>
                  Add Feed
                </ModernButton>
                <ModernButton
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </ModernButton>
              </div>
            </form>
          </CardContent>
        </ModernCard>
      )}

      <div className="grid gap-4">
        {feeds?.map((feed) => (
          <ModernCard key={feed.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Rss className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">{feed.name}</h3>
                    <ModernBadge className={getTypeColor(feed.type)}>{feed.type}</ModernBadge>
                    <ModernBadge variant={feed.is_active ? 'success' : 'secondary' as any}>
                      {feed.is_active ? 'Active' : 'Inactive'}
                    </ModernBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">{feed.url}</p>
                  {feed.last_processed_at && (
                    <p className="text-xs text-muted-foreground">
                      Last processed: {formatDate(feed.last_processed_at)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <ModernButton
                    variant="ghost"
                    size="icon"
                    onClick={() => processMutation.mutate(feed.id)}
                    disabled={processMutation.isPending}
                  >
                    <Play className="h-4 w-4" />
                  </ModernButton>
                  <ModernButton
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      updateMutation.mutate({
                        id: feed.id,
                        data: { is_active: !feed.is_active }
                      })
                    }
                  >
                    {feed.is_active ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </ModernButton>
                  <ModernButton
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingFeed(feed.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </ModernButton>
                  <ModernButton
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm('Delete this feed?')) {
                        deleteMutation.mutate(feed.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </ModernButton>
                </div>
              </div>
            </CardContent>
          </ModernCard>
        ))}
      </div>

      {feeds?.length === 0 && !isLoading && (
        <ModernCard>
          <CardContent className="py-12 text-center">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No feeds configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first feed source to start monitoring market intelligence
            </p>
            <ModernButton onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Feed
            </ModernButton>
          </CardContent>
        </ModernCard>
      )}
    </div>
  );
};