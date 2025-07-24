import React from 'react';
import { ModernCard, CardHeader, CardTitle, CardContent } from '@/components/ui/ModernCard';

interface TopicTrendsProps {
  trends: any;
}

export const TopicTrends: React.FC<TopicTrendsProps> = ({ trends }) => {
  const topTopics = trends?.topicTrends?.[0]?.topics || [];
  const maxCount = topTopics[0]?.count || 1;

  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <CardTitle>Trending Topics</CardTitle>
      </CardHeader>
      <CardContent>
        {topTopics.length > 0 ? (
          <div className="space-y-3">
            {topTopics.map((topic: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-sm font-medium capitalize">{topic.topic}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min((topic.count / maxCount) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    {topic.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No trending topics available
          </div>
        )}
      </CardContent>
    </ModernCard>
  );
};