import React from 'react';
import { ModernCard, CardHeader, CardTitle, CardContent } from '@/components/ui/ModernCard';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { DashboardOverview } from '@/lib/api';

interface MarketIntelligenceProps {
  overview: DashboardOverview | null;
}

export const MarketIntelligence: React.FC<MarketIntelligenceProps> = ({ overview }) => {
  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <CardTitle>Today's Market Intelligence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview?.keyThemes && overview.keyThemes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Key Themes</h4>
            <div className="flex flex-wrap gap-2">
              {overview.keyThemes.map((theme, index) => (
                <ModernBadge key={index} variant="secondary" size="sm">
                  {theme}
                </ModernBadge>
              ))}
            </div>
          </div>
        )}
        
        {overview?.contributingSources && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Contributing Sources</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {overview.contributingSources.sources?.slice(0, 5).map((source: any) => (
                <div key={source.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{source.name}</span>
                  <ModernBadge variant="outline" size="sm">
                    {source.count} items
                  </ModernBadge>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last Analysis:</span>
            <span className="font-medium">
              {overview?.lastAnalysisDate 
                ? new Date(overview.lastAnalysisDate).toLocaleDateString() 
                : 'Never'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Content Processed:</span>
            <span className="font-medium">{overview?.recentContentCount || 0} items</span>
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );
};