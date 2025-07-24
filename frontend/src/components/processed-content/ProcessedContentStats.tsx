import React from 'react';
import { GridLayout } from '@/components/layout';
import { MetricCard } from '@/components/ui/ModernCard';
import { Clock, TrendingUp, Eye } from 'lucide-react';
import { ProcessedContent, FeedSource } from '@/lib/api';

interface ProcessedContentStatsProps {
  latestContent: ProcessedContent[];
  feedSources: FeedSource[];
}

export const ProcessedContentStats: React.FC<ProcessedContentStatsProps> = ({
  latestContent,
  feedSources
}) => {
  const avgSentiment = latestContent.length > 0 
    ? (latestContent.reduce((acc, item) => acc + item.sentimentScore, 0) / latestContent.length).toFixed(2)
    : '0.00';

  return (
    <GridLayout columns={4} gap="md">
      <MetricCard
        title="Latest Content"
        value={latestContent.length.toString()}
        description="Recent items"
        icon={<Clock className="w-5 h-5 text-primary" />}
      />
      <MetricCard
        title="Active Sources"
        value={feedSources.filter(s => s.isActive).length.toString()}
        description="Processing feeds"
        icon={<TrendingUp className="w-5 h-5 text-success" />}
      />
      <MetricCard
        title="Avg Sentiment"
        value={avgSentiment}
        description="Overall mood"
        icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
      />
      <MetricCard
        title="Total Processed"
        value="—"
        description="All time"
        icon={<Eye className="w-5 h-5 text-purple-600" />}
      />
    </GridLayout>
  );
};