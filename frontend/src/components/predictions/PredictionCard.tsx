import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Target, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Prediction } from '@/lib/api';
import { AnalysisLink, DateLink } from '@/components/navigation/ClickableLinks';
import { getHorizonBadgeColor, formatHorizon, formatType } from '@/utils/predictionHelpers';

interface PredictionCardProps {
  prediction: Prediction;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ prediction }) => {
  const predictionData = prediction.predictionData || {};
  
  return (
    <Card className="hover:shadow-lg transition-shadow hover-lift">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {formatType(prediction.predictionType)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={getHorizonBadgeColor(prediction.timeHorizon)}>
                {formatHorizon(prediction.timeHorizon)}
              </Badge>
              <Badge variant="outline">
                {Math.round(prediction.confidenceLevel * 100)}% Confidence
              </Badge>
            </div>
          </div>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{prediction.predictionText}</p>
        
        {predictionData.reasoning && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-semibold">Reasoning</h4>
            <p className="text-sm text-muted-foreground">{predictionData.reasoning}</p>
          </div>
        )}
        
        {predictionData.key_factors && Array.isArray(predictionData.key_factors) && predictionData.key_factors.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-semibold">Key Factors</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {predictionData.key_factors.slice(0, 3).map((factor: string, idx: number) => (
                <li key={idx}>{factor}</li>
              ))}
            </ul>
          </div>
        )}
        
        {predictionData.price_targets && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Price Targets
            </h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              {predictionData.price_targets.primary && (
                <p>Primary: {predictionData.price_targets.primary}</p>
              )}
              {predictionData.price_targets.upside && (
                <p className="text-green-600">Upside: {predictionData.price_targets.upside}</p>
              )}
              {predictionData.price_targets.downside && (
                <p className="text-red-600">Downside: {predictionData.price_targets.downside}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Navigation Links */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <AnalysisLink 
              analysisId={prediction.dailyAnalysisId}
              size="sm"
            />
            <DateLink 
              date={prediction.createdAt}
              linkTo="analysis"
              size="sm"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            View Details <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};