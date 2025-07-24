import React from 'react';
import { ModernCard, CardContent } from '@/components/ui/ModernCard';
import { TrendingUp, FileText, Shield, Activity } from 'lucide-react';
import { DailyAnalysis } from '@/lib/api';

interface AnalysisStatsProps {
  analyses: DailyAnalysis[];
}

export const AnalysisStats: React.FC<AnalysisStatsProps> = ({ analyses }) => {
  const calculateStats = () => {
    if (!analyses || analyses.length === 0) {
      return {
        totalAnalyses: 0,
        averageConfidence: 0,
        sentimentBreakdown: { bullish: 0, bearish: 0, neutral: 0 },
        recentTrend: 'neutral'
      };
    }

    const totalAnalyses = analyses.length;
    const averageConfidence = analyses.reduce((sum, a) => sum + (a.confidenceScore || 0), 0) / totalAnalyses;
    
    const sentimentBreakdown = analyses.reduce((acc, a) => {
      const sentiment = a.marketSentiment || 'neutral';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate recent trend (last 7 analyses)
    const recentAnalyses = analyses.filter(a => a.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const bullishCount = recentAnalyses.filter(a => a.marketSentiment === 'bullish').length;
    const bearishCount = recentAnalyses.filter(a => a.marketSentiment === 'bearish').length;
    
    let recentTrend = 'neutral';
    if (bullishCount > bearishCount * 1.5) recentTrend = 'bullish';
    else if (bearishCount > bullishCount * 1.5) recentTrend = 'bearish';

    return {
      totalAnalyses,
      averageConfidence,
      sentimentBreakdown,
      recentTrend
    };
  };

  const stats = calculateStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <ModernCard variant="glass">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Analyses</p>
              <p className="text-2xl font-bold">{stats.totalAnalyses}</p>
            </div>
            <FileText className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </ModernCard>

      <ModernCard variant="glass">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Confidence</p>
              <p className="text-2xl font-bold">{(stats.averageConfidence * 100).toFixed(0)}%</p>
            </div>
            <Shield className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </ModernCard>

      <ModernCard variant="glass">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Recent Trend</p>
              <p className={`text-2xl font-bold capitalize ${
                stats.recentTrend === 'bullish' ? 'text-green-600' :
                stats.recentTrend === 'bearish' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {stats.recentTrend}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </ModernCard>

      <ModernCard variant="glass">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sentiment Mix</p>
              <div className="flex gap-2 text-sm mt-1">
                <span className="text-green-600">↑{stats.sentimentBreakdown.bullish || 0}</span>
                <span className="text-gray-600">→{stats.sentimentBreakdown.neutral || 0}</span>
                <span className="text-red-600">↓{stats.sentimentBreakdown.bearish || 0}</span>
              </div>
            </div>
            <Activity className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </ModernCard>
    </div>
  );
};