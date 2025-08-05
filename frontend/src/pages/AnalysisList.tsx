import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAnalysisStore } from '@/store/analysis.store';
import { formatDate } from '@/lib/utils';
import { 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar,
  Brain,
  BarChart3,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

export const AnalysisList: React.FC = () => {
  const navigate = useNavigate();
  const { 
    analyses, 
    loading, 
    error, 
    fetchAnalyses, 
    generateAnalysis 
  } = useAnalysisStore();
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const handleGenerateAnalysis = async () => {
    setGenerating(true);
    try {
      await generateAnalysis();
      await fetchAnalyses(); // Refresh list
    } finally {
      setGenerating(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'bearish':
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'bullish':
      case 'positive':
        return 'default';
      case 'bearish':
      case 'negative':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading && analyses.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Brain className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Market Analyses</h1>
            <p className="text-muted-foreground">
              AI-powered daily market intelligence and predictions
            </p>
          </div>
        </div>
        <Button onClick={handleGenerateAnalysis} disabled={generating}>
          {generating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Generate Analysis
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {analyses.map((analysis) => (
          <Card 
            key={analysis.id} 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate(`/analysis/${analysis.id}`)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(analysis.analysisDate)}</span>
                  </div>
                </CardTitle>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardDescription className="flex items-center space-x-4 mt-2">
                <div className="flex items-center space-x-1">
                  {getSentimentIcon(analysis.marketSentiment)}
                  <Badge variant={getSentimentColor(analysis.marketSentiment) as any}>
                    {analysis.marketSentiment}
                  </Badge>
                </div>
                <div className="flex items-center space-x-1 text-xs">
                  <BarChart3 className="h-3 w-3" />
                  <span>{(analysis.confidenceScore * 100).toFixed(0)}% confidence</span>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Key Themes</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.keyThemes && Array.isArray(analysis.keyThemes) && analysis.keyThemes.slice(0, 3).map((theme, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {theme}
                      </Badge>
                    ))}
                    {analysis.keyThemes.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{analysis.keyThemes.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {analysis.overallSummary}
                  </p>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {analysis.sourcesAnalyzed} sources analyzed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {analyses.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No analyses yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate your first daily market analysis to get started
            </p>
            <Button onClick={handleGenerateAnalysis}>
              <Brain className="mr-2 h-4 w-4" />
              Generate First Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};