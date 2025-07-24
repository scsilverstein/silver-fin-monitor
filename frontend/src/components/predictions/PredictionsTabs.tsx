import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PredictionCard } from './PredictionCard';
import { EmptyPredictions } from './EmptyPredictions';
import { formatType } from '@/utils/predictionHelpers';

interface GroupedPrediction {
  timeHorizon: string;
  predictions: any[];
  averageConfidence: number;
  count: number;
}

interface PredictionsTabsProps {
  groupedPredictions: GroupedPrediction[];
  getHorizonLabel: (horizon: string) => string;
}

export const PredictionsTabs: React.FC<PredictionsTabsProps> = ({ 
  groupedPredictions, 
  getHorizonLabel 
}) => {
  const defaultTab = groupedPredictions.find(g => g.predictions.length > 0)?.timeHorizon || '1_week';

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList className={`grid grid-cols-${Math.min(groupedPredictions.length, 5)} w-full`}>
        {groupedPredictions.map(group => (
          <TabsTrigger key={group.timeHorizon} value={group.timeHorizon} className="text-xs">
            <div className="flex items-center gap-1">
              <span className="hidden md:inline">{getHorizonLabel(group.timeHorizon)}</span>
              <span className="md:hidden">{group.timeHorizon.replace('_', '')}</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {group.count}
              </Badge>
            </div>
          </TabsTrigger>
        ))}
      </TabsList>
      
      {groupedPredictions.map(group => (
        <TabsContent key={group.timeHorizon} value={group.timeHorizon} className="space-y-4">
          {group.predictions.length === 0 ? (
            <EmptyPredictions
              message={`No ${getHorizonLabel(group.timeHorizon)} predictions`}
              description={`Generate new predictions to see ${getHorizonLabel(group.timeHorizon).toLowerCase()} forecasts`}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Average Confidence: {Math.round(group.averageConfidence * 100)}%</span>
                <span>•</span>
                <span>{group.count} predictions</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-in">
                {group.predictions.map((prediction, index) => (
                  <div key={prediction.id} className="animate-in slide-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                    <PredictionCard prediction={prediction} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
};