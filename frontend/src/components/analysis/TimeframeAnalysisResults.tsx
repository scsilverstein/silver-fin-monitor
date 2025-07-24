import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TimeframeAnalysis } from '@/lib/api';

interface TimeframeAnalysisResultsProps {
  analysis: TimeframeAnalysis;
  className?: string;
}

const TimeframeAnalysisResults: React.FC<TimeframeAnalysisResultsProps> = ({
  analysis,
  className = ''
}) => {
  // Get sentiment color and icon
  const getSentimentInfo = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: '📈', label: 'Bullish' };
      case 'bearish':
        return { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: '📉', label: 'Bearish' };
      default:
        return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300', icon: '➡️', label: 'Neutral' };
    }
  };

  // Get trend direction info
  const getTrendInfo = (direction: string) => {
    switch (direction) {
      case 'upward':
        return { icon: '⬆️', label: 'Upward Trend', color: 'text-green-600 dark:text-green-400' };
      case 'downward':
        return { icon: '⬇️', label: 'Downward Trend', color: 'text-red-600 dark:text-red-400' };
      default:
        return { icon: '↔️', label: 'Sideways Movement', color: 'text-gray-600 dark:text-gray-400' };
    }
  };

  const sentimentInfo = getSentimentInfo(analysis.marketSentiment);
  const trendInfo = getTrendInfo(analysis.aiAnalysis.trendAnalysis.direction);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Summary */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Timeframe Analysis Results
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {analysis.timeframe.period === 'custom' 
                ? `Custom period: ${analysis.timeframe.startDate} to ${analysis.timeframe.endDate}`
                : `${analysis.timeframe.period} analysis`
              }
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Confidence Score
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(analysis.confidenceScore * 100)}%
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <Badge className={`${sentimentInfo.color} px-3 py-1`}>
              {sentimentInfo.icon} {sentimentInfo.label}
            </Badge>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Market Sentiment
            </div>
          </div>
          
          <div className="text-center">
            <div className={`text-lg font-semibold ${trendInfo.color}`}>
              {trendInfo.icon} {trendInfo.label}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Trend Direction
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {analysis.sourcesAnalyzed} Sources
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Content Analyzed
            </div>
          </div>
        </div>
      </Card>

      {/* Overall Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Executive Summary
        </h3>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
          {analysis.overallSummary}
        </p>
      </Card>

      {/* Detailed Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Drivers */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            🚀 Market Drivers
          </h3>
          <div className="space-y-2">
            {analysis.aiAnalysis.marketDrivers.map((driver, index) => (
              <div key={index} className="flex items-start">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{driver}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Risk Factors */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            ⚠️ Risk Factors
          </h3>
          <div className="space-y-2">
            {analysis.aiAnalysis.riskFactors.map((risk, index) => (
              <div key={index} className="flex items-start">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{risk}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Opportunities */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            💡 Opportunities
          </h3>
          <div className="space-y-2">
            {analysis.aiAnalysis.opportunities.map((opportunity, index) => (
              <div key={index} className="flex items-start">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{opportunity}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Economic Indicators */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            📊 Economic Indicators
          </h3>
          <div className="space-y-2">
            {analysis.aiAnalysis.economicIndicators.map((indicator, index) => (
              <div key={index} className="flex items-start">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{indicator}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Key Themes */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          🏷️ Key Themes
        </h3>
        <div className="flex flex-wrap gap-2">
          {analysis.keyThemes.map((theme, index) => (
            <Badge key={index} variant="secondary" className="text-sm">
              {theme}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Trend Analysis Details */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📈 Trend Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Direction</div>
            <div className={`text-lg font-semibold ${trendInfo.color}`}>
              {trendInfo.icon} {trendInfo.label}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Strength</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {Math.round(analysis.aiAnalysis.trendAnalysis.strength * 100)}%
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${analysis.aiAnalysis.trendAnalysis.strength * 100}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Volatility</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {Math.round(analysis.aiAnalysis.trendAnalysis.volatility * 100)}%
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all"
                style={{ width: `${analysis.aiAnalysis.trendAnalysis.volatility * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Timeframe-Specific Insights */}
      {analysis.aiAnalysis.timeframeSpecificInsights.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🎯 Timeframe-Specific Insights
          </h3>
          <div className="space-y-3">
            {analysis.aiAnalysis.timeframeSpecificInsights.map((insight, index) => (
              <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">{insight}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Content Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📊 Content Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* By Sentiment */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">By Sentiment</h4>
            <div className="space-y-2">
              {Object.entries(analysis.contentDistribution.bySentiment).map(([sentiment, count]) => (
                <div key={sentiment} className="flex justify-between text-sm">
                  <span className="capitalize text-gray-700 dark:text-gray-300">{sentiment}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Source (top 5) */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Top Sources</h4>
            <div className="space-y-2">
              {Object.entries(analysis.contentDistribution.bySource)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([source, count]) => (
                  <div key={source} className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{source}</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-2">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Total Items</span>
                <span className="font-medium text-gray-900 dark:text-white">{analysis.contentDistribution.totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Date Range</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {Object.keys(analysis.contentDistribution.byDate).length} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Sources</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {Object.keys(analysis.contentDistribution.bySource).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Geopolitical Context */}
      {analysis.aiAnalysis.geopoliticalContext && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🌍 Geopolitical Context
          </h3>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {analysis.aiAnalysis.geopoliticalContext}
          </p>
        </Card>
      )}
    </div>
  );
};

export default TimeframeAnalysisResults; 