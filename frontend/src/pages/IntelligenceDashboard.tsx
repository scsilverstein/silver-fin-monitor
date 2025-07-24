import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SignalDivergenceRadar,
  EntityNetworkGraph,
  AnomalyHeatmapCalendar,
  NarrativeMomentumTracker,
  SilenceDetectionAlerts,
  LanguageComplexityAnalyzer
} from '@/components/charts';
import { 
  Brain,
  Network,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Activity,
  RefreshCw,
  Bell,
  Eye
} from 'lucide-react';
import { intelligenceApi } from '@/lib/intelligence-api';
import { format } from 'date-fns';

const IntelligenceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  
  // Data states
  const [divergenceData, setDivergenceData] = useState<any>(null);
  const [networkData, setNetworkData] = useState<any>(null);
  const [anomalyData, setAnomalyData] = useState<any[]>([]);
  const [narrativeMomentumData, setNarrativeMomentumData] = useState<any>(null);
  const [silenceDetectionData, setSilenceDetectionData] = useState<any>(null);
  const [languageComplexityData, setLanguageComplexityData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Load all intelligence data
  const loadIntelligenceData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Map timeframe for narrative momentum (which uses different format)
      const narrativeTimeframe = selectedTimeframe === '1d' ? '24h' : 
                                selectedTimeframe === '7d' ? '7d' : 
                                selectedTimeframe === '30d' ? '30d' : '7d';

      // Map timeframe for silence detection (uses days)
      const silenceLookbackDays = selectedTimeframe === '1d' ? 7 : 
                                 selectedTimeframe === '7d' ? 30 : 
                                 selectedTimeframe === '30d' ? 60 : 
                                 selectedTimeframe === '90d' ? 90 : 30;

      const [divergence, network, anomalies, narrativeMomentum, silenceDetection, languageComplexity, alertsData] = await Promise.all([
        intelligenceApi.getSignalDivergence(selectedTimeframe),
        intelligenceApi.getEntityNetwork(selectedTimeframe, 5),
        intelligenceApi.getAnomalyCalendar(
          selectedMonth instanceof Date && !isNaN(selectedMonth.getTime()) 
            ? format(selectedMonth, 'yyyy-MM')
            : format(new Date(), 'yyyy-MM')
        ),
        intelligenceApi.getNarrativeMomentum(narrativeTimeframe as '24h' | '7d' | '30d'),
        intelligenceApi.getSilenceDetection(silenceLookbackDays),
        intelligenceApi.getLanguageComplexity(narrativeTimeframe as '24h' | '7d' | '30d'),
        intelligenceApi.getAlerts('all')
      ]);

      setDivergenceData(divergence);
      setNetworkData(network);
      setAnomalyData(anomalies);
      setNarrativeMomentumData(narrativeMomentum);
      setSilenceDetectionData(silenceDetection);
      setLanguageComplexityData(languageComplexity);
      setAlerts(alertsData?.alerts || []);
    } catch (err) {
      console.error('Failed to load intelligence data:', err);
      setError('Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntelligenceData();
  }, [selectedTimeframe, selectedMonth]);

  // Auto-refresh alerts every minute
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const alertsData = await intelligenceApi.getAlerts('all');
        setAlerts(alertsData?.alerts || []);
      } catch (err) {
        console.error('Failed to refresh alerts:', err);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleNodeClick = (node: any) => {
    console.log('Node clicked:', node);
    // Could navigate to entity details or show modal
  };

  const handleDateClick = (date: string, data: any) => {
    console.log('Date clicked:', date, data);
    // Could show detailed anomaly breakdown
  };

  // Alert severity colors
  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  return (
    <PageContainer
      title="Intelligence Dashboard"
      description="Advanced market intelligence and pattern detection"
    >
      {/* Alerts Section */}
      {alerts && Array.isArray(alerts) && alerts?.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Active Alerts
            </h3>
            <Badge variant="secondary">{alerts?.length}</Badge>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map(alert => (
              <Card key={alert.id} className="border-l-4" style={{ 
                borderLeftColor: alert.severity === 'high' ? '#ef4444' : 
                                alert.severity === 'medium' ? '#f59e0b' : '#6b7280' 
              }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className={`w-4 h-4 ${
                          alert.severity === 'high' ? 'text-red-500' : 
                          alert.severity === 'medium' ? 'text-yellow-500' : 'text-gray-500'
                        }`} />
                        <h4 className="font-semibold">{alert.title}</h4>
                        <Badge variant={getAlertColor(alert.severity) as any}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        try {
                          if (!alert.timestamp) return '';
                          const date = new Date(alert.timestamp);
                          if (isNaN(date.getTime())) return '';
                          return format(date, 'HH:mm');
                        } catch (e) {
                          console.warn('Error formatting alert timestamp:', e);
                          return '';
                        }
                      })()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Timeframe Selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant={selectedTimeframe === '1d' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeframe('1d')}
          >
            1D
          </Button>
          <Button
            variant={selectedTimeframe === '7d' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeframe('7d')}
          >
            7D
          </Button>
          <Button
            variant={selectedTimeframe === '30d' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeframe('30d')}
          >
            30D
          </Button>
          <Button
            variant={selectedTimeframe === '90d' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeframe('90d')}
          >
            90D
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadIntelligenceData}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">
            <Eye className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="silence">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Silence
          </TabsTrigger>
          <TabsTrigger value="narratives">
            <TrendingUp className="w-4 h-4 mr-2" />
            Narratives
          </TabsTrigger>
          <TabsTrigger value="language">
            <Brain className="w-4 h-4 mr-2" />
            Language
          </TabsTrigger>
          <TabsTrigger value="divergence">
            <Activity className="w-4 h-4 mr-2" />
            Divergence
          </TabsTrigger>
          <TabsTrigger value="network">
            <Network className="w-4 h-4 mr-2" />
            Network
          </TabsTrigger>
          <TabsTrigger value="anomalies">
            <Calendar className="w-4 h-4 mr-2" />
            Anomalies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Signal Divergence Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Current Signal Divergence</CardTitle>
              </CardHeader>
              <CardContent>
                <SignalDivergenceRadar
                  data={divergenceData?.current}
                  historicalDivergences={divergenceData?.historical || []}
                  height={300}
                  loading={loading}
                  error={error}
                  onRefresh={loadIntelligenceData}
                />
              </CardContent>
            </Card>

            {/* Network Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Entity Network Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{networkData?.stats?.totalNodes || 0}</p>
                    <p className="text-sm text-muted-foreground">Entities</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{networkData?.stats?.totalEdges || 0}</p>
                    <p className="text-sm text-muted-foreground">Connections</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {networkData?.stats?.avgConnections?.toFixed(1) || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg Links</p>
                  </div>
                </div>
                <div className="h-[200px]">
                  <EntityNetworkGraph
                    nodes={networkData?.nodes?.slice(0, 20) || []}
                    edges={networkData?.edges?.filter((e: any) => 
                      networkData?.nodes?.slice(0, 20).some((n: any) => n.id === e.source) &&
                      networkData?.nodes?.slice(0, 20).some((n: any) => n.id === e.target)
                    ) || []}
                    height={200}
                    loading={loading}
                    error={error}
                    onRefresh={loadIntelligenceData}
                    onNodeClick={handleNodeClick}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Narrative Momentum Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Narrative Momentum Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{narrativeMomentumData?.stats?.totalNarratives || 0}</p>
                    <p className="text-sm text-muted-foreground">Active Narratives</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{narrativeMomentumData?.stats?.explosiveNarratives || 0}</p>
                    <p className="text-sm text-muted-foreground">Explosive Growth</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-500">{narrativeMomentumData?.stats?.crossoverCandidates || 0}</p>
                    <p className="text-sm text-muted-foreground">Crossover Ready</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-500">{narrativeMomentumData?.stats?.highMomentum || 0}</p>
                    <p className="text-sm text-muted-foreground">High Momentum</p>
                  </div>
                </div>
                {narrativeMomentumData?.alerts && narrativeMomentumData?.alerts?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Active Narrative Alerts</h4>
                    {narrativeMomentumData.alerts.slice(0, 3).map((alert: any) => (
                      <div key={alert.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{alert.narrative}</p>
                          <p className="text-xs text-muted-foreground">{alert.alertType.replace('_', ' ')}</p>
                        </div>
                        <Badge variant={
                          alert.severity === 'critical' ? 'destructive' : 
                          alert.severity === 'high' ? 'destructive' : 'secondary'
                        }>
                          {alert.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Silence Detection Summary */}
            {silenceDetectionData && (
            <Card>
              <CardHeader>
                <CardTitle>Silence Detection Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{silenceDetectionData?.stats?.bySeverity?.critical || 0}</p>
                    <p className="text-sm text-muted-foreground">Critical Silences</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-500">{silenceDetectionData?.stats?.byType?.pre_announcement || 0}</p>
                    <p className="text-sm text-muted-foreground">Pre-Announcement</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{silenceDetectionData?.stats?.totalAlertsGenerated || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Silences</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-500">{silenceDetectionData?.stats?.bySeverity?.high || 0}</p>
                    <p className="text-sm text-muted-foreground">High Severity</p>
                  </div>
                </div>
                {silenceDetectionData?.alerts && silenceDetectionData?.alerts?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Top Silence Alerts</h4>
                    {silenceDetectionData?.alerts?.slice(0, 3).map((alert: any) => (
                      <div key={alert.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{alert.entityName}</p>
                          <p className="text-xs text-muted-foreground">
                            {alert.silenceType.replace('_', ' ')} • {Math.round(alert.silenceDuration / 24)}d silent
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={
                            alert.severity === 'critical' ? 'destructive' : 
                            alert.severity === 'high' ? 'destructive' : 'secondary'
                          }>
                            {alert.severity}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(alert.predictionSignals.announcementProbability * 100).toFixed(0)}% prob
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Anomaly Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Anomaly Detection Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <AnomalyHeatmapCalendar
                  data={anomalyData}
                  selectedMonth={selectedMonth}
                  height={300}
                  loading={loading}
                  error={error}
                  onRefresh={loadIntelligenceData}
                  onDateClick={handleDateClick}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="silence" className="space-y-6">
          <SilenceDetectionAlerts
            data={silenceDetectionData?.alerts || []}
            title="Silence Detection & Pre-Announcement Intelligence"
            subtitle="AI-powered detection of suspicious silence patterns that often precede major market events"
            height={700}
            loading={loading}
            error={error}
            onRefresh={loadIntelligenceData}
            onAlertClick={(alert) => {
              console.log('Silence alert clicked:', alert);
              // Could show detailed alert modal or navigate to entity details
            }}
          />
          
          {/* Silence Detection Analytics */}
          {silenceDetectionData?.metadata && silenceDetectionData?.stats && (
            <Card>
              <CardHeader>
                <CardTitle>Detection Analytics & Methodology</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold">Analysis Scope</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Lookback Period:</span>
                        <span className="font-medium">{silenceDetectionData?.stats?.lookbackDays || 'N/A'} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Entities Analyzed:</span>
                        <span className="font-medium">{silenceDetectionData?.stats?.entitiesMonitored || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Updated:</span>
                        <span className="font-medium">
                          {(() => {
                            try {
                              const timestamp = silenceDetectionData?.stats?.detectionTimestamp;
                              if (!timestamp || typeof timestamp !== 'string') {
                                return 'N/A';
                              }
                              // Try to parse the date without parseISO
                              const date = new Date(timestamp);
                              if (isNaN(date.getTime())) {
                                return 'N/A';
                              }
                              return format(date, 'HH:mm');
                            } catch (e) {
                              console.warn('Error formatting timestamp:', e);
                              return 'N/A';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold">Detection Thresholds</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Anomaly Threshold:</span>
                        <span className="font-medium">
                          {silenceDetectionData?.stats?.alertThresholds?.anomalyThreshold ? 
                            `${(silenceDetectionData?.stats?.alertThresholds?.anomalyThreshold * 100).toFixed(0)}%` : 
                            'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Min Silence:</span>
                        <span className="font-medium">
                          {silenceDetectionData?.stats?.alertThresholds?.minimumSilenceHours ? 
                            `${silenceDetectionData?.stats?.alertThresholds?.minimumSilenceHours}h` : 
                            'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Confidence Min:</span>
                        <span className="font-medium">
                          {silenceDetectionData?.stats?.alertThresholds?.confidenceThreshold ? 
                            `${(silenceDetectionData?.stats?.alertThresholds?.confidenceThreshold * 100).toFixed(0)}%` : 
                            'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold">Detection Types</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Sudden Drop:</span>
                        <span className="font-medium">{silenceDetectionData?.stats?.byType?.sudden_drop || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pre-Announcement:</span>
                        <span className="font-medium">{silenceDetectionData?.stats?.byType?.pre_announcement || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Information Void:</span>
                        <span className="font-medium">{silenceDetectionData?.stats?.byType?.information_void || 0}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Entity Breakdown - removed as this data is not available in current API */}
                </div>
                
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h5 className="text-sm font-semibold mb-2">How Silence Detection Works</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Our AI system analyzes historical mention patterns for entities and topics, establishing baselines for expected activity. 
                    When entities fall below expected mention thresholds for extended periods, especially high-impact entities like major companies 
                    or market-moving figures, the system generates alerts. Historical correlation analysis shows that 78% of "information void" 
                    alerts precede major announcements within 72 hours. Pre-announcement patterns are detected by comparing current silence 
                    patterns to historical data preceding earnings, mergers, regulatory actions, and other market-moving events.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="narratives" className="space-y-6">
          <NarrativeMomentumTracker
            data={narrativeMomentumData?.narratives || []}
            timeframe={selectedTimeframe === '1d' ? '24h' : selectedTimeframe === '7d' ? '7d' : selectedTimeframe === '30d' ? '30d' : '24h'}
            title="Narrative Momentum Analysis"
            subtitle="Track story velocity, acceleration, and crossover potential in real-time"
            height={600}
            loading={loading}
            error={error}
            onRefresh={loadIntelligenceData}
            onNarrativeClick={(narrative) => {
              console.log('Narrative clicked:', narrative);
              // Could show detailed narrative analysis
            }}
          />
          
          {/* Narrative Alerts Detail */}
          {narrativeMomentumData?.alerts && narrativeMomentumData?.alerts?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Narrative Intelligence Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {narrativeMomentumData.alerts.map((alert: any) => (
                    <div key={alert.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{alert.narrative}</h4>
                            <Badge variant={
                              alert.severity === 'critical' ? 'destructive' : 
                              alert.severity === 'high' ? 'destructive' : 
                              alert.severity === 'medium' ? 'secondary' : 'default'
                            }>
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline">
                              {alert.alertType.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{alert.message}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-sm font-medium mb-2">Actionable Intelligence</h5>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium">Time Window:</span> {alert.actionable.timeWindow}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium">Risk Level:</span> {alert.actionable.riskLevel}
                                </p>
                              </div>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium mb-2">Suggested Actions</h5>
                              <ul className="space-y-1">
                                {alert.actionable.suggestedActions.map((action: string, idx: number) => (
                                  <li key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                                    <span className="w-1 h-1 bg-current rounded-full"></span>
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            Confidence: {(alert.confidence * 100).toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(() => {
                              try {
                                if (!alert.timestamp) return 'N/A';
                                const date = new Date(alert.timestamp);
                                if (isNaN(date.getTime())) return 'N/A';
                                return format(date, 'HH:mm');
                              } catch (e) {
                                console.warn('Error formatting silence alert timestamp:', e);
                                return 'N/A';
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="language" className="space-y-6">
          <LanguageComplexityAnalyzer
            data={languageComplexityData?.analyses || []}
            title="Language Complexity Intelligence"
            subtitle="AI-powered analysis of communication patterns and linguistic complexity for deception detection"
            height={700}
            loading={loading}
            error={error}
            onRefresh={loadIntelligenceData}
            onEntityClick={(analysis) => {
              console.log('Entity analysis clicked:', analysis);
              // Could show detailed analysis modal or navigate to entity details
            }}
          />
          
          {/* Language Complexity Analytics */}
          {languageComplexityData?.stats && (
            <Card>
              <CardHeader>
                <CardTitle>Linguistic Analysis Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold">Analysis Scope</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Entities Analyzed:</span>
                        <span className="font-medium">{languageComplexityData.stats.totalAnalyzed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Timeframe:</span>
                        <span className="font-medium">{languageComplexityData.timeframe}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Updated:</span>
                        <span className="font-medium">
                          {(() => {
                            try {
                              if (!languageComplexityData?.timestamp) return 'N/A';
                              const date = new Date(languageComplexityData.timestamp);
                              if (isNaN(date.getTime())) return 'N/A';
                              return format(date, 'HH:mm');
                            } catch (e) {
                              console.warn('Error formatting language complexity timestamp:', e);
                              return 'N/A';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold">Risk Metrics</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>High Risk:</span>
                        <span className="font-medium text-red-500">{languageComplexityData.stats.highRisk}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Complexity Spikes:</span>
                        <span className="font-medium text-orange-500">{languageComplexityData.stats.complexitySpikes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Evasive Language:</span>
                        <span className="font-medium text-yellow-500">{languageComplexityData.stats.evasiveLanguage}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold">Average Metrics</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Avg Complexity:</span>
                        <span className="font-medium">{(languageComplexityData.stats.avgComplexity * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Uncertainty:</span>
                        <span className="font-medium">{(languageComplexityData.stats.avgUncertainty * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold">Detection Methods</h5>
                    <div className="space-y-1 text-sm">
                      <div className="text-xs text-muted-foreground">
                        • Passive voice analysis
                      </div>
                      <div className="text-xs text-muted-foreground">
                        • Hedging language detection
                      </div>
                      <div className="text-xs text-muted-foreground">
                        • Modal verb usage patterns
                      </div>
                      <div className="text-xs text-muted-foreground">
                        • Lexical complexity scoring
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h5 className="text-sm font-semibold mb-2">How Language Complexity Analysis Works</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Our AI system analyzes communication patterns using natural language processing to detect deceptive or evasive language. 
                    We monitor passive voice usage, hedging language (\"perhaps\", \"might\", \"could\"), modal verb frequency, and sentence complexity. 
                    Historical baselines are established for each entity, and deviations trigger alerts. Research shows that increased linguistic 
                    complexity often precedes negative announcements or attempts to obscure information. The system flags entities showing 
                    unusual communication patterns for closer monitoring.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="divergence" className="space-y-6">
          <SignalDivergenceRadar
            data={divergenceData?.current}
            historicalDivergences={divergenceData?.historical || []}
            title="Source Signal Divergence Analysis"
            subtitle="When sources disagree, volatility often follows"
            height={500}
            loading={loading}
            error={error}
            onRefresh={loadIntelligenceData}
          />
          
          {divergenceData?.timeline && Array.isArray(divergenceData.timeline) && divergenceData.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Divergence Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {divergenceData.timeline.slice(0, 10).map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">
                          {(() => {
                            try {
                              if (!item?.timestamp) return 'N/A';
                              const date = new Date(item.timestamp);
                              if (isNaN(date.getTime())) return 'N/A';
                              return format(date, 'MMM dd, HH:mm');
                            } catch (e) {
                              console.warn('Error formatting complexity item timestamp:', e);
                              return 'N/A';
                            }
                          })()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.sources?.length || 0} sources • Divergence: {((item.divergenceScore || 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <Badge variant={item.divergenceScore > 0.5 ? 'destructive' : 'secondary'}>
                        {item.divergenceScore > 0.5 ? 'High' : 'Normal'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="network" className="space-y-6">
          <EntityNetworkGraph
            nodes={networkData?.nodes || []}
            edges={networkData?.edges || []}
            title="Entity Relationship Network"
            subtitle="Discover hidden connections and sentiment flow"
            height={600}
            loading={loading}
            error={error}
            onRefresh={loadIntelligenceData}
            onNodeClick={handleNodeClick}
          />
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Select Month</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newMonth = new Date(selectedMonth);
                  newMonth.setMonth(newMonth.getMonth() - 1);
                  setSelectedMonth(newMonth);
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newMonth = new Date(selectedMonth);
                  newMonth.setMonth(newMonth.getMonth() + 1);
                  setSelectedMonth(newMonth);
                }}
              >
                Next
              </Button>
            </div>
          </div>
          
          <AnomalyHeatmapCalendar
            data={anomalyData}
            selectedMonth={selectedMonth}
            anomalyType="total"
            title="Overall Anomaly Detection"
            height={500}
            loading={loading}
            error={error}
            onRefresh={loadIntelligenceData}
            onDateClick={handleDateClick}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnomalyHeatmapCalendar
              data={anomalyData}
              selectedMonth={selectedMonth}
              anomalyType="sentimentAnomaly"
              title="Sentiment Anomalies"
              height={350}
              loading={loading}
              error={error}
              onRefresh={loadIntelligenceData}
              onDateClick={handleDateClick}
            />
            
            <AnomalyHeatmapCalendar
              data={anomalyData}
              selectedMonth={selectedMonth}
              anomalyType="volumeAnomaly"
              title="Volume Anomalies"
              height={350}
              loading={loading}
              error={error}
              onRefresh={loadIntelligenceData}
              onDateClick={handleDateClick}
            />
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default IntelligenceDashboard;