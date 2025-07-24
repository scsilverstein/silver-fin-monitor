import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Calendar, ChevronDown, ChevronUp, FileText, TrendingUp, AlertTriangle, Building2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

interface TimeframeThemes {
  today: string[];
  week: string[];
  month: string[];
  year: string[];
}

interface EnhancedMarketIntelligenceProps {
  overview: any;
  weekThemes?: string[];
  monthThemes?: string[];
  yearThemes?: string[];
  marketDrivers?: {
    week: string[];
    month: string[];
    year: string[];
  };
  riskFactors?: {
    week: string[];
    month: string[];
    year: string[];
  };
  loading?: boolean;
  onRefresh?: () => void;
}

export const EnhancedMarketIntelligence: React.FC<EnhancedMarketIntelligenceProps> = ({ 
  overview,
  weekThemes = [],
  monthThemes = [],
  yearThemes = [],
  marketDrivers,
  riskFactors,
  loading = false,
  onRefresh
}) => {
  const [expandedSources, setExpandedSources] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week' | 'month' | 'year'>('today');

  const themes: TimeframeThemes = {
    today: overview?.keyThemes || [],
    week: weekThemes || [],
    month: monthThemes || [],
    year: yearThemes || []
  };

  // Don't render if we don't have overview data yet and not loading
  if (!overview && !loading) {
    return null;
  }

  // Show loading state properly
  if (loading || !overview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Market Intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-24 bg-muted rounded-lg"></div>
            <div className="h-16 bg-muted rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }


  const getTimeframeLabel = (timeframe: string) => {
    switch (timeframe) {
      case 'today': return "Today's";
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      default: return timeframe;
    }
  };

  const getThemeColor = (index: number) => {
    // More visually distinct colors for better readability
    const colors = [
      'bg-blue-50 text-blue-700 border-blue-200',
      'bg-emerald-50 text-emerald-700 border-emerald-200',
      'bg-purple-50 text-purple-700 border-purple-200',
      'bg-amber-50 text-amber-700 border-amber-200',
      'bg-rose-50 text-rose-700 border-rose-200'
    ];
    return colors[index % colors.length];
  };

  const getThemeIcon = (theme: string) => {
    // Simple icon mapping based on common themes
    if (theme.toLowerCase().includes('risk')) return <AlertTriangle className="h-3 w-3" />;
    if (theme.toLowerCase().includes('growth')) return <TrendingUp className="h-3 w-3" />;
    if (theme.toLowerCase().includes('acquisition') || theme.toLowerCase().includes('merger')) return <Building2 className="h-3 w-3" />;
    return null;
  };


  const sources = overview?.contributingSources?.sources || [];
  const totalSources = sources.reduce((sum: number, source: any) => sum + (source.count || 0), 0);
  

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      
      <CardHeader className="relative">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              Market Intelligence
              {overview?.marketSentiment && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  overview.marketSentiment === 'bullish' ? 'bg-emerald-100 text-emerald-700' :
                  overview.marketSentiment === 'bearish' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {overview.marketSentiment.charAt(0).toUpperCase() + overview.marketSentiment.slice(1)}
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Comprehensive analysis across multiple timeframes • {overview?.recentContentCount || 0} sources analyzed
            </p>
          </div>
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-6">
        {/* Timeframe Themes */}
        <div>
          <Tabs value={selectedTimeframe} onValueChange={(v) => setSelectedTimeframe(v as any)}>
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="today" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <span className="font-medium">Today</span>
              </TabsTrigger>
              <TabsTrigger value="week" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <span className="font-medium">Week</span>
              </TabsTrigger>
              <TabsTrigger value="month" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <span className="font-medium">Month</span>
              </TabsTrigger>
              <TabsTrigger value="year" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <span className="font-medium">Year</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value={selectedTimeframe} className="mt-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {getTimeframeLabel(selectedTimeframe)} Key Themes
                  {themes[selectedTimeframe].length > 0 && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {themes[selectedTimeframe].length}
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {themes[selectedTimeframe].length > 0 ? (
                    themes[selectedTimeframe].map((theme, index) => (
                      <div 
                        key={index} 
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getThemeColor(index)}`}
                      >
                        {getThemeIcon(theme)}
                        <span>{theme}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No themes available for this timeframe
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Market Drivers & Risk Factors */}
        {(() => {
          // Use timeframe-specific data if available, otherwise fall back to overview data
          const currentMarketDrivers = selectedTimeframe !== 'today' && marketDrivers?.[selectedTimeframe]?.length > 0
            ? marketDrivers[selectedTimeframe]
            : overview?.marketDrivers || [];
          
          const currentRiskFactors = selectedTimeframe !== 'today' && riskFactors?.[selectedTimeframe]?.length > 0
            ? riskFactors[selectedTimeframe]
            : overview?.riskFactors || [];

          // Show section if we have any data
          const hasData = currentMarketDrivers.length > 0 || currentRiskFactors.length > 0;
          
          return hasData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentMarketDrivers.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    Market Drivers
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {currentMarketDrivers.length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {currentMarketDrivers.slice(0, expandedSources ? currentMarketDrivers.length : 3).map((driver: string, index: number) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0" />
                        <p className="text-sm text-foreground/80 leading-relaxed">{driver}</p>
                      </div>
                    ))}
                  </div>
                  {!expandedSources && currentMarketDrivers.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{currentMarketDrivers.length - 3} more
                    </p>
                  )}
                </div>
              )}
              
              {currentRiskFactors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    Risk Factors
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {currentRiskFactors.length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {currentRiskFactors.slice(0, expandedSources ? currentRiskFactors.length : 3).map((risk: string, index: number) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                        <p className="text-sm text-foreground/80 leading-relaxed">{risk}</p>
                      </div>
                    ))}
                  </div>
                  {!expandedSources && currentRiskFactors.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{currentRiskFactors.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm italic">No market analysis available for this timeframe</p>
            </div>
          );
        })()}

        {/* Contributing Sources - Bar Chart */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <button
            onClick={() => setExpandedSources(!expandedSources)}
            className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity"
          >
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 bg-background rounded-lg shadow-sm">
                <Building2 className="h-4 w-4 text-foreground/70" />
              </div>
              Contributing Sources
              <span className="text-xs font-normal text-muted-foreground">({sources.length} active)</span>
            </h3>
            {expandedSources ? 
              <ChevronUp className="h-4 w-4 text-muted-foreground" /> : 
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>
          
          {sources.length > 0 ? (
            <div className={`space-y-2 transition-all duration-300 ${!expandedSources ? 'max-h-[200px] overflow-hidden' : ''}`}>
              {(() => {
                // Sort sources by count (highest to lowest)
                const sortedSources = [...sources].sort((a, b) => (b.count || 0) - (a.count || 0));
                const maxCount = Math.max(...sortedSources.map(s => s.count || 0));
                const displaySources = expandedSources ? sortedSources : sortedSources.slice(0, 6);
                
                return displaySources.map((source: any, index: number) => {
                  const percentage = maxCount > 0 ? (source.count / maxCount) * 100 : 0;
                  
                  // Extended color palette for more visual variety
                  const colorPalette = [
                    'bg-blue-600',          // Deep blue (top source)
                    'bg-emerald-500',       // Green
                    'bg-purple-500',        // Purple
                    'bg-orange-500',        // Orange
                    'bg-pink-500',          // Pink
                    'bg-indigo-500',        // Indigo
                    'bg-cyan-500',          // Cyan
                    'bg-teal-500',          // Teal
                    'bg-rose-500',          // Rose
                    'bg-amber-500',         // Amber
                    'bg-violet-500',        // Violet
                    'bg-lime-500',          // Lime
                    'bg-sky-500',           // Sky
                    'bg-fuchsia-500',       // Fuchsia
                    'bg-red-500'            // Red
                  ];
                  
                  const barColor = colorPalette[index % colorPalette.length];
                  
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground/70 truncate max-w-[160px] font-medium">
                          {source.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-foreground/90 font-semibold min-w-[30px] text-right">
                            {source.count}
                          </span>
                          <span className="text-xs text-muted-foreground min-w-[35px] text-right">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${barColor} transition-all duration-700 ease-out`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
              
              {!expandedSources && sources.length > 6 && (
                <div className="pt-2 border-t border-muted-foreground/20">
                  <p className="text-xs text-muted-foreground text-center">
                    +{sources.length - 6} more sources • Click to expand
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm italic">No contributing sources available</p>
            </div>
          )}
        </div>

        {/* Analysis Metadata */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Last Analysis: {overview?.lastAnalysisDate ? 
              format(new Date(overview.lastAnalysisDate), 'MMM dd, yyyy') : 
              'Not available'
            }</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Content Processed: {overview?.recentContentCount || 0} items</span>
          </div>
        </div>

        {/* Confidence Score */}
        {overview?.confidenceScore && overview.confidenceScore > 0 && (
          <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Analysis Confidence</span>
              <span className="text-lg font-bold text-primary">
                {(overview.confidenceScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 bg-background/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
                style={{ width: `${overview.confidenceScore * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on {overview?.recentContentCount || 0} analyzed items from {sources.length} sources
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};