import React from 'react';
import { ModernCard, CardHeader, CardContent } from '@/components/ui/ModernCard';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { ModernButton } from '@/components/ui/ModernButton';
import { Calendar, TrendingUp, Shield, ChevronDown, ChevronUp, Eye, Clock, Zap } from 'lucide-react';
import { DailyAnalysis } from '@/lib/api';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';

interface AnalysisCardProps {
  analysis: DailyAnalysis;
  expanded: boolean;
  getSentimentColor: (sentiment: string) => string;
  getConfidenceColor: (confidence: number) => string;
  onToggleExpand: () => void;
  onViewDetails: () => void;
  children?: React.ReactNode;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({
  analysis,
  expanded,
  getSentimentColor,
  getConfidenceColor,
  onToggleExpand,
  onViewDetails,
  children
}) => {
  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMMM d, yyyy');
  };

  const formatProcessedTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMM d, h:mm a');
  };

  const getTimeAgo = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  };

  const getFreshnessInfo = (createdAt: Date | string) => {
    const dateObj = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const hoursAgo = differenceInHours(new Date(), dateObj);
    
    if (hoursAgo <= 6) {
      return {
        label: 'Fresh',
        variant: 'success' as const,
        icon: <Zap className="h-3 w-3" />,
        description: 'Recently processed'
      };
    } else if (hoursAgo <= 24) {
      return {
        label: 'Recent',
        variant: 'info' as const,
        icon: <Clock className="h-3 w-3" />,
        description: 'Processed today'
      };
    } else if (hoursAgo <= 72) {
      return {
        label: 'Aging',
        variant: 'warning' as const,
        icon: <Clock className="h-3 w-3" />,
        description: 'A few days old'
      };
    } else {
      return {
        label: 'Stale',
        variant: 'outline' as const,
        icon: <Clock className="h-3 w-3" />,
        description: 'Older analysis'
      };
    }
  };

  return (
    <ModernCard variant="elevated" className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">
                {formatDate(analysis.analysis_date)}
              </h3>
              <ModernBadge variant="outline" className={getSentimentColor(analysis.market_sentiment)}>
                {analysis.market_sentiment}
              </ModernBadge>
              {analysis.created_at && (() => {
                const freshness = getFreshnessInfo(analysis.created_at);
                return (
                  <ModernBadge 
                    variant={freshness.variant} 
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    {freshness.icon}
                    {freshness.label}
                  </ModernBadge>
                );
              })()}
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Shield className={`h-4 w-4 ${getConfidenceColor(analysis.confidence_score)}`} />
                <span className={getConfidenceColor(analysis.confidence_score)}>
                  {(analysis.confidence_score * 100).toFixed(0)}% confidence
                </span>
              </div>
              <span className="text-muted-foreground">
                {analysis.sources_analyzed} sources analyzed
              </span>
              {analysis.created_at && (
                <span className="text-muted-foreground">
                  Processed {getTimeAgo(analysis.created_at)}
                </span>
              )}
            </div>
            
            {analysis.created_at && (
              <div className="text-xs text-muted-foreground">
                Processed on {formatProcessedTime(analysis.created_at)}
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <ModernButton
              variant="ghost"
              size="sm"
              icon={expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              onClick={onToggleExpand}
            />
            <ModernButton
              variant="ghost"
              size="sm"
              icon={<Eye className="h-4 w-4" />}
              onClick={onViewDetails}
            >
              View
            </ModernButton>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {analysis.overall_summary}
          </p>
          
          {analysis.key_themes && analysis.key_themes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {analysis.key_themes.slice(0, 5).map((theme, index) => (
                <ModernBadge key={index} variant="secondary" size="sm">
                  {theme}
                </ModernBadge>
              ))}
              {analysis.key_themes.length > 5 && (
                <ModernBadge variant="outline" size="sm">
                  +{analysis.key_themes.length - 5} more
                </ModernBadge>
              )}
            </div>
          )}
          
          {expanded && children}
        </div>
      </CardContent>
    </ModernCard>
  );
};