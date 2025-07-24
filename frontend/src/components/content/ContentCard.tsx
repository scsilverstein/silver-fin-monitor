import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { ModernButton } from '@/components/ui/ModernButton';
import { Calendar, ChevronDown, ChevronUp, ExternalLink, Eye, Clock } from 'lucide-react';
import { ProcessedContent } from '@/lib/api';
import { sentimentColors, sentimentIcons } from '@/config/entityTypes';
import { cn } from '@/lib/utils';
import { 
  getRelativeTime, 
  formatDate, 
  formatDateTime, 
  getFreshnessLevel, 
  freshnessColors,
  freshnessBackgrounds 
} from '@/utils/dateUtils';

interface ContentCardProps {
  content: ProcessedContent;
  expanded: boolean;
  getSentimentLabel: (score?: number) => string;
  onToggleExpand: () => void;
  onViewDetails?: () => void;
  children?: React.ReactNode;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  content,
  expanded,
  getSentimentLabel,
  onToggleExpand,
  onViewDetails,
  children
}) => {
  const sentimentLabel = getSentimentLabel(content.sentiment_score);
  const sentimentColor = sentimentColors[sentimentLabel as keyof typeof sentimentColors];
  const sentimentIcon = sentimentIcons[sentimentLabel as keyof typeof sentimentIcons];
  
  // Determine freshness based on publish date if available, otherwise use created date
  const dateForFreshness = content.published_at || content.publishedAt || content.created_at || content.createdAt;
  const freshnessLevel = getFreshnessLevel(dateForFreshness!);
  const freshnessColor = freshnessColors[freshnessLevel];
  const freshnessBackground = freshnessBackgrounds[freshnessLevel];

  // Define border colors for freshness
  const freshnessBorders: Record<string, string> = {
    fresh: 'border-l-4 border-l-green-500',
    recent: 'border-l-4 border-l-blue-500',
    moderate: 'border-l-4 border-l-yellow-500',
    old: 'border-l-4 border-l-orange-500',
    stale: 'border-l-4 border-l-red-500'
  };
  
  return (
    <ModernCard 
      variant="bordered" 
      className={cn(
        "hover:shadow-lg transition-all duration-200 hover-lift",
        freshnessBackground,
        freshnessBorders[freshnessLevel]
      )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2 mb-2">
              {content.summary || 'No summary available'}
            </CardTitle>
            
            <div className="flex flex-col gap-1 text-sm">
              {/* Published date with freshness color */}
              {(content.published_at || content.publishedAt) ? (
                <>
                  <div className={cn("flex items-center gap-1")} 
                       title={`Published: ${formatDateTime(content.published_at || content.publishedAt!)}`}>
                    <Calendar className="h-3 w-3" />
                    <span className="font-medium">Published:</span>
                    <span>{getRelativeTime(content.published_at || content.publishedAt!)}</span>
                    <span className="text-xs opacity-75">({formatDateTime(content.published_at || content.publishedAt!)})</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground" 
                       title={`Processed: ${formatDateTime(content.created_at || content.createdAt!)}`}>
                    <Clock className="h-3 w-3" />
                    <span>Processed:</span>
                    <span>{getRelativeTime(content.created_at || content.createdAt!)}</span>
                  </div>
                </>
              ) : (
                <div className={cn("flex items-center gap-1")} 
                     title={`Date: ${formatDateTime(content.created_at || content.createdAt!)}`}>
                  <Calendar className="h-3 w-3" />
                  <span>{getRelativeTime(content.created_at || content.createdAt!)}</span>
                  <span className="text-xs opacity-75">({formatDateTime(content.created_at || content.createdAt!)})</span>
                </div>
              )}
            </div>
            
            {/* Sentiment section */}
            <div className="flex items-center gap-2 mt-2 text-sm">
              <div className={cn("flex items-center gap-1", sentimentColor)}>
                {sentimentIcon}
                <span className="capitalize">{sentimentLabel}</span>
                {content.sentiment_score && (
                  <span className="text-xs">
                    ({(content.sentiment_score * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
              
              {/* Freshness indicator */}
              <span className={cn("text-xs font-medium", freshnessColor)}>
                {freshnessLevel === 'fresh' ? '🟢 Fresh' :
                 freshnessLevel === 'recent' ? '🔵 Recent' :
                 freshnessLevel === 'moderate' ? '🟡 Moderate' :
                 freshnessLevel === 'old' ? '🟠 Old' :
                 '🔴 Stale'}
              </span>
            </div>

            {/* Key Topics */}
            {content.key_topics && content.key_topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {content.key_topics.slice(0, 3).map((topic, index) => (
                  <ModernBadge key={index} variant="outline" size="sm">
                    {topic}
                  </ModernBadge>
                ))}
                {content.key_topics.length > 3 && (
                  <ModernBadge variant="secondary" size="sm">
                    +{content.key_topics.length - 3} more
                  </ModernBadge>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onViewDetails && (
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={onViewDetails}
                title="View details"
              >
                <Eye className="h-4 w-4" />
              </ModernButton>
            )}
            
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </ModernButton>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {children}
        </CardContent>
      )}
    </ModernCard>
  );
};