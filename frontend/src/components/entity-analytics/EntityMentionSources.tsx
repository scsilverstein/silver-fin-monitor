// Entity Mention Sources - displays content sources where entity was mentioned
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/ScrollArea';
import { 
  ExternalLink, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ArrowRight,
  RefreshCw,
  FileText,
  Radio
} from 'lucide-react';
import { entityAnalyticsService } from '../../services/entityAnalytics';
import { format } from 'date-fns';
import { EntityMention } from '../../types/entityAnalytics';

interface EntityMentionSourcesProps {
  entityName: string;
  onMentionClick?: (mentionId: string) => void;
  className?: string;
}

export const EntityMentionSources: React.FC<EntityMentionSourcesProps> = ({
  entityName,
  onMentionClick,
  className = ''
}) => {
  const [mentions, setMentions] = useState<EntityMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadMentions = async (reset = false) => {
    try {
      setLoading(true);
      if (reset) setOffset(0);
      
      const currentOffset = reset ? 0 : offset;
      const response = await entityAnalyticsService.getEntityMentions(
        entityName,
        limit,
        currentOffset
      );
      
      const mentions = response?.mentions || [];
      
      if (reset) {
        setMentions(mentions);
      } else {
        setMentions(prev => [...prev, ...mentions]);
      }
      
      setTotal(response?.total || 0);
      setHasMore(mentions.length === limit);
      
      if (!reset) {
        setOffset(prev => prev + limit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mentions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityName) {
      loadMentions(true);
    }
  }, [entityName]);

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.1) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (sentiment < -0.1) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.1) return 'text-green-600';
    if (sentiment < -0.1) return 'text-red-600';
    return 'text-gray-600';
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType.toLowerCase()) {
      case 'podcast':
        return <Radio className="h-4 w-4" />;
      case 'rss':
      case 'news':
        return <FileText className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  // Group mentions by source
  const mentionsBySource = (mentions || []).reduce((acc, mention) => {
    const sourceName = mention.sourceName || 'Unknown Source';
    if (!acc[sourceName]) {
      acc[sourceName] = {
        source: { name: sourceName, type: mention.sourceType || 'unknown' },
        mentions: [],
        totalMentions: 0,
        avgSentiment: 0
      };
    }
    acc[sourceName].mentions.push(mention);
    acc[sourceName].totalMentions++;
    return acc;
  }, {} as Record<string, {
    source: { name: string; type: string };
    mentions: EntityMention[];
    totalMentions: number;
    avgSentiment: number;
  }>);

  // Calculate average sentiment for each source
  Object.values(mentionsBySource).forEach(sourceData => {
    if (sourceData.mentions.length > 0) {
      sourceData.avgSentiment = sourceData.mentions.reduce((sum, m) => sum + (m.sentimentScore || 0), 0) / sourceData.mentions.length;
    } else {
      sourceData.avgSentiment = 0;
    }
  });

  // Sort sources by mention count
  const sortedSources = Object.entries(mentionsBySource)
    .sort(([, a], [, b]) => b.totalMentions - a.totalMentions);

  if (loading && mentions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => loadMentions(true)} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content Sources
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">
                {total} mentions
              </Badge>
            )}
          </CardTitle>
          <Button 
            onClick={() => loadMentions(true)} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Sources where "{entityName}" was mentioned
        </p>
      </CardHeader>
      <CardContent>
        {sortedSources.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No mentions found for this entity</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {sortedSources.map(([sourceName, sourceData]) => (
                <div key={sourceName} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  {/* Source Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(sourceData.source.type)}
                        <h4 className="font-medium">{sourceName}</h4>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {sourceData.source.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {sourceData.totalMentions} mention{sourceData.totalMentions !== 1 ? 's' : ''}
                      </span>
                      <div className="flex items-center gap-1">
                        {getSentimentIcon(sourceData.avgSentiment)}
                        <span className={`text-sm font-medium ${getSentimentColor(sourceData.avgSentiment)}`}>
                          {(sourceData.avgSentiment * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Mentions */}
                  <div className="space-y-2">
                    {sourceData.mentions.slice(0, 3).map((mention) => (
                      <div 
                        key={mention.id}
                        className="flex items-start gap-3 p-3 bg-background rounded border cursor-pointer hover:bg-accent/30"
                        onClick={() => onMentionClick?.(mention.id)}
                      >
                        <div className="flex-shrink-0 mt-1">
                          {getSentimentIcon(mention.sentimentScore)}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="text-sm font-medium truncate">{mention.contentTitle}</h5>
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {mention.contextSnippet}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(mention.mentionDate), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {sourceData.mentions.length > 3 && (
                      <div className="text-center pt-2">
                        <Button variant="outline" size="sm" className="text-xs">
                          View all {sourceData.mentions.length} mentions from {sourceName}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Load More Button */}
              {hasMore && (
                <div className="text-center pt-4">
                  <Button 
                    onClick={() => loadMentions(false)} 
                    variant="outline"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};