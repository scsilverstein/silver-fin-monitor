// Analysis page following CLAUDE.md specification
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { format } from 'date-fns';

interface DailyAnalysis {
  id: string;
  analysisDate: string;
  marketSentiment: string;
  keyThemes: string[];
  overallSummary: string;
  confidenceScore: number;
  sourcesAnalyzed: number;
  createdAt: string;
}

const getSentimentColor = (sentiment: string) => {
  switch (sentiment?.toLowerCase()) {
    case 'bullish':
      return 'bg-green-100 text-green-800';
    case 'bearish':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const AnalysisCard: React.FC<{ analysis: DailyAnalysis }> = ({ analysis }) => (
  <Card className="mb-6">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg">
          {format(new Date(analysis.analysisDate), 'MMMM d, yyyy')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className={getSentimentColor(analysis.marketSentiment)}>
            {analysis.marketSentiment}
          </Badge>
          <span className="text-sm text-gray-500">
            {Math.round(analysis.confidenceScore * 100)}% confidence
          </span>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
        <p className="text-gray-600 leading-relaxed">{analysis.overallSummary}</p>
      </div>
      
      <div>
        <h4 className="font-medium text-gray-900 mb-2">Key Themes</h4>
        <div className="flex flex-wrap gap-2">
          {analysis.keyThemes.map((theme, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {theme}
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t">
        <span>Sources analyzed: {analysis.sourcesAnalyzed}</span>
        <span>Generated: {format(new Date(analysis.createdAt), 'MMM d, h:mm a')}</span>
      </div>
    </CardContent>
  </Card>
);

const AnalysisPage: React.FC = () => {
  const { data: analyses, isLoading, error } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => api.get('/analysis').then(res => res.data.data),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Market Analysis</h1>
            <p className="text-gray-600">AI-powered analysis of market sentiment and trends</p>
          </div>
          
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-14" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Market Analysis</h1>
            <p className="text-gray-600">AI-powered analysis of market sentiment and trends</p>
          </div>
          
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-red-600">Failed to load analyses. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Market Analysis</h1>
          <p className="text-gray-600">AI-powered analysis of market sentiment and trends</p>
        </div>
        
        {analyses && analyses.length > 0 ? (
          <div className="space-y-6">
            {analyses.map((analysis: DailyAnalysis) => (
              <AnalysisCard key={analysis.id} analysis={analysis} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No analyses available yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default AnalysisPage;