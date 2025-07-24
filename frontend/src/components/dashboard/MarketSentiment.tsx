import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle, ModernBadge } from '@/components/ui';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatPercent } from '@/lib/utils';

interface MarketSentimentProps {
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  confidence?: number;
  loading?: boolean;
}

export const MarketSentiment: React.FC<MarketSentimentProps> = ({
  sentiment = 'neutral',
  confidence = 0,
  loading
}) => {
  const sentimentConfig = {
    bullish: {
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      label: 'Bullish'
    },
    bearish: {
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      label: 'Bearish'
    },
    neutral: {
      icon: Minus,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      label: 'Neutral'
    }
  };

  const config = sentimentConfig[sentiment];
  const Icon = config.icon;

  if (loading) {
    return (
      <ModernCard>
        <CardHeader>
          <CardTitle>Market Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-24 w-24 bg-muted rounded-full mx-auto mb-4" />
            <div className="h-6 bg-muted rounded w-32 mx-auto mb-2" />
            <div className="h-4 bg-muted rounded w-24 mx-auto" />
          </div>
        </CardContent>
      </ModernCard>
    );
  }

  return (
    <ModernCard>
      <CardHeader>
        <CardTitle>Market Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${config.bgColor} mb-4`}>
            <Icon className={`h-12 w-12 ${config.color}`} />
          </div>
          <h3 className="text-2xl font-bold mb-2">{config.label}</h3>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Confidence:</span>
            <ModernBadge variant="secondary">{formatPercent(confidence)}</ModernBadge>
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );
};