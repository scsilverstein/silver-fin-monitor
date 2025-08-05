// Feed source manager component following CLAUDE.md specification
import React, { useEffect, useState } from 'react';
import { useFeedStore } from '../../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { 
  AlertCircle, 
  Plus,
  Edit,
  Trash,
  RefreshCw,
  CheckCircle,
  XCircle,
  Rss,
  Podcast,
  Youtube,
  Globe,
  Play
} from 'lucide-react';
import { FeedSource } from '../../types';

export const FeedSourceManager: React.FC = () => {
  const { sources, loading, error, fetchSources, createSource, updateSource, deleteSource, processFeed } = useFeedStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<FeedSource | null>(null);
  const [processingSource, setProcessingSource] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleProcess = async (sourceId: string) => {
    setProcessingSource(sourceId);
    try {
      await processFeed(sourceId);
    } finally {
      setProcessingSource(null);
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (confirm('Are you sure you want to delete this feed source?')) {
      await deleteSource(sourceId);
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'rss':
        return <Rss className="h-5 w-5" />;
      case 'podcast':
        return <Podcast className="h-5 w-5" />;
      case 'youtube':
        return <Youtube className="h-5 w-5" />;
      case 'api':
        return <Globe className="h-5 w-5" />;
      default:
        return <Rss className="h-5 w-5" />;
    }
  };

  if (loading && sources.length === 0) {
    return <SourceManagerSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Feed Sources</h2>
          <p className="text-muted-foreground">Manage your data sources</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <FeedSourceForm 
              onSubmit={async (data) => {
                await createSource(data);
                setIsAddDialogOpen(false);
              }}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Sources Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sources.map((source) => (
          <Card key={source.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getSourceIcon(source.type)}
                  <div>
                    <CardTitle className="text-lg">{source.name}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {source.url}
                    </CardDescription>
                  </div>
                </div>
                
                <Switch
                  checked={source.is_active}
                  onCheckedChange={async (checked) => {
                    await updateSource(source.id, { is_active: checked });
                  }}
                />
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={source.is_active ? 'default' : 'secondary'}>
                  {source.is_active ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      Inactive
                    </>
                  )}
                </Badge>
              </div>
              
              {/* Last Processed */}
              {source.last_processed_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Processed</span>
                  <span>{new Date(source.last_processed_at).toLocaleDateString()}</span>
                </div>
              )}
              
              {/* Categories */}
              {source.config?.categories && source.config.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {source.config.categories.slice(0, 3).map((cat: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {cat}
                    </Badge>
                  ))}
                  {source.config.categories.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{source.config.categories.length - 3}
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleProcess(source.id)}
                  disabled={processingSource === source.id}
                >
                  {processingSource === source.id ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 mr-1" />
                  )}
                  Process
                </Button>
                
                <Dialog open={editingSource?.id === source.id} onOpenChange={(open) => !open && setEditingSource(null)}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSource(source)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <FeedSourceForm 
                      source={source}
                      onSubmit={async (data) => {
                        await updateSource(source.id, data);
                        setEditingSource(null);
                      }}
                      onCancel={() => setEditingSource(null)}
                    />
                  </DialogContent>
                </Dialog>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(source.id)}
                >
                  <Trash className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sources.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No feed sources configured</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Source
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Feed Source Form Component
interface FeedSourceFormProps {
  source?: FeedSource;
  onSubmit: (data: Partial<FeedSource>) => Promise<void>;
  onCancel: () => void;
}

const FeedSourceForm: React.FC<FeedSourceFormProps> = ({ source, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: source?.name || '',
    type: source?.type || 'rss',
    url: source?.url || '',
    is_active: source?.is_active ?? true,
    config: {
      categories: source?.config?.categories?.join(', ') || '',
      priority: source?.config?.priority || 'medium',
      update_frequency: source?.config?.update_frequency || 'hourly'
    }
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit({
        name: formData.name,
        type: formData.type as any,
        url: formData.url,
        is_active: formData.is_active,
        config: {
          ...formData.config,
          categories: formData.config.categories.split(',').map(c => c.trim()).filter(Boolean)
        }
      });
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{source ? 'Edit Feed Source' : 'Add Feed Source'}</DialogTitle>
        <DialogDescription>
          Configure the feed source details
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., CNBC Business News"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rss">RSS Feed</SelectItem>
              <SelectItem value="podcast">Podcast</SelectItem>
              <SelectItem value="youtube">YouTube Channel</SelectItem>
              <SelectItem value="api">API</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://example.com/feed"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="categories">Categories (comma-separated)</Label>
          <Input
            id="categories"
            value={formData.config.categories}
            onChange={(e) => setFormData({ 
              ...formData, 
              config: { ...formData.config, categories: e.target.value }
            })}
            placeholder="finance, markets, economy"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label htmlFor="active">Active</Label>
        </div>
      </div>
      
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            source ? 'Update' : 'Create'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
};

// Loading skeleton
const SourceManagerSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
    
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);