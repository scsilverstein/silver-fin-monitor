// Entity Analytics Dashboard - Main page for entity trending and sentiment analysis
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  PageContainer, 
  PageHeader, 
  StatsGrid, 
  LoadingState, 
  EmptyState,
  createStatItems,
  createPageActions 
} from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EntityAnalyticsCharts } from '../components/charts/EntityAnalyticsCharts';
import { EntityMentionSources } from '../components/entity-analytics/EntityMentionSources';
import { EntityAnalyticsSkeleton, EntityDetailSkeleton, EntityComparisonSkeleton } from '../components/entity-analytics/EntityAnalyticsSkeleton';
import { 
  EntityFilter, 
  EntityDashboardData, 
  EntityAnalytics,
  TrendChartData,
  SentimentChartData
} from '../types/entityAnalytics';
import { entityAnalyticsService } from '../services/entityAnalytics';
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Eye, 
  Users, 
  BarChart3,
  LineChart,
  PieChart,
  Plus,
  X,
  RefreshCw
} from 'lucide-react';

export const EntityAnalyticsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [dashboardData, setDashboardData] = useState<EntityDashboardData | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityAnalytics | null>(null);
  const [selectedEntityTrends, setSelectedEntityTrends] = useState<TrendChartData[]>([]);
  const [selectedEntitySentiment, setSelectedEntitySentiment] = useState<SentimentChartData[]>([]);
  const [comparisonEntities, setComparisonEntities] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [filter, setFilter] = useState<EntityFilter>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'dashboard' | 'entity' | 'comparison'>('dashboard');

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Handle URL parameters
  useEffect(() => {
    const entity = searchParams.get('entity');
    const compare = searchParams.get('compare');
    
    if (entity) {
      setViewMode('entity');
      loadEntityData(entity);
    } else if (compare) {
      setViewMode('comparison');
      setComparisonEntities(compare.split(','));
    } else {
      setViewMode('dashboard');
    }
  }, [searchParams]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await entityAnalyticsService.getDashboardData();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadEntityData = async (entityName: string) => {
    try {
      setLoading(true);
      
      // Load entity analytics
      const analytics = await entityAnalyticsService.getEntityAnalytics(entityName);
      setSelectedEntity(analytics);
      
      // Transform data for charts - use historicalMentions from API response
      const historicalData = analytics.historicalMentions || [];
      const trendData = entityAnalyticsService.transformToTrendChartData(
        historicalData.map(h => ({
          entityName,
          entityType: analytics.entityType,
          date: h.date,
          mentionCount: h.mentionCount,
          averageSentiment: h.sentiment,
          sentimentStdDev: 0,
          trendScore: 0,
          sources: [],
          topContexts: []
        }))
      );
      
      const sentimentData = entityAnalyticsService.transformToSentimentChartData(
        historicalData.map(h => ({
          entityName,
          entityType: analytics.entityType,
          date: h.date,
          mentionCount: h.mentionCount,
          averageSentiment: h.sentiment,
          sentimentStdDev: 0,
          trendScore: 0,
          sources: [],
          topContexts: []
        }))
      );
      
      setSelectedEntityTrends(trendData);
      setSelectedEntitySentiment(sentimentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entity data');
    } finally {
      setLoading(false);
    }
  };

  const handleEntitySearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const results = await entityAnalyticsService.searchEntities(query, 10);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }, []);

  const handleEntitySelect = (entityName: string) => {
    setSearchParams({ entity: entityName });
  };

  const handleAddToComparison = (entityName: string) => {
    if (!comparisonEntities.includes(entityName) && comparisonEntities.length < 5) {
      const newEntities = [...comparisonEntities, entityName];
      setComparisonEntities(newEntities);
      setSearchParams({ compare: newEntities.join(',') });
    }
  };

  const handleRemoveFromComparison = (entityName: string) => {
    const newEntities = comparisonEntities.filter(e => e !== entityName);
    setComparisonEntities(newEntities);
    if (newEntities.length > 0) {
      setSearchParams({ compare: newEntities.join(',') });
    } else {
      setSearchParams({});
      setViewMode('dashboard');
    }
  };

  const resetFilters = () => {
    setFilter({});
  };

  // Create stats for the entity analytics page
  const entityStats = [
    createStatItems.count('total_entities', 'Total Entities', dashboardData?.totalEntitiesTracked || 0, {
      icon: <Users className="h-4 w-4" />,
      status: 'success'
    }),
    createStatItems.count('mentions_today', 'Mentions Today', dashboardData?.totalMentionsToday || 0, {
      icon: <Activity className="h-4 w-4" />,
      status: 'info'
    }),
    createStatItems.percentage('avg_sentiment', 'Avg Sentiment', 
      dashboardData?.averageSentimentToday ? Math.round(dashboardData.averageSentimentToday * 100) : 0
    ),
    createStatItems.count('trending', 'Trending Entities', dashboardData?.topTrending?.length || 0, {
      icon: <TrendingUp className="h-4 w-4" />,
      status: 'default'
    })
  ];

  if (loading) {
    if (viewMode === 'entity' && selectedEntity) {
      return (
        <PageContainer showBreadcrumbs>
          <PageHeader
            title="Entity Analytics"
            subtitle="Track sentiment and trending for companies, people, and topics"
            showSkeleton
          />
          <EntityDetailSkeleton />
        </PageContainer>
      );
    } else if (viewMode === 'comparison') {
      return (
        <PageContainer showBreadcrumbs>
          <PageHeader
            title="Entity Analytics"
            subtitle="Track sentiment and trending for companies, people, and topics"
            showSkeleton
          />
          <EntityComparisonSkeleton />
        </PageContainer>
      );
    }
    return <EntityAnalyticsSkeleton />;
  }

  if (error) {
    return (
      <PageContainer showBreadcrumbs>
        <EmptyState
          icon={<Activity className="h-12 w-12 text-muted-foreground" />}
          title="Error loading entity analytics"
          description={error}
          actions={[{
            label: 'Try Again',
            onClick: loadDashboardData,
            icon: <RefreshCw className="h-4 w-4" />
          }]}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer showBreadcrumbs>
      <PageHeader
        title="Entity Analytics"
        subtitle="Track sentiment and trending for companies, people, and topics"
        badges={[
          { label: `${dashboardData?.totalEntitiesTracked || 0} Entities`, variant: 'outline' },
          { 
            label: viewMode === 'dashboard' ? 'Dashboard' : viewMode === 'entity' ? 'Entity View' : 'Comparison',
            variant: 'info'
          }
        ]}
        showSearch={true}
        searchQuery={searchQuery}
        searchPlaceholder="Search entities..."
        onSearchChange={(value) => {
          setSearchQuery(value);
          handleEntitySearch(value);
        }}
        onRefresh={loadDashboardData}
        refreshing={loading}
        primaryActions={[
          {
            label: viewMode === 'dashboard' ? 'Dashboard' : 'Dashboard',
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: () => {
              setViewMode('dashboard');
              setSearchParams({});
            },
            variant: viewMode === 'dashboard' ? 'default' : 'outline'
          }
        ]}
        secondaryActions={[
          createPageActions.refresh(loadDashboardData, loading)
        ]}
      />

      <div className="animate-in slide-in-up" style={{ animationDelay: '100ms' }}>
        <StatsGrid stats={entityStats} columns={4} loading={loading} />
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <Card className="animate-in slide-in-down" style={{ animationDelay: '50ms' }}>
          <CardContent className="p-4">
            <div className="space-y-2 stagger-in">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="p-3 hover:bg-gray-50 cursor-pointer border rounded-md flex items-center justify-between animate-in slide-in-up hover-scale"
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => {
                    handleEntitySelect(result.entityName);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {result.entityType}
                    </Badge>
                    <span className="font-medium">{result.entityName}</span>
                    <span className="text-sm text-gray-500">
                      {result.mentionCount} mentions
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {entityAnalyticsService.formatSentiment(result.recentSentiment).icon}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToComparison(result.entityName);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard View */}
      {viewMode === 'dashboard' && dashboardData && (
        <>

          {/* Top Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trending Entities */}
            <Card className="animate-in slide-in-up" style={{ animationDelay: '200ms' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Top Trending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 stagger-in">
                  {dashboardData.topTrending.slice(0, 8).map((entity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer animate-in slide-in-right hover-lift"
                         style={{ animationDelay: `${250 + index * 30}ms` }}
                         onClick={() => handleEntitySelect(entity.entityName)}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{entity.entityName}</p>
                          <p className="text-sm text-gray-500">{entity.entityType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{entity.trendingScore}</p>
                        <p className="text-xs text-gray-500">{entity.totalMentions} mentions</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sentiment Leaders */}
            <Card className="animate-in slide-in-up" style={{ animationDelay: '250ms' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  Sentiment Leaders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 stagger-in">
                  {dashboardData.sentimentLeaders.slice(0, 8).map((entity, index) => {
                    const sentimentFormatted = entityAnalyticsService.formatSentiment(entity.overallSentiment);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer animate-in slide-in-right hover-lift"
                           style={{ animationDelay: `${300 + index * 30}ms` }}
                           onClick={() => handleEntitySelect(entity.entityName)}>
                        <div className="flex items-center gap-3">
                          <div className="text-lg">{sentimentFormatted.icon}</div>
                          <div>
                            <p className="font-medium">{entity.entityName}</p>
                            <p className="text-sm text-gray-500">{entity.entityType}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" style={{ color: sentimentFormatted.color }}>
                            {Math.round(entity.overallSentiment * 100)}%
                          </p>
                          <p className="text-xs text-gray-500">{entity.totalMentions} mentions</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Entity Detail View */}
      {viewMode === 'entity' && selectedEntity && (
        <div className="space-y-6 animate-in slide-in-up">
          {/* Entity Header */}
          <Card className="animate-in scale-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedEntity.entityName}</h2>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge>{selectedEntity.entityType}</Badge>
                      <span className="text-sm text-gray-500">
                        {selectedEntity.totalMentions} total mentions
                      </span>
                      <span className="text-sm text-gray-500">
                        Trending Score: {selectedEntity.trendingScore}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold mb-1"
                       style={{ color: entityAnalyticsService.getEntityColor(selectedEntity.overallSentiment) }}>
                    {Math.round(selectedEntity.overallSentiment * 100)}%
                  </div>
                  <div className="text-sm text-gray-500">
                    {entityAnalyticsService.formatSentiment(selectedEntity.overallSentiment).text}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts and Content Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Charts */}
            <div className="space-y-6">
              <div className="animate-in slide-in-left" style={{ animationDelay: '100ms' }}>
                <EntityAnalyticsCharts
                entities={[{
                  entityName: selectedEntity.entityName,
                  entityType: selectedEntity.entityType as any,
                  mentionCount: selectedEntity.totalMentions,
                  sentiment: selectedEntity.overallSentiment,
                  trendingScore: selectedEntity.trendingScore,
                  sources: [],
                  dates: []
                }]}
                trendData={(selectedEntity.historicalMentions || []).map(h => ({
                  date: h.date,
                  [selectedEntity.entityName]: h.mentionCount
                }))}
                title="Entity Mention Trends"
                subtitle={`Historical mention data for ${selectedEntity.entityName}`}
                height={350}
                chartType="mentions"
                selectedEntities={[selectedEntity.entityName]}
                timeframe="30d"
                />
              </div>
              
              <div className="animate-in slide-in-left" style={{ animationDelay: '150ms' }}>
                <EntityAnalyticsCharts
                entities={[{
                  entityName: selectedEntity.entityName,
                  entityType: selectedEntity.entityType as any,
                  mentionCount: selectedEntity.totalMentions,
                  sentiment: selectedEntity.overallSentiment,
                  trendingScore: selectedEntity.trendingScore,
                  sources: [],
                  dates: []
                }]}
                title="Entity Sentiment Analysis"
                subtitle={`Sentiment breakdown for ${selectedEntity.entityName}`}
                height={300}
                chartType="sentiment"
                entityTypes={[selectedEntity.entityType as any]}
                timeframe="30d"
                />
              </div>
            </div>

            {/* Right Column - Content Sources */}
            <div className="animate-in slide-in-right" style={{ animationDelay: '200ms' }}>
              <EntityMentionSources
                entityName={selectedEntity.entityName}
                onMentionClick={(mentionId) => {
                  // Handle mention click - could open detailed view
                  console.log('Clicked mention:', mentionId);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Comparison View */}
      {viewMode === 'comparison' && (
        <div className="space-y-6">
          {/* Comparison Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium">Comparing:</span>
                {comparisonEntities.map((entity) => (
                  <Badge key={entity} variant="secondary" className="flex items-center gap-2">
                    {entity}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-red-500"
                      onClick={() => handleRemoveFromComparison(entity)}
                    />
                  </Badge>
                ))}
                {comparisonEntities.length < 5 && (
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entity
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Comparison Charts */}
          {comparisonEntities.length > 0 && (
            <div className="space-y-6">
              <EntityAnalyticsCharts
                comparisonData={comparisonEntities.map(entity => ({
                  entityName: entity,
                  mentionCount: Math.floor(Math.random() * 500) + 100,
                  sentiment: Math.random() * 2 - 1,
                  trendingScore: Math.random(),
                  recentGrowth: Math.random() * 0.4 - 0.2,
                  sourceCount: Math.floor(Math.random() * 10) + 3
                }))}
                title="Entity Comparison Analysis"
                subtitle="Comparative analysis across selected entities"
                height={400}
                chartType="comparison"
                selectedEntities={comparisonEntities}
                timeframe="30d"
              />
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
};