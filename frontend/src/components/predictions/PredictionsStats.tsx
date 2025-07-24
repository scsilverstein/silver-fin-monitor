import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Prediction } from '@/lib/api';

interface PredictionsStatsProps {
  predictions: Prediction[];
}

export const PredictionsStats: React.FC<PredictionsStatsProps> = ({ predictions }) => {
  const highConfidenceCount = predictions.filter(p => p.confidenceLevel >= 0.7).length;
  const nearTermCount = predictions.filter(p => p.timeHorizon === '1_week').length;
  const avgConfidence = predictions.length > 0 
    ? Math.round(predictions.reduce((acc, p) => acc + p.confidenceLevel, 0) / predictions.length * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{predictions.length}</div>
          <p className="text-sm text-muted-foreground">Total Predictions</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{highConfidenceCount}</div>
          <p className="text-sm text-muted-foreground">High Confidence</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{nearTermCount}</div>
          <p className="text-sm text-muted-foreground">Near Term</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{avgConfidence}%</div>
          <p className="text-sm text-muted-foreground">Avg Confidence</p>
        </CardContent>
      </Card>
    </div>
  );
};