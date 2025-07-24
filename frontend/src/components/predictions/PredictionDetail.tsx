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
  Clock, 
  TrendingUp, 
  Target, 
  Brain, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Info,
  Eye,
  Code,
  Lightbulb
} from 'lucide-react';
import { formatDate, formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PredictionData {
  keyAssumptions?: string[];
  measurableOutcomes?: string[];
  generatedFrom?: string;
  [key: string]: any;
}

interface Prediction {
  id: string;
  dailyAnalysisId?: string;
  predictionType?: string;
  predictionText?: string;
  confidenceLevel?: number;
  timeHorizon: '1_week' | '1_month' | '3_months' | '6_months' | '1_year';
  predictionData: PredictionData;
  createdAt: Date;
}

interface PredictionDetailProps {
  prediction: Prediction;
  showRawJson?: boolean;
  className?: string;
}

export const PredictionDetail: React.FC<PredictionDetailProps> = ({
  prediction,
  showRawJson = false,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showJson, setShowJson] = useState(showRawJson);

  const getTimeHorizonConfig = (horizon: string) => {
    const configs = {
      '1_week': { 
        label: '1 Week', 
        color: 'bg-blue-500', 
        icon: Clock,
        urgency: 'immediate'
      },
      '1_month': { 
        label: '1 Month', 
        color: 'bg-green-500', 
        icon: Calendar,
        urgency: 'short-term'
      },
      '3_months': { 
        label: '3 Months', 
        color: 'bg-yellow-500', 
        icon: BarChart3,
        urgency: 'medium-term'
      },
      '6_months': { 
        label: '6 Months', 
        color: 'bg-orange-500', 
        icon: TrendingUp,
        urgency: 'medium-term'
      },
      '1_year': { 
        label: '1 Year', 
        color: 'bg-purple-500', 
        icon: Target,
        urgency: 'long-term'
      }
    };
    return configs[horizon as keyof typeof configs] || configs['1_month'];
  };

  const getPredictionTypeConfig = (type?: string) => {
    const configs = {
      'market_direction': { 
        label: 'Market Direction', 
        icon: TrendingUp, 
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      },
      'economic_indicator': { 
        label: 'Economic Indicator', 
        icon: BarChart3, 
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      },
      'geopolitical_event': { 
        label: 'Geopolitical Event', 
        icon: AlertTriangle, 
        color: 'text-red-600',
        bgColor: 'bg-red-50'
      },
      'technology_trend': { 
        label: 'Technology Trend', 
        icon: Brain, 
        color: 'text-purple-600',
        bgColor: 'bg-purple-50'
      },
      'crypto_market': { 
        label: 'Crypto Market', 
        icon: Target, 
        color: 'text-orange-600',
        bgColor: 'bg-orange-50'
      },
      'general': { 
        label: 'General Prediction', 
        icon: Info, 
        color: 'text-gray-600',
        bgColor: 'bg-gray-50'
      }
    };
    return configs[type as keyof typeof configs] || configs['general'];
  };

  const getConfidenceConfig = (confidence?: number) => {
    if (!confidence) return { variant: 'secondary', label: 'Unknown' };
    
    if (confidence >= 0.9) return { variant: 'success', label: 'Very High' };
    if (confidence >= 0.8) return { variant: 'success', label: 'High' };
    if (confidence >= 0.7) return { variant: 'warning', label: 'Good' };
    if (confidence >= 0.6) return { variant: 'warning', label: 'Moderate' };
    if (confidence >= 0.5) return { variant: 'destructive', label: 'Low' };
    return { variant: 'destructive', label: 'Very Low' };
  };

  const timeConfig = getTimeHorizonConfig(prediction.timeHorizon);
  const typeConfig = getPredictionTypeConfig(prediction.predictionType);
  const confidenceConfig = getConfidenceConfig(prediction.confidenceLevel);
  const TimeIcon = timeConfig.icon;
  const TypeIcon = typeConfig.icon;

  return (
    <ModernCard className={cn("overflow-hidden", className)}>
      {/* Header Section */}
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "p-2 rounded-lg",
                typeConfig.bgColor
              )}>
                <TypeIcon className={cn("h-4 w-4", typeConfig.color)} />
              </div>
              <div className="flex items-center gap-2">
                <ModernBadge variant="outline" className="text-xs">
                  {typeConfig.label}
                </ModernBadge>
                <div className="flex items-center gap-1">
                  <div className={cn("w-2 h-2 rounded-full", timeConfig.color)} />
                  <span className="text-xs text-muted-foreground">
                    {timeConfig.label}
                  </span>
                </div>
              </div>
            </div>
            <CardTitle className="text-lg leading-relaxed">
              {prediction.predictionText || 'No prediction text available'}
            </CardTitle>
          </div>
          
          {/* Confidence Badge */}
          {prediction.confidenceLevel && (
            <div className="flex flex-col items-end gap-1">
              <ModernBadge variant={confidenceConfig.variant as any}>
                {formatPercent(prediction.confidenceLevel)}
              </ModernBadge>
              <span className="text-xs text-muted-foreground">
                {confidenceConfig.label} Confidence
              </span>
            </div>
          )}
        </div>
        
        {/* Metadata Row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(prediction.createdAt)}</span>
          </div>
          {prediction.dailyAnalysisId && (
            <div className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              <span className="truncate">Analysis: {prediction.dailyAnalysisId.slice(0, 8)}...</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Assumptions Section */}
        {prediction.predictionData.keyAssumptions && prediction.predictionData.keyAssumptions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h4 className="font-medium text-sm">Key Assumptions</h4>
            </div>
            <div className="space-y-1 ml-6">
              {prediction.predictionData.keyAssumptions.map((assumption, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  <span className="text-muted-foreground">{assumption}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Measurable Outcomes Section */}
        {prediction.predictionData.measurableOutcomes && prediction.predictionData.measurableOutcomes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              <h4 className="font-medium text-sm">Measurable Outcomes</h4>
            </div>
            <div className="space-y-1 ml-6">
              {prediction.predictionData.measurableOutcomes.map((outcome, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{outcome}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Data Section */}
        {Object.keys(prediction.predictionData).filter(key => 
          !['keyAssumptions', 'measurableOutcomes', 'generatedFrom'].includes(key)
        ).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <h4 className="font-medium text-sm">Additional Information</h4>
            </div>
            <div className="ml-6 space-y-2">
              {Object.entries(prediction.predictionData).map(([key, value]) => {
                if (['keyAssumptions', 'measurableOutcomes', 'generatedFrom'].includes(key)) {
                  return null;
                }
                
                return (
                  <div key={key} className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                    </span>
                    <span className="col-span-2 text-muted-foreground">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expandable Section */}
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
                  <span className="font-medium">Prediction ID:</span>
                  <p className="text-muted-foreground font-mono text-xs break-all">
                    {prediction.id}
                  </p>
                </div>
                
                {prediction.dailyAnalysisId && (
                  <div>
                    <span className="font-medium">Analysis ID:</span>
                    <p className="text-muted-foreground font-mono text-xs break-all">
                      {prediction.dailyAnalysisId}
                    </p>
                  </div>
                )}
                
                <div>
                  <span className="font-medium">Time Horizon:</span>
                  <p className="text-muted-foreground">
                    {timeConfig.label} ({timeConfig.urgency})
                  </p>
                </div>
                
                <div>
                  <span className="font-medium">Created:</span>
                  <p className="text-muted-foreground">
                    {new Date(prediction.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {prediction.predictionData.generatedFrom && (
                <div>
                  <span className="font-medium text-sm">Generated From Analysis:</span>
                  <p className="text-muted-foreground text-xs mt-1">
                    {new Date(prediction.predictionData.generatedFrom).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* JSON View */}
          {showJson && (
            <div className="mt-4">
              <h5 className="font-medium text-sm mb-2">Raw JSON Data</h5>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(prediction, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </ModernCard>
  );
};