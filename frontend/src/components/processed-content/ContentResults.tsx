import React from 'react';
import { ModernCard, CardHeader, CardTitle, CardContent } from '@/components/ui/ModernCard';
import { ProcessedContent, FeedSource } from '@/lib/api';
import { ContentItem } from './ContentItem';

interface ContentResultsProps {
  content: ProcessedContent[];
  feedSources: FeedSource[];
  onItemClick: (item: ProcessedContent) => void;
}

export const ContentResults: React.FC<ContentResultsProps> = ({
  content,
  feedSources,
  onItemClick
}) => {
  const getSourceName = (sourceId: string) => {
    const source = feedSources.find(s => s.id === sourceId);
    return source?.name || 'Unknown Source';
  };

  if (content.length === 0) {
    return null;
  }

  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <CardTitle>Search Results ({content.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {content.map((item) => (
            <ContentItem
              key={item.id}
              item={item}
              sourceName={getSourceName(item.rawFeedId)}
              onClick={() => onItemClick(item)}
              showFullDate={true}
            />
          ))}
        </div>
      </CardContent>
    </ModernCard>
  );
};