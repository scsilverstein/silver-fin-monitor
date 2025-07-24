import React from 'react';
import { GridLayout } from '@/components/layout';
import { MetricCard } from '@/components/ui/ModernCard';
import { FileText, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { ProcessedContent } from '@/lib/api';

interface ContentStatsProps {
  content: ProcessedContent[];
  stats: any;
  totalItems?: number;
}

export const ContentStats: React.FC<ContentStatsProps> = ({ content, stats, totalItems }) => {
  const totalContent = totalItems || stats?.total_content || content.length;
  const positiveContent = stats?.positive_count || content.filter(c => c.sentiment_score && c.sentiment_score > 0.1).length;
  const negativeContent = stats?.negative_count || content.filter(c => c.sentiment_score && c.sentiment_score < -0.1).length;
  const recentContent = content.filter(c => {
    const createdAt = new Date(c.created_at);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return createdAt > oneDayAgo;
  }).length;

  return (
    <GridLayout columns={4} gap="md">
      <MetricCard
        title="Total Content"
        value={totalContent.toString()}
        change={{ value: recentContent, type: 'increase' }}
        icon={<FileText className="h-5 w-5 text-primary" />}
        description={`${recentContent} added today`}
      />
      <MetricCard
        title="Positive Sentiment"
        value={positiveContent.toString()}
        change={{ 
          value: totalContent > 0 ? Math.round((positiveContent / totalContent) * 100) : 0, 
          type: 'increase' 
        }}
        icon={<TrendingUp className="h-5 w-5 text-success" />}
        description="Bullish content"
      />
      <MetricCard
        title="Negative Sentiment"
        value={negativeContent.toString()}
        change={{ 
          value: totalContent > 0 ? Math.round((negativeContent / totalContent) * 100) : 0, 
          type: 'decrease' 
        }}
        icon={<TrendingDown className="h-5 w-5 text-destructive" />}
        description="Bearish content"
      />
      <MetricCard
        title="Processing Rate"
        value={stats?.processingRate || '0'}
        change={{ value: 0, type: 'increase' }}
        icon={<Activity className="h-5 w-5 text-info" />}
        description="Items per hour"
      />
    </GridLayout>
  );
};