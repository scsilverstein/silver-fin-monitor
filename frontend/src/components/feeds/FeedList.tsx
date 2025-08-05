// Feed list component following CLAUDE.md specification
import React, { useEffect, useState } from 'react';
import { useFeedStore } from '../../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { 
  AlertCircle, 
  Search, 
  Filter,
  RefreshCw,
  ExternalLink,
  Calendar,
  Hash,
  Rss,
  Podcast,
  Youtube,
  Globe,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FeedListProps {
  sourceId?: string;
  limit?: number;
  onFeedSelect?: (feedId: string) => void;
}

export const FeedList: React.FC<FeedListProps> = ({ 
  sourceId, 
  limit = 20,
  onFeedSelect 
}) => {
  const { feeds, loading, error, filters, fetchFeeds, setFilters } = useFeedStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [localFilters, setLocalFilters] = useState({
    status: 'all',
    sourceType: 'all'
  });

  useEffect(() => {
    fetchFeeds(sourceId);
  }, [fetchFeeds, sourceId, filters]);

  const handleRefresh = () => {
    fetchFeeds(sourceId);
  };

  const handleFilterChange = (key: string, value: string) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
    
    if (key === 'status' && value !== 'all') {
      setFilters({ ...filters, status: value });
    } else if (key === 'sourceType' && value !== 'all') {
      setFilters({ ...filters, sourceType: value });
    } else {
      const newFilters = { ...filters };
      delete newFilters.status;
      delete newFilters.sourceType;
      setFilters(newFilters);
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'rss':
        return <Rss className="h-4 w-4" />;
      case 'podcast':
        return <Podcast className="h-4 w-4" />;
      case 'youtube':
        return <Youtube className="h-4 w-4" />;
      case 'api':
        return <Globe className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      processing: 'default',
      completed: 'outline',
      failed: 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="text-xs">
        {status}
      </Badge>
    );
  };

  const filteredFeeds = feeds.filter(feed => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        feed.title.toLowerCase().includes(search) ||
        feed.description?.toLowerCase().includes(search) ||
        feed.content?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  if (loading && feeds.length === 0) {
    return <FeedListSkeleton />;
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
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search feeds..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select
              value={localFilters.status}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select
              value={localFilters.sourceType}
              onValueChange={(value) => handleFilterChange('sourceType', value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Source Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="rss">RSS</SelectItem>
                <SelectItem value="podcast">Podcast</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feed Items */}
      <div className="space-y-3">
        {filteredFeeds.slice(0, limit).map((feed) => (
          <Card 
            key={feed.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onFeedSelect?.(feed.id)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getSourceIcon(feed.metadata?.type || 'rss')}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm line-clamp-2">
                      {feed.title}
                    </h3>
                    {getStatusBadge(feed.processing_status)}
                  </div>
                  
                  {feed.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {feed.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(feed.published_at), { addSuffix: true })}
                    </span>
                    
                    {feed.url && (
                      <a
                        href={feed.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                    )}
                  </div>
                  
                  {feed.metadata?.tags && feed.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {feed.metadata.tags.slice(0, 5).map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFeeds.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No feeds found</p>
          </CardContent>
        </Card>
      )}

      {filteredFeeds.length > limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => {}}>
            Load More ({filteredFeeds.length - limit} remaining)
          </Button>
        </div>
      )}
    </div>
  );
};

// Loading skeleton
const FeedListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <Card key={i}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);