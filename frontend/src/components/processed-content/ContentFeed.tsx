import React from 'react';
import { ModernCard, CardHeader, CardTitle, CardContent } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { Clock } from 'lucide-react';
import { ProcessedContent, FeedSource } from '@/lib/api';
import { ContentItem } from './ContentItem';

interface ContentFeedProps {
  content: ProcessedContent[];
  feedSources: FeedSource[];
  onRefresh: () => void;
  onItemClick: (item: ProcessedContent) => void;
}

export const ContentFeed: React.FC<ContentFeedProps> = ({
  content,
  feedSources,
  onRefresh,
  onItemClick
}) => {
  const getSourceName = (sourceId: string) => {
    const source = feedSources.find(s => s.id === sourceId);
    return source?.name || 'Unknown Source';
  };

  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Latest Content Feed
          </CardTitle>
          <ModernButton variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </ModernButton>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {content.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent content available
          </div>
        ) : (
          <div className="space-y-3">
            {content.map((item) => (
              <ContentItem
                key={item.id}
                item={item}
                sourceName={getSourceName(item.rawFeedId)}
                onClick={() => onItemClick(item)}
                showFullDate={false}
              />
            ))}
          </div>
        )}
      </CardContent>
    </ModernCard>
  );
};