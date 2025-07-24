import React, { useState, useEffect, useMemo } from 'react';
import { 
  ModernCard, 
  CardContent, 
  CardHeader, 
  CardTitle
} from '@/components/ui/ModernCard';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search,
  TrendingUp,
  TrendingDown,
  Brain,
  Lightbulb,
  Filter,
  Calendar,
  BarChart3,
  Users,
  Globe,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { contentApi, analysisApi, ProcessedContent, DailyAnalysis } from '@/lib/api';
import { entityTypeConfig, sentimentColors, sentimentIcons } from '@/config/entityTypes';
import { useInsightsData } from '@/hooks/useInsightsData';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';


const timeframeOptions = [
  { value: '1d', label: 'Last 24 Hours' },
  { value: '3d', label: 'Last 3 Days' },
  { value: '7d', label: 'Last Week' },
  { value: '30d', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' }
];

const insightTypeFilters = [
  { value: 'all', label: 'All Insights' },
  { value: 'opportunity', label: 'Opportunities' },
  { value: 'risk', label: 'Risks' },
  { value: 'trend', label: 'Trends' },
  { value: 'anomaly', label: 'Anomalies' }
];

export const ModernInsights: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [selectedInsightType, setSelectedInsightType] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data, loading, error, refreshData, generateInsights } = useInsightsData();

  const handleTimeframeChange = async (newTimeframe: string) => {
    setSelectedTimeframe(newTimeframe);
    await generateInsights(newTimeframe);
  };

  useEffect(() => {
    generateInsights(selectedTimeframe);
  }, [selectedTimeframe, generateInsights]);

  const filteredMarketInsights = useMemo(() => {
    if (!data || selectedInsightType === 'all') return data?.marketInsights || [];
    return data.marketInsights.filter(insight => insight.type === selectedInsightType);
  }, [data, selectedInsightType]);

  const filteredEntities = useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data.entities || [];
    return (data.entities || []).filter(entity => 
      entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entity.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Market Insights</h1>
              <p className="text-muted-foreground">Deep analysis of market trends, entities, and sentiment patterns</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ModernCard key={i} variant="glass">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-6 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                  </div>
                </CardContent>
              </ModernCard>
            ))}
          </div>
        </div>
    );
  }

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              Market Insights
            </h1>
            <p className="text-muted-foreground">
              AI-powered analysis of market trends, entities, and sentiment patterns
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <SelectRoot value={selectedTimeframe} onValueChange={handleTimeframeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                {timeframeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModernCard variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Entities</p>
                    <p className="text-2xl font-bold">{data.entities.length}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </ModernCard>
            
            <ModernCard variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Key Topics</p>
                    <p className="text-2xl font-bold">{data.topics.length}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </ModernCard>
            
            <ModernCard variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Market Insights</p>
                    <p className="text-2xl font-bold">{data.marketInsights.length}</p>
                  </div>
                  <Lightbulb className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </ModernCard>
            
            <ModernCard variant="outline">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="text-sm font-medium">
                      {format(data.lastUpdated, 'MMM dd, HH:mm')}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-gray-500" />
                </div>
              </CardContent>
            </ModernCard>
          </div>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="entities">Entities</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="insights">Market Insights</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sentiment Distribution */}
              <ModernCard variant="glass">
                <CardHeader>
                  <CardTitle>Sentiment Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {data && (
                    <div className="space-y-4">
                      {Object.entries({
                        positive: data.sentimentDistribution.positive,
                        neutral: data.sentimentDistribution.neutral,
                        negative: data.sentimentDistribution.negative
                      }).map(([sentiment, count]) => (
                        <div key={sentiment} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${sentimentColors[sentiment as keyof typeof sentimentColors]}`}>
                              {sentimentIcons[sentiment as keyof typeof sentimentIcons]}
                            </span>
                            <span className="text-sm font-medium capitalize">{sentiment}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{count}</span>
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${sentiment === 'positive' ? 'bg-green-500' : sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-500'}`}
                                style={{ 
                                  width: `${(count / Math.max(data.sentimentDistribution.positive, data.sentimentDistribution.neutral, data.sentimentDistribution.negative)) * 100}%` 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </ModernCard>

              {/* Volume Analysis */}
              <ModernCard variant="glass">
                <CardHeader>
                  <CardTitle>Content Volume & Sentiment</CardTitle>
                </CardHeader>
                <CardContent>
                  {data && (
                    <div className="space-y-2">
                      {data.volumeAnalysis.map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.date}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.volume}</span>
                            <span className="text-xs text-muted-foreground">items</span>
                            <span className={`text-xs ${item.sentiment > 0.1 ? 'text-green-500' : item.sentiment < -0.1 ? 'text-red-500' : 'text-gray-500'}`}>
                              {item.sentiment > 0.1 ? '📈' : item.sentiment < -0.1 ? '📉' : '➖'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </ModernCard>
            </div>
          </TabsContent>

          {/* Entities Tab */}
          <TabsContent value="entities" className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntities?.map((entity, index) => {
                const config = entityTypeConfig[entity.type as keyof typeof entityTypeConfig] || entityTypeConfig.company;
                const Icon = config.icon;
                
                return (
                  <ModernCard key={index} variant="outline" className={config.bgClass}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`h-4 w-4 ${config.iconClass}`} />
                            <span className="text-sm font-medium">{entity.name}</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Mentions</span>
                              <span className="font-medium">{entity.mentions}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Sentiment</span>
                              <span className={`font-medium ${entity.sentiment > 0.1 ? 'text-green-500' : entity.sentiment < -0.1 ? 'text-red-500' : 'text-gray-500'}`}>
                                {entity.sentiment > 0.1 ? '+' : ''}{(entity.sentiment * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Trend</span>
                              <span className="flex items-center gap-1">
                                {entity.trend === 'up' ? (
                                  <TrendingUp className="h-3 w-3 text-green-500" />
                                ) : entity.trend === 'down' ? (
                                  <TrendingDown className="h-3 w-3 text-red-500" />
                                ) : (
                                  <span className="h-3 w-3 text-gray-500">─</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                        <ModernBadge variant={config.badgeVariant} size="sm">
                          {config.label.slice(0, -1)}
                        </ModernBadge>
                      </div>
                    </CardContent>
                  </ModernCard>
                );
              })}
            </div>
          </TabsContent>

          {/* Topics Tab */}
          <TabsContent value="topics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.topics.map((topic, index) => (
                <ModernCard key={index} variant="outline">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">{topic.topic}</h3>
                        <ModernBadge variant="outline" size="sm">
                          {topic.frequency}
                        </ModernBadge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Sentiment</span>
                          <span className={`font-medium ${topic.sentiment > 0.1 ? 'text-green-500' : topic.sentiment < -0.1 ? 'text-red-500' : 'text-gray-500'}`}>
                            {(topic.sentiment * 100).toFixed(1)}%
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Growth</span>
                          <span className={`font-medium ${topic.growth > 0 ? 'text-green-500' : topic.growth < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            {topic.growth > 0 ? '+' : ''}{topic.growth.toFixed(1)}%
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Sources</span>
                          <span className="font-medium">{topic.sources.length}</span>
                        </div>
                      </div>
                      
                      {topic.relatedEntities.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Related Entities</p>
                          <div className="flex flex-wrap gap-1">
                            {topic.relatedEntities.slice(0, 3).map((entity, i) => (
                              <ModernBadge key={i} variant="secondary" size="sm">
                                {entity}
                              </ModernBadge>
                            ))}
                            {topic.relatedEntities.length > 3 && (
                              <ModernBadge variant="outline" size="sm">
                                +{topic.relatedEntities.length - 3}
                              </ModernBadge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </ModernCard>
              ))}
            </div>
          </TabsContent>

          {/* Market Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <div className="flex items-center gap-4">
              <SelectRoot value={selectedInsightType} onValueChange={setSelectedInsightType}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter insights" />
                </SelectTrigger>
                <SelectContent>
                  {insightTypeFilters.map(filter => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </div>

            <div className="space-y-4">
              {filteredMarketInsights.map((insight, index) => {
                const getInsightIcon = () => {
                  switch (insight.type) {
                    case 'opportunity': return <CheckCircle className="h-5 w-5 text-green-500" />;
                    case 'risk': return <AlertTriangle className="h-5 w-5 text-red-500" />;
                    case 'trend': return <TrendingUp className="h-5 w-5 text-blue-500" />;
                    case 'anomaly': return <Brain className="h-5 w-5 text-purple-500" />;
                    default: return <Lightbulb className="h-5 w-5 text-yellow-500" />;
                  }
                };

                const getInsightColor = () => {
                  switch (insight.type) {
                    case 'opportunity': return 'border-green-200 bg-green-50/50';
                    case 'risk': return 'border-red-200 bg-red-50/50';
                    case 'trend': return 'border-blue-200 bg-blue-50/50';
                    case 'anomaly': return 'border-purple-200 bg-purple-50/50';
                    default: return 'border-gray-200 bg-gray-50/50';
                  }
                };

                return (
                  <ModernCard key={index} variant="outline" className={getInsightColor()}>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getInsightIcon()}
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{insight.title}</h3>
                                <ModernBadge 
                                  variant={insight.type === 'opportunity' ? 'success' : insight.type === 'risk' ? 'destructive' : 'secondary'}
                                  size="sm"
                                >
                                  {insight.type}
                                </ModernBadge>
                              </div>
                              <p className="text-sm text-muted-foreground">{insight.description}</p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">Confidence</span>
                              <span className="text-sm font-medium">{(insight.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Impact</span>
                              <ModernBadge 
                                variant={insight.impact === 'high' ? 'destructive' : insight.impact === 'medium' ? 'warning' : 'secondary'}
                                size="sm"
                              >
                                {insight.impact}
                              </ModernBadge>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Timeframe: {insight.timeframe}</span>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Supporting Data:</p>
                            <ul className="text-xs text-muted-foreground space-y-0.5">
                              {insight.supportingData.map((data, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-primary">•</span>
                                  <span>{data}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </ModernCard>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
  );
};