import React, { useState } from 'react';
import { 
  ModernCard, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  ModernBadge,
  ModernButton
} from '@/components/ui';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  BarChart3,
  Eye,
  Code,
  Clock,
  Target,
  Brain,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatDate, formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PredictionComparison {
  id: string;
  comparisonDate: Date;
  previousPredictionId: string;
  currentAnalysisId: string;
  accuracyScore: number;
  outcomeDescription: string;
  comparisonAnalysis: {
    correctAspects: string[];
    incorrectAspects: string[];
    influencingFactors: string[];
    lessonsLearned: string[];
    timeElapsed: string;
    rawResponse?: any;
  };
  createdAt: Date;
}

interface Prediction {
  id: string;
  predictionText?: string;
  confidenceLevel?: number;
  timeHorizon: string;
  predictionType?: string;
  createdAt: Date;
}

interface DailyAnalysis {
  id: string;
  analysisDate: Date;
  marketSentiment?: string;
  keyThemes: string[];
  overallSummary?: string;
}

interface PredictionComparisonProps {
  comparison: PredictionComparison;
  originalPrediction?: Prediction;
  currentAnalysis?: DailyAnalysis;
  showDetails?: boolean;
  className?: string;
}

export const PredictionComparisonDetail: React.FC<PredictionComparisonProps> = ({
  comparison,
  originalPrediction,
  currentAnalysis,
  showDetails = false,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetails);
  const [showJson, setShowJson] = useState(false);

  const getAccuracyConfig = (score: number) => {
    if (score >= 0.8) return { 
      variant: 'success', 
      label: 'Excellent', 
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      icon: CheckCircle
    };
    if (score >= 0.6) return { 
      variant: 'warning', 
      label: 'Good', 
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      icon: TrendingUp
    };
    if (score >= 0.4) return { 
      variant: 'destructive', 
      label: 'Fair', 
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      icon: AlertTriangle
    };
    return { 
      variant: 'destructive', 
      label: 'Poor', 
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      icon: XCircle
    };
  };

  const accuracyConfig = getAccuracyConfig(comparison.accuracyScore);
  const AccuracyIcon = accuracyConfig.icon;

  return (
    <ModernCard className={cn("overflow-hidden", className)}>
      {/* Header Section */}
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "p-2 rounded-lg",
                accuracyConfig.bgColor
              )}>
                <AccuracyIcon className={cn("h-5 w-5", accuracyConfig.color)} />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Prediction Accuracy Assessment
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Comparing prediction with actual market outcomes
                </p>
              </div>
            </div>
          </div>
          
          {/* Accuracy Score */}
          <div className="text-right">
            <div className="text-3xl font-bold mb-1">
              {formatPercent(comparison.accuracyScore)}
            </div>
            <ModernBadge variant={accuracyConfig.variant as any}>
              {accuracyConfig.label} Accuracy
            </ModernBadge>
          </div>
        </div>
        
        {/* Metadata */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(comparison.comparisonDate)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{comparison.comparisonAnalysis.timeElapsed}</span>
          </div>
          {originalPrediction && (
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              <span>{originalPrediction.predictionType?.replace(/_/g, ' ') || 'General'}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Outcome Description */}
        <div className="p-4 bg-muted/20 rounded-lg">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Assessment Summary
          </h4>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {comparison.outcomeDescription}
          </p>
        </div>

        {/* Original Prediction vs Current State */}
        {(originalPrediction || currentAnalysis) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {originalPrediction && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-blue-600">Original Prediction</h4>
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-medium mb-2">{originalPrediction.predictionText}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Confidence: {formatPercent(originalPrediction.confidenceLevel || 0)}</span>
                    <span>•</span>
                    <span>{formatDate(originalPrediction.createdAt)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {currentAnalysis && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-green-600">Current Market State</h4>
                <div className="p-3 bg-green-50 rounded-lg text-sm">
                  <p className="font-medium mb-2">
                    Market Sentiment: {currentAnalysis.marketSentiment || 'Unknown'}
                  </p>
                  <p className="text-muted-foreground mb-2">
                    {currentAnalysis.overallSummary}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Key Themes: {currentAnalysis.keyThemes.join(', ')}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Correct vs Incorrect Aspects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Correct Aspects */}
          {comparison.comparisonAnalysis.correctAspects.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                What Was Correct
              </h4>
              <div className="space-y-1">
                {comparison.comparisonAnalysis.correctAspects.map((aspect, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                    <span className="text-muted-foreground">{aspect}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incorrect Aspects */}
          {comparison.comparisonAnalysis.incorrectAspects.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-red-600 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                What Was Incorrect
              </h4>
              <div className="space-y-1">
                {comparison.comparisonAnalysis.incorrectAspects.map((aspect, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                    <span className="text-muted-foreground">{aspect}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Influencing Factors */}
        {comparison.comparisonAnalysis.influencingFactors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Key Influencing Factors
            </h4>
            <div className="space-y-1">
              {comparison.comparisonAnalysis.influencingFactors.map((factor, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <span className="text-muted-foreground">{factor}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lessons Learned */}
        {comparison.comparisonAnalysis.lessonsLearned.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              Lessons Learned
            </h4>
            <div className="space-y-1">
              {comparison.comparisonAnalysis.lessonsLearned.map((lesson, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                  <span className="text-muted-foreground">{lesson}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Details */}
        <div className="border-t pt-4">
          <div className="flex gap-2">
            <ModernButton
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1"
            >
              <Eye className="h-3 w-3 mr-1" />
              {isExpanded ? 'Hide Details' : 'Show Details'}
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1" />
              )}
            </ModernButton>
            
            <ModernButton
              variant="outline"
              size="sm"
              onClick={() => setShowJson(!showJson)}
            >
              <Code className="h-3 w-3 mr-1" />
              {showJson ? 'Hide JSON' : 'Show JSON'}
            </ModernButton>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-4 space-y-4 p-4 bg-muted/20 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Comparison ID:</span>
                  <p className="text-muted-foreground font-mono text-xs break-all">
                    {comparison.id}
                  </p>
                </div>
                
                <div>
                  <span className="font-medium">Previous Prediction ID:</span>
                  <p className="text-muted-foreground font-mono text-xs break-all">
                    {comparison.previousPredictionId}
                  </p>
                </div>
                
                <div>
                  <span className="font-medium">Current Analysis ID:</span>
                  <p className="text-muted-foreground font-mono text-xs break-all">
                    {comparison.currentAnalysisId}
                  </p>
                </div>
                
                <div>
                  <span className="font-medium">Created:</span>
                  <p className="text-muted-foreground">
                    {new Date(comparison.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* JSON View */}
          {showJson && (
            <div className="mt-4">
              <h5 className="font-medium text-sm mb-2">Raw JSON Data</h5>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(comparison, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </ModernCard>
  );
};