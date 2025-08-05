// Analysis detail component following CLAUDE.md specification
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { PredictionsDisplay } from './PredictionsDisplay';
import { parseAnalysisDate } from '../../lib/utils';
import { 
  AlertCircle, 
  ArrowLeft,
  Calendar,
  TrendingUp,
  Target,
  BarChart3,
  FileText,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';

export const AnalysisDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentAnalysis, loading, error, fetchAnalysisById } = useAnalysisStore();

  useEffect(() => {
    if (id) {
      fetchAnalysisById(id);
    }
  }, [id, fetchAnalysisById]);

  if (loading && !currentAnalysis) {
    return <AnalysisDetailSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!currentAnalysis) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Analysis not found</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => navigate('/analysis')}
        >
          Back to Analysis
        </Button>
      </div>
    );
  }

  const getSentimentBadge = (sentiment: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      bullish: 'default',
      neutral: 'secondary',
      bearish: 'destructive'
    };

    const icons = {
      bullish: <TrendingUp className="h-3 w-3" />,
      bearish: <TrendingUp className="h-3 w-3 rotate-180" />,
      neutral: <BarChart3 className="h-3 w-3" />
    };

    return (
      <Badge variant={variants[sentiment] || 'secondary'} className="flex items-center gap-1">
        {icons[sentiment]}
        {sentiment}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/analysis')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Analysis Details</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" />
              {(() => {
                const date = parseAnalysisDate(currentAnalysis);
                return date ? format(date, 'MMMM d, yyyy') : 'Invalid Date';
              })()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {getSentimentBadge(currentAnalysis.market_sentiment)}
          <Badge variant="outline">
            {(currentAnalysis.confidence_score * 100).toFixed(0)}% confidence
          </Badge>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sources Analyzed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentAnalysis.sources_analyzed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Key Themes</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentAnalysis.key_themes?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Insights</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(currentAnalysis.ai_analysis || {}).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Summary</CardTitle>
          <CardDescription>AI-generated synthesis of market conditions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{currentAnalysis.overall_summary}</p>
        </CardContent>
      </Card>

      {/* Key Themes */}
      {currentAnalysis.key_themes && currentAnalysis.key_themes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Market Themes</CardTitle>
            <CardDescription>Major topics and trends identified</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentAnalysis.key_themes.map((theme, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm font-medium">{theme}</span>
                  <Badge variant="secondary">Theme {index + 1}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Details */}
      {currentAnalysis.ai_analysis && Object.keys(currentAnalysis.ai_analysis).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed AI Analysis</CardTitle>
            <CardDescription>In-depth insights from the analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(currentAnalysis.ai_analysis).map(([key, value]) => (
                <div key={key}>
                  <h4 className="font-medium text-sm capitalize mb-2">
                    {key.replace(/_/g, ' ')}
                  </h4>
                  <div className="p-3 rounded-md bg-muted">
                    {typeof value === 'string' ? (
                      <p className="text-sm">{value}</p>
                    ) : Array.isArray(value) ? (
                      <ul className="space-y-1">
                        {value.map((item, i) => (
                          <li key={i} className="text-sm">• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Predictions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Related Predictions</h2>
        <PredictionsDisplay analysisId={currentAnalysis.id} showAccuracy={false} />
      </div>
    </div>
  );
};

// Loading skeleton
const AnalysisDetailSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton className="h-10 w-10" />
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    
    <div className="grid gap-4 md:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-32 mb-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
    
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  </div>
);