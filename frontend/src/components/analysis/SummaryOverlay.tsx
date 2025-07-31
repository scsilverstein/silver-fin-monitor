import React, { useMemo } from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { Badge } from '@/components/ui/Badge';
import { Calendar, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface AnalysisData {
  id: string;
  analysis_date: string;
  market_sentiment: string;
  key_themes: string[];
  overall_summary: string;
  sources_analyzed: number;
  confidence_score: number;
}

interface SummaryOverlayProps {
  analysis: AnalysisData;
  showTimeReferences: boolean;
  showMarketMovements: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

export const SummaryOverlay: React.FC<SummaryOverlayProps> = ({
  analysis,
  showTimeReferences,
  showMarketMovements,
  isSelected = false,
  onClick
}) => {
  // Process summary to optionally remove time/market references
  const processedSummary = useMemo(() => {
    let summary = analysis.overall_summary;

    if (!showTimeReferences) {
      // Remove time references like "this week", "today", "yesterday", dates, etc.
      summary = summary.replace(
        /\b(today|yesterday|tomorrow|this week|last week|next week|this month|last month|next month|this year|last year|next year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})\b/gi,
        '[time reference]'
      );
    }

    if (!showMarketMovements) {
      // Remove market movement references like "rose", "fell", "gained", "lost", percentages
      summary = summary.replace(
        /\b(rose|fell|gained|lost|increased|decreased|jumped|dropped|surged|plunged|rallied|declined|up|down|higher|lower|climbed|slipped|advanced|retreated|\+?\-?\d+\.?\d*%|\$\d+\.?\d*)\b/gi,
        '[market movement]'
      );
    }

    return summary;
  }, [analysis.overall_summary, showTimeReferences, showMarketMovements]);

  const getSentimentIcon = () => {
    switch (analysis.market_sentiment) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getSentimentColor = () => {
    switch (analysis.market_sentiment) {
      case 'bullish':
        return 'text-green-600 dark:text-green-400';
      case 'bearish':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <ModernCard 
      className={cn(
        "transition-all duration-200 cursor-pointer",
        isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md",
        onClick && "hover:scale-[1.02]"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              {showTimeReferences && (
                <>
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{format(parseISO(analysis.analysis_date), 'MMM dd, yyyy')}</span>
                </>
              )}
              {!showTimeReferences && (
                <span>Market Analysis</span>
              )}
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-2">
            {showMarketMovements && (
              <div className={cn("flex items-center gap-1", getSentimentColor())}>
                {getSentimentIcon()}
                <span className="text-sm font-medium capitalize">
                  {analysis.market_sentiment}
                </span>
              </div>
            )}
            <Badge variant="outline" className="text-xs">
              {(analysis.confidence_score * 100).toFixed(0)}%
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Key Themes */}
        <div className="flex flex-wrap gap-1">
          {analysis.key_themes.slice(0, 3).map((theme, index) => (
            <Badge 
              key={index} 
              variant="secondary" 
              className="text-xs px-2 py-0.5"
            >
              {theme}
            </Badge>
          ))}
          {analysis.key_themes.length > 3 && (
            <Badge 
              variant="outline" 
              className="text-xs px-2 py-0.5"
            >
              +{analysis.key_themes.length - 3} more
            </Badge>
          )}
        </div>

        {/* Summary Text */}
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
          {processedSummary}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {analysis.sources_analyzed} sources analyzed
          </span>
          {onClick && (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </ModernCard>
  );
};