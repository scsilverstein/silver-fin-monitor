import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  PageContainer, 
  PageHeader, 
  LoadingState, 
  EmptyState
} from '@/components/layout';
import { RefreshCw, Eye, EyeOff, Calendar, TrendingUp, Download, FileText } from 'lucide-react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { AnalysisOverlayToggle } from '@/components/analysis/AnalysisOverlayToggle';
import { SummaryOverlay } from '@/components/analysis/SummaryOverlay';
import { OverlayLineChart } from '@/components/charts/OverlayLineChart';
import { api, analysisApi } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { ModernButton } from '@/components/ui/ModernButton';
import { Badge } from '@/components/ui/Badge';

interface AnalysisData {
  id: string;
  analysis_date: string;
  market_sentiment: string;
  key_themes: string[];
  overall_summary: string;
  sources_analyzed: number;
  confidence_score: number;
  ai_analysis?: any;
  created_at?: string;
  predictions?: Array<{
    id: string;
    prediction_text: string;
    confidence_level: number;
    time_horizon: string;
  }>;
}

interface TimeSeriesData {
  date: string;
  sentiment: number;
  confidence: number;
  volatility?: number;
  sources?: number;
}

export const AnalysisOverlay: React.FC = () => {
  const [showTimeReferences, setShowTimeReferences] = useState(true);
  const [showMarketMovements, setShowMarketMovements] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisData | null>(null);

  // Fetch analysis data
  const { data: analysisData = [], isLoading, error, refetch } = useQuery({
    queryKey: ['analysis-overlay', selectedTimeframe],
    queryFn: async () => {
      try {
      // Calculate date range based on selected timeframe
      const endDate = new Date();
      const startDate = new Date();
      
      switch (selectedTimeframe) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      const response = await api.get('/analysis', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          limit: 100
        }
      });
      
      // Handle the response structure { success: true, data: [...] }
      const data = response.data?.data || response.data || [];
      console.log('API Response:', response.data);
      console.log('Extracted data:', data);
      
      // Ensure we always return an array
      return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching analysis data:', error);
        return [];
      }
    }
  });


  // Transform data for chart
  const chartData = useMemo<TimeSeriesData[]>(() => {
    if (!analysisData || !Array.isArray(analysisData) || analysisData.length === 0) return [];

    return analysisData.map((analysis: AnalysisData) => ({
      date: analysis.analysis_date,
      sentiment: analysis.market_sentiment === 'bullish' ? 1 : 
                 analysis.market_sentiment === 'bearish' ? -1 : 0,
      confidence: analysis.confidence_score || 0,
      volatility: Math.random() * 0.5, // TODO: Calculate from actual data
      sources: analysis.sources_analyzed || 0
    }));
  }, [analysisData]);

  const handleExport = () => {
    if (!analysisData || !Array.isArray(analysisData)) return;

    const exportData = analysisData.map((item: AnalysisData) => ({
      date: item.analysis_date,
      sentiment: item.market_sentiment,
      confidence: item.confidence_score,
      summary: item.overall_summary.replace(/\n/g, ' '),
      themes: item.key_themes.join(', ')
    }));

    const csv = [
      ['Date', 'Sentiment', 'Confidence', 'Summary', 'Key Themes'],
      ...exportData.map((row: any) => [
        row.date,
        row.sentiment,
        row.confidence,
        row.summary,
        row.themes
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-overlay-${selectedTimeframe}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const actions = [
    {
      label: 'Refresh',
      icon: <RefreshCw className="h-4 w-4" />,
      onClick: () => refetch(),
      variant: 'outline' as const
    },
    {
      label: 'Export',
      icon: <Download className="h-4 w-4" />,
      onClick: handleExport,
      variant: 'outline' as const
    }
  ];

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader
          title="Analysis Overlay"
          subtitle="Market analysis with interactive overlays and trends"
          primaryActions={actions}
        />
        <LoadingState message="Loading analysis data..." />
      </PageContainer>
    );
  }

  if (error || !analysisData) {
    return (
      <PageContainer>
        <PageHeader
          title="Analysis Overlay"
          subtitle="Market analysis with interactive overlays and trends"
          primaryActions={actions}
        />
        <EmptyState
          icon={<FileText className="w-12 h-12 text-muted-foreground" />}
          title="No Analysis Data Found"
          description="Generate some analyses to see overlay visualizations"
          actions={[{
            label: 'Generate Analysis',
            onClick: () => window.location.href = '/analysis'
          }]}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Analysis Overlay"
        subtitle="Market analysis with interactive overlays and trends"
        actions={actions}
      />

      {/* Controls Section */}
      <ModernCard className="mb-6">
        <CardHeader>
          <CardTitle>Display Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalysisOverlayToggle
            showTimeReferences={showTimeReferences}
            showMarketMovements={showMarketMovements}
            onToggleTimeReferences={() => setShowTimeReferences(!showTimeReferences)}
            onToggleMarketMovements={() => setShowMarketMovements(!showMarketMovements)}
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
          />
        </CardContent>
      </ModernCard>

      {/* Chart Section */}
      <ModernCard className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Market Sentiment Timeline
            <Badge variant="outline">
              {chartData.length} data points
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OverlayLineChart
            data={chartData}
            height={400}
            showTimeReferences={showTimeReferences}
            showMarketMovements={showMarketMovements}
            onDataPointClick={(data) => {
              if (analysisData && Array.isArray(analysisData)) {
                const analysis = analysisData.find(
                  (a: AnalysisData) => a.analysis_date === data.date
                );
                if (analysis) {
                  setSelectedAnalysis(analysis);
                }
              }
            }}
          />
        </CardContent>
      </ModernCard>

      {/* Summary Overlays Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysisData && Array.isArray(analysisData) && analysisData.slice(0, 6).map((analysis: AnalysisData) => (
          <SummaryOverlay
            key={analysis.id}
            analysis={analysis}
            showTimeReferences={showTimeReferences}
            showMarketMovements={showMarketMovements}
            isSelected={selectedAnalysis?.id === analysis.id}
            onClick={() => setSelectedAnalysis(analysis)}
          />
        ))}
      </div>

      {/* Selected Analysis Detail */}
      {selectedAnalysis && (
        <ModernCard className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Analysis Detail - {format(parseISO(selectedAnalysis.analysis_date), 'MMM dd, yyyy')}</span>
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAnalysis(null)}
              >
                <EyeOff className="w-4 h-4" />
              </ModernButton>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Market Sentiment</h4>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={
                      selectedAnalysis.market_sentiment === 'bullish' ? 'success' :
                      selectedAnalysis.market_sentiment === 'bearish' ? 'destructive' :
                      'secondary'
                    }
                  >
                    {selectedAnalysis.market_sentiment}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Confidence: {(selectedAnalysis.confidence_score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Key Themes</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedAnalysis.key_themes.map((theme, index) => (
                    <Badge key={index} variant="outline">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedAnalysis.overall_summary}
                </p>
              </div>

              {selectedAnalysis.predictions && selectedAnalysis.predictions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Related Predictions</h4>
                  <div className="space-y-2">
                    {selectedAnalysis.predictions.slice(0, 3).map((prediction) => (
                      <div key={prediction.id} className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm">{prediction.prediction_text}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{prediction.time_horizon}</span>
                          <span>•</span>
                          <span>Confidence: {(prediction.confidence_level * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </ModernCard>
      )}
    </PageContainer>
  );
};