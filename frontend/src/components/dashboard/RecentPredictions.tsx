import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernSkeleton } from '@/components/ui/ModernSkeleton';
import { TrendingUp } from 'lucide-react';
import { DashboardOverview } from '@/lib/api';

interface RecentPredictionsProps {
  overview: DashboardOverview | null;
  loading: boolean;
}

export const RecentPredictions: React.FC<RecentPredictionsProps> = ({
  overview,
  loading
}) => {
  if (loading || !overview) {
    return (
      <ModernCard variant="gradient">
        <CardHeader>
          <CardTitle>Active Predictions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ModernSkeleton className="h-20" />
          <ModernSkeleton className="h-20" />
          <ModernSkeleton className="h-20" />
        </CardContent>
      </ModernCard>
    );
  }

  const predictions = overview?.activePredictions || [];

  return (
    <ModernCard variant="gradient">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Active Predictions</CardTitle>
          <ModernBadge variant="secondary">
            {predictions.length}
          </ModernBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {predictions && predictions.length > 0 ? (
          predictions.slice(0, 5).map((prediction: any) => (
            <div key={prediction.id} className="p-3 bg-background/50 rounded-lg space-y-2 border border-border/50 hover:border-border transition-colors">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium flex-1" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {prediction.prediction_text}
                </h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                    prediction.prediction_type === 'market_direction' ? 'bg-blue-100 text-blue-700' :
                    prediction.prediction_type === 'economic_indicator' ? 'bg-green-100 text-green-700' :
                    prediction.prediction_type === 'geopolitical_event' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {prediction.prediction_type === 'market_direction' ? 'Market' :
                     prediction.prediction_type === 'economic_indicator' ? 'Economic' :
                     prediction.prediction_type === 'geopolitical_event' ? 'Geopolitical' :
                     prediction.prediction_type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-medium text-primary">
                  {(prediction.confidence_level * 100).toFixed(0)}%
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground capitalize">
                  {prediction.time_horizon.replace('_', ' ')}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div 
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${prediction.confidence_level * 100}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No active predictions</p>
            <p className="text-xs mt-1">Predictions will appear here once generated</p>
          </div>
        )}
        
        <ModernButton 
          variant="ghost" 
          fullWidth 
          className="mt-4 text-sm"
          onClick={() => window.location.href = '/predictions'}
        >
          View All Predictions {predictions.length > 0 && `(${predictions.length}+)`}
        </ModernButton>
      </CardContent>
    </ModernCard>
  );
};