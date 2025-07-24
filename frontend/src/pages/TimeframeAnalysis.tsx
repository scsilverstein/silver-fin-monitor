import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/Card';
import TimeframeSelector from '@/components/analysis/TimeframeSelector';
import TimeframeAnalysisResults from '@/components/analysis/TimeframeAnalysisResults';
import { TimeframeQuery, type TimeframeAnalysis } from '@/lib/api';
import { analysisApi } from '@/lib/api';

const TimeframeAnalysis: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeQuery>({
    period: 'week' // Default to weekly analysis
  });
  const [analysis, setAnalysis] = useState<TimeframeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-analyze when timeframe changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (selectedTimeframe.period && 
          (selectedTimeframe.period !== 'custom' || 
           (selectedTimeframe.startDate && selectedTimeframe.endDate))) {
        handleAnalyze();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [selectedTimeframe]);

  // Handle analysis request
  const handleAnalyze = async () => {
    if (!selectedTimeframe.period) {
      setError('Please select a timeframe');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await analysisApi.getTimeframeAnalysis(selectedTimeframe);
      setAnalysis(result);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      setError(
        error?.response?.data?.error?.message || 
        'Failed to generate analysis. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Timeframe Analysis
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Analyze market trends and patterns across different time periods
          </p>
        </div>

        {/* Timeframe Selector */}
        <TimeframeSelector
          selectedTimeframe={selectedTimeframe}
          onTimeframeChange={setSelectedTimeframe}
        />

        {/* Manual Analyze Button (for custom ranges or re-analysis) */}
        <div className="flex justify-center">
          <Button
            onClick={handleAnalyze}
            disabled={loading || !selectedTimeframe.period}
            className="px-8 py-3"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Analyzing...
              </>
            ) : (
              'Generate Analysis'
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <div className="flex items-center">
              <span className="text-red-600 mr-2">⚠️</span>
              <div>
                <h4 className="font-medium">Analysis Failed</h4>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Card className="p-8">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Generating Analysis...
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Processing content for{' '}
                {selectedTimeframe.period === 'custom' 
                  ? `${selectedTimeframe.startDate} to ${selectedTimeframe.endDate}`
                  : selectedTimeframe.period
                } timeframe
              </p>
              <div className="mt-4 space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <div>🔍 Gathering relevant content...</div>
                <div>🧠 Running AI analysis...</div>
                <div>📊 Calculating trends and patterns...</div>
                <div>✨ Generating insights...</div>
              </div>
            </div>
          </Card>
        )}

        {/* Analysis Results */}
        {analysis && !loading && (
          <div className="space-y-6">
            {/* Success Message */}
            <Alert>
              <div className="flex items-center">
                <span className="text-green-600 mr-2">✅</span>
                <div>
                  <h4 className="font-medium">Analysis Complete</h4>
                  <p className="text-sm mt-1">
                    Successfully analyzed {analysis.sourcesAnalyzed} sources with {Math.round(analysis.confidenceScore * 100)}% confidence
                  </p>
                </div>
              </div>
            </Alert>

            {/* Results Component */}
            <TimeframeAnalysisResults analysis={analysis} />
          </div>
        )}

        {/* Empty State */}
        {!analysis && !loading && !error && (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📈</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Ready to Analyze
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Select a timeframe above and click "Generate Analysis" to get started
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="font-medium mb-1">📅 Today</div>
                <div>Real-time market pulse</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="font-medium mb-1">📊 7 Days</div>
                <div>Short-term trends</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="font-medium mb-1">📈 30 Days</div>
                <div>Monthly patterns</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="font-medium mb-1">🎯 Custom</div>
                <div>Specific events</div>
              </div>
            </div>
          </Card>
        )}

        {/* Tips Section */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            💡 Analysis Tips
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Choosing Timeframes
              </h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• <strong>Today:</strong> For immediate market reactions</li>
                <li>• <strong>7 Days:</strong> Ideal for short-term trading insights</li>
                <li>• <strong>30 Days:</strong> Best for identifying monthly cycles</li>
                <li>• <strong>90 Days:</strong> Great for quarterly trend analysis</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Understanding Results
              </h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• <strong>Confidence Score:</strong> AI's certainty in the analysis</li>
                <li>• <strong>Trend Strength:</strong> How pronounced the trend is</li>
                <li>• <strong>Volatility:</strong> Market stability measure</li>
                <li>• <strong>Content Distribution:</strong> Data quality indicators</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          Analysis powered by AI • Data sourced from multiple feeds • Updated in real-time
        </div>
      </div>
    </div>
  );
};

export default TimeframeAnalysis; 