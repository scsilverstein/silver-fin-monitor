import React from 'react';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { ModernButton } from '@/components/ui/ModernButton';
import { ExternalLink, Tag } from 'lucide-react';
import { ProcessedContent } from '@/lib/api';
import { getSentimentDisplay, formatPreview } from '@/utils/contentHelpers';
import { EntityLink, TopicLink, SourceLink, QuickLinks } from '@/components/navigation/ClickableLinks';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ContentItemProps {
  item: ProcessedContent;
  sourceName: string;
  onClick: () => void;
  showFullDate?: boolean;
}

export const ContentItem: React.FC<ContentItemProps> = ({
  item,
  sourceName,
  onClick,
  showFullDate = false
}) => {
  const sentiment = getSentimentDisplay(item.sentimentScore);
  
  return (
    <div
      className="p-4 border border-border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <SourceLink 
              sourceId={item.source_id || ''}
              sourceName={sourceName}
              sourceType={item.source_type}
              size="sm"
            />
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
              sentiment.bg,
              sentiment.color
            )}>
              {sentiment.icon}
              <span>{sentiment.label}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {showFullDate 
                ? format(new Date(item.createdAt), 'MMM dd, yyyy')
                : formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
              }
            </span>
          </div>
          
          {item.title && (
            <h4 className="font-medium text-sm leading-tight">
              {item.title}
            </h4>
          )}
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            {formatPreview(item.summary || item.processedText, showFullDate ? 200 : 150)}
          </p>
          
          {/* Topics as clickable links */}
          {item.keyTopics && item.keyTopics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.keyTopics.slice(0, 3).map((topic, index) => (
                <TopicLink 
                  key={index}
                  topic={topic}
                  size="sm"
                  showIcon={!showFullDate}
                />
              ))}
              {item.keyTopics.length > 3 && (
                <ModernBadge variant="secondary" className="text-xs">
                  +{item.keyTopics.length - 3} more
                </ModernBadge>
              )}
            </div>
          )}
          
          {/* Entities as clickable links */}
          {item.entities && item.entities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.entities.slice(0, 4).map((entity, index) => (
                <EntityLink 
                  key={index}
                  entity={entity}
                  size="sm"
                  showIcon={false}
                  showType={false}
                />
              ))}
              {item.entities.length > 4 && (
                <ModernBadge variant="outline" className="text-xs">
                  +{item.entities.length - 4} entities
                </ModernBadge>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-medium">
              {showFullDate ? `Score: ${item.sentimentScore.toFixed(2)}` :
                `${(item.sentimentScore > 0 ? '+' : '') + item.sentimentScore.toFixed(2)}`}
            </div>
            {!showFullDate && (
              <div className="text-xs text-muted-foreground">
                sentiment
              </div>
            )}
          </div>
          {!showFullDate && (
            <ModernButton variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4" />
            </ModernButton>
          )}
        </div>
      </div>
    </div>
  );
};