import React from 'react';
import { ModernCard, CardHeader, CardTitle, CardContent } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { ProcessedContent, FeedSource } from '@/lib/api';
import { getSentimentDisplay } from '@/utils/contentHelpers';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ContentModalProps {
  content: ProcessedContent;
  feedSources: FeedSource[];
  onClose: () => void;
}

export const ContentModal: React.FC<ContentModalProps> = ({
  content,
  feedSources,
  onClose
}) => {
  const getSourceName = (sourceId: string) => {
    const source = feedSources.find(s => s.id === sourceId);
    return source?.name || 'Unknown Source';
  };

  const sentiment = getSentimentDisplay(content.sentimentScore);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <ModernCard variant="glass" className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle>Content Details</CardTitle>
              <div className="flex items-center gap-2">
                <ModernBadge variant="outline">
                  {getSourceName(content.rawFeedId)}
                </ModernBadge>
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
                  sentiment.bg,
                  sentiment.color
                )}>
                  {sentiment.icon}
                  <span>{sentiment.label} ({content.sentimentScore.toFixed(2)})</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(content.createdAt), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
            </div>
            <ModernButton variant="ghost" size="sm" onClick={onClose}>
              ✕
            </ModernButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {content.title && (
            <div>
              <h3 className="font-semibold mb-2">Title</h3>
              <p className="text-sm">{content.title}</p>
            </div>
          )}
          
          <div>
            <h3 className="font-semibold mb-2">Summary</h3>
            <p className="text-sm leading-relaxed">{content.summary}</p>
          </div>
          
          {content.keyTopics && content.keyTopics.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Key Topics</h3>
              <div className="flex flex-wrap gap-2">
                {content.keyTopics.map((topic, index) => (
                  <ModernBadge key={index} variant="secondary">
                    {topic}
                  </ModernBadge>
                ))}
              </div>
            </div>
          )}
          
          {content.entities && Object.keys(content.entities).length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Entities</h3>
              <div className="space-y-2">
                {Object.entries(content.entities).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="font-medium capitalize">{key}:</span>{' '}
                    <span className="text-muted-foreground">
                      {Array.isArray(value) ? value.join(', ') : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <h3 className="font-semibold mb-2">Full Content</h3>
            <div className="p-4 bg-muted rounded-lg text-sm leading-relaxed max-h-64 overflow-y-auto">
              {content.processedText}
            </div>
          </div>
        </CardContent>
      </ModernCard>
    </div>
  );
};