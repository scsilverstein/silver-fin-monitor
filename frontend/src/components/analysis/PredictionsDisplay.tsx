// Predictions display component following CLAUDE.md specification
import React, { useEffect, useState } from 'react';
import { useAnalysisStore } from '../../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { parseSafeDate } from '../../lib/utils';
import { 
  AlertCircle, 
  Clock,
  Target,
  TrendingUp,
  Globe,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  BarChart3
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PredictionsDisplayProps {
  analysisId?: string;
  showAccuracy?: boolean;
}

export const PredictionsDisplay: React.FC<PredictionsDisplayProps> = ({ 
  analysisId,
  showAccuracy = true
}) => {
  const { 
    predictions, 
    comparisons,
    accuracyMetrics,
    loading, 
    error, 
    fetchPredictions,
    fetchComparisons,
    fetchAccuracyMetrics,
    evaluatePrediction
  } = useAnalysisStore();

  const [selectedHorizon, setSelectedHorizon] = useState<string>('all');

  useEffect(() => {
    fetchPredictions(analysisId);
    if (showAccuracy) {
      fetchComparisons();
      fetchAccuracyMetrics();
    }
  }, [fetchPredictions, fetchComparisons, fetchAccuracyMetrics, analysisId, showAccuracy]);

  const getPredictionIcon = (type: string) => {
    switch (type) {
      case 'market_direction':
        return <TrendingUp className="h-4 w-4" />;
      case 'sector_performance':
        return <BarChart3 className="h-4 w-4" />;
      case 'economic_indicator':
        return <DollarSign className="h-4 w-4" />;
      case 'geopolitical_event':
        return <Globe className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatTimeHorizon = (horizon: string) => {
    return horizon.replace(/_/g, ' ');
  };

  const filteredPredictions = selectedHorizon === 'all' 
    ? predictions 
    : predictions.filter(p => p.time_horizon === selectedHorizon);

  const getEvaluationStatus = (predictionId: string) => {
    return comparisons.find(c => c.prediction_id === predictionId);
  };

  if (loading && predictions.length === 0) {
    return <PredictionsSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accuracy Overview */}
      {showAccuracy && accuracyMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Prediction Accuracy</CardTitle>
            <CardDescription>Performance metrics across all predictions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Overall Accuracy</p>
                <p className="text-2xl font-bold">
                  {(accuracyMetrics.overall_accuracy * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Confidence Calibration</p>
                <p className="text-2xl font-bold">
                  {(accuracyMetrics.confidence_calibration * 100).toFixed(0)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Evaluated</p>
                <p className="text-2xl font-bold">{accuracyMetrics.total_evaluated}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{accuracyMetrics.total_pending}</p>
              </div>
            </div>

            {/* Accuracy by Type */}
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-medium">Accuracy by Type</h4>
              {Object.entries(accuracyMetrics.by_type).map(([type, accuracy]) => (
                <div key={type} className="flex items-center gap-3">
                  {getPredictionIcon(type)}
                  <span className="text-sm flex-1">{type.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-medium">{(accuracy * 100).toFixed(1)}%</span>
                  <Progress value={accuracy * 100} className="w-24 h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Predictions Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Predictions</CardTitle>
          <CardDescription>Forward-looking insights and market forecasts</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedHorizon} onValueChange={setSelectedHorizon}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="1_week">1 Week</TabsTrigger>
              <TabsTrigger value="1_month">1 Month</TabsTrigger>
              <TabsTrigger value="3_months">3 Months</TabsTrigger>
              <TabsTrigger value="6_months">6 Months</TabsTrigger>
              <TabsTrigger value="1_year">1 Year</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedHorizon} className="mt-6 space-y-4">
              {filteredPredictions.map((prediction) => {
                const evaluation = getEvaluationStatus(prediction.id);
                
                return (
                  <Card key={prediction.id} className="border-l-4" style={{
                    borderLeftColor: evaluation 
                      ? evaluation.accuracy_score >= 0.7 ? '#10b981' : '#ef4444'
                      : '#e5e7eb'
                  }}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          {getPredictionIcon(prediction.prediction_type)}
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-sm">{prediction.prediction_text}</p>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className="text-xs">
                                {formatTimeHorizon(prediction.time_horizon)}
                              </Badge>
                              
                              {evaluation ? (
                                evaluation.accuracy_score >= 0.7 ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )
                              ) : (
                                <Clock className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                <span className={getConfidenceColor(prediction.confidence_level)}>
                                  {(prediction.confidence_level * 100).toFixed(0)}% confidence
                                </span>
                              </span>
                              
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {(() => {
                                  const date = parseSafeDate(prediction.created_at);
                                  return date 
                                    ? formatDistanceToNow(date, { addSuffix: true })
                                    : 'unknown time';
                                })()}
                              </span>
                            </div>
                            
                            {!evaluation && !loading && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => evaluatePrediction(prediction.id)}
                              >
                                Evaluate
                              </Button>
                            )}
                          </div>
                          
                          {evaluation && (
                            <div className="mt-3 p-3 bg-muted rounded-md">
                              <p className="text-xs font-medium mb-1">
                                Accuracy: {(evaluation.accuracy_score * 100).toFixed(0)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {evaluation.outcome_description}
                              </p>
                            </div>
                          )}
                          
                          {prediction.prediction_data && Object.keys(prediction.prediction_data).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {Object.entries(prediction.prediction_data).slice(0, 3).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {filteredPredictions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No predictions for this time horizon
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

// Loading skeleton
const PredictionsSkeleton: React.FC = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="text-center">
              <Skeleton className="h-4 w-24 mx-auto mb-2" />
              <Skeleton className="h-8 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full mb-6" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full mb-3" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);