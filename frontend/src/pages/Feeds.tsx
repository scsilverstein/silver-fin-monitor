import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedsApi } from '@/lib/api';
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
import { Plus, Play, Pause, Trash2, Edit, Rss } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const Feeds: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFeed, setEditingFeed] = useState<string | null>(null);

  const { data: feeds, isLoading } = useQuery({
    queryKey: ['feeds'],
    queryFn: feedsApi.list
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feed Sources</h1>
          <p className="text-muted-foreground">
            Manage your market intelligence sources
          </p>
        </div>
        <ModernButton onClick={() => setShowAddForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Feed
        </ModernButton>
      </div>

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
                    <ModernBadge variant={feed.isActive ? 'success' : 'secondary' as any}>
                      {feed.isActive ? 'Active' : 'Inactive'}
                    </ModernBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">{feed.url}</p>
                  {feed.lastProcessedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last processed: {formatDate(feed.lastProcessedAt)}
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
                        data: { isActive: !feed.isActive }
                      })
                    }
                  >
                    {feed.isActive ? (
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