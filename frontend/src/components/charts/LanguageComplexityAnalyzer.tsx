import React, { useState, useMemo } from 'react';
import { 
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  LineChart,
  Line
} from 'recharts';
import { ChartBase } from './ChartBase';
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
  Brain,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Eye,
  FileText,
  Target,
  Clock,
  BarChart3,
  Activity
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface LanguageComplexityAnalysis {
  id: string;
  entityName: string;
  entityType: 'company' | 'person' | 'topic' | 'document';
  timeframe: string;
  
  complexityScore: number;
  readabilityScore: number;
  uncertaintyLevel: number;
  evasivenessFactor: number;
  
  linguisticMetrics: {
    averageWordsPerSentence: number;
    averageSyllablesPerWord: number;
    lexicalDiversity: number;
    sentenceComplexity: number;
    passiveVoiceRatio: number;
    modalVerbUsage: number;
    hedgingLanguage: number;
    qualifierDensity: number;
  };
  
  confidenceMetrics: {
    assertivenessScore: number;
    confidenceLanguage: number;
    certaintyIndicators: number;
    tentativeLanguage: number;
    deflectionPatterns: number;
  };
  
  anomalyDetection: {
    deviationFromBaseline: number;
    unusualPatterns: string[];
    communicationShifts: {
      direction: 'more_complex' | 'less_complex' | 'stable';
      magnitude: number;
      timeframe: string;
    };
    redFlags: {
      type: 'excessive_hedging' | 'passive_deflection' | 'complexity_spike' | 'jargon_overload';
      severity: 'low' | 'medium' | 'high';
      description: string;
    }[];
  };
  
  riskAssessment: {
    communicationRisk: 'low' | 'medium' | 'high' | 'critical';
    probabilityOfConcern: number;
    timeToEvent: number;
    suggestedActions: string[];
    monitoringPriority: 'low' | 'medium' | 'high';
  };
  
  examples: {
    complex: string[];
    evasive: string[];
    uncertain: string[];
    clear: string[];
  };
  
  timestamp: string;
  analysisDate: string;
}

interface LanguageComplexityAnalyzerProps {
  data: LanguageComplexityAnalysis[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEntityClick?: (analysis: LanguageComplexityAnalysis) => void;
}

export const LanguageComplexityAnalyzer: React.FC<LanguageComplexityAnalyzerProps> = ({
  data,
  title = "Language Complexity Analyzer",
  subtitle,
  height = 700,
  loading = false,
  error = null,
  onRefresh,
  onEntityClick
}) => {
  const [selectedView, setSelectedView] = useState<'scatter' | 'radar' | 'trends' | 'alerts'>('scatter');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<LanguageComplexityAnalysis | null>(null);

  const { filteredData, stats, chartData } = useMemo(() => {
    let filtered = data;

    // Apply filters
    if (selectedRisk !== 'all') {
      filtered = filtered.filter(item => item.riskAssessment.communicationRisk === selectedRisk);
    }
    
    if (selectedEntityType !== 'all') {
      filtered = filtered.filter(item => item.entityType === selectedEntityType);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.entityName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Calculate stats
    const stats = {
      total: filtered.length,
      highRisk: filtered.filter(item => 
        item.riskAssessment.communicationRisk === 'high' || 
        item.riskAssessment.communicationRisk === 'critical'
      ).length,
      complexitySpikes: filtered.filter(item => 
        item.anomalyDetection.redFlags.some(flag => flag.type === 'complexity_spike')
      ).length,
      evasiveLanguage: filtered.filter(item => item.evasivenessFactor > 0.6).length,
      avgComplexity: filtered.length > 0 ? 
        filtered.reduce((sum, item) => sum + item.complexityScore, 0) / filtered.length : 0,
      avgUncertainty: filtered.length > 0 ? 
        filtered.reduce((sum, item) => sum + item.uncertaintyLevel, 0) / filtered.length : 0
    };

    // Prepare chart data
    const chartData = filtered.map(item => ({
      name: item.entityName,
      complexity: item.complexityScore * 100,
      readability: item.readabilityScore * 100,
      uncertainty: item.uncertaintyLevel * 100,
      evasiveness: item.evasivenessFactor * 100,
      risk: item.riskAssessment.communicationRisk,
      entityType: item.entityType,
      originalData: item
    }));

    return { filteredData: filtered, stats, chartData };
  }, [data, selectedRisk, selectedEntityType, searchTerm]);

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'critical': return '#DC2626';
      case 'high': return '#EA580C';
      case 'medium': return '#D97706';
      case 'low': return '#65A30D';
      default: return '#6B7280';
    }
  };

  const getRiskBadgeVariant = (risk: string): 'destructive' | 'secondary' | 'default' => {
    switch (risk) {
      case 'critical':
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getComplexityLevel = (score: number): string => {
    if (score > 0.8) return 'Very High';
    if (score > 0.6) return 'High';
    if (score > 0.4) return 'Medium';
    if (score > 0.2) return 'Low';
    return 'Very Low';
  };

  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    
    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 min-w-[300px]">
        <div className="font-semibold text-lg mb-3 text-foreground">
          {data.name}
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Complexity:</span>
            <div className="font-medium">{data.complexity.toFixed(1)}%</div>
          </div>
          <div>
            <span className="text-muted-foreground">Readability:</span>
            <div className="font-medium">{data.readability.toFixed(1)}%</div>
          </div>
          <div>
            <span className="text-muted-foreground">Uncertainty:</span>
            <div className="font-medium">{data.uncertainty.toFixed(1)}%</div>
          </div>
          <div>
            <span className="text-muted-foreground">Evasiveness:</span>
            <div className="font-medium">{data.evasiveness.toFixed(1)}%</div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Risk Level:</span>
            <Badge variant={getRiskBadgeVariant(data.risk)}>
              {data.risk}
            </Badge>
          </div>
        </div>
      </div>
    );
  };

  const radarData = useMemo(() => {
    if (!selectedEntity) return [];
    
    return [
      {
        metric: 'Complexity',
        value: selectedEntity.complexityScore * 100,
        baseline: 40
      },
      {
        metric: 'Readability',
        value: selectedEntity.readabilityScore * 100,
        baseline: 70
      },
      {
        metric: 'Confidence',
        value: (1 - selectedEntity.uncertaintyLevel) * 100,
        baseline: 60
      },
      {
        metric: 'Directness',
        value: (1 - selectedEntity.evasivenessFactor) * 100,
        baseline: 70
      },
      {
        metric: 'Clarity',
        value: selectedEntity.linguisticMetrics.lexicalDiversity * 100,
        baseline: 50
      },
      {
        metric: 'Assertiveness',
        value: selectedEntity.confidenceMetrics.assertivenessScore * 100,
        baseline: 50
      }
    ];
  }, [selectedEntity]);

  const badges = [
    {
      text: `${stats.total} Analyzed`,
      variant: 'secondary' as const
    },
    {
      text: `${stats.highRisk} High Risk`,
      variant: stats.highRisk > 0 ? 'destructive' : 'secondary' as const,
      icon: stats.highRisk > 0 ? <AlertTriangle className="w-3 h-3" /> : undefined
    },
    {
      text: `${stats.complexitySpikes} Complexity Spikes`,
      variant: stats.complexitySpikes > 0 ? 'destructive' : 'secondary' as const,
      icon: stats.complexitySpikes > 0 ? <TrendingUp className="w-3 h-3" /> : undefined
    },
    {
      text: `${(stats.avgComplexity * 100).toFixed(0)}% Avg Complexity`,
      variant: 'outline' as const
    }
  ];

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `AI-powered analysis of communication patterns and linguistic complexity • ${data.length} entities analyzed`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
    >
      <div className="space-y-6">
        {/* Controls */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filters and View Toggle */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-3 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="px-3 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Types</option>
              <option value="company">Companies</option>
              <option value="person">People</option>
              <option value="topic">Topics</option>
            </select>

            <div className="flex gap-1 ml-auto">
              <Button
                variant={selectedView === 'scatter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedView('scatter')}
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                Scatter
              </Button>
              <Button
                variant={selectedView === 'radar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedView('radar')}
              >
                <Target className="w-4 h-4 mr-1" />
                Radar
              </Button>
              <Button
                variant={selectedView === 'trends' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedView('trends')}
              >
                <Activity className="w-4 h-4 mr-1" />
                Trends
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Entities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{stats.highRisk}</p>
              <p className="text-sm text-muted-foreground">High Risk</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">{stats.complexitySpikes}</p>
              <p className="text-sm text-muted-foreground">Complexity Spikes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{(stats.avgComplexity * 100).toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground">Avg Complexity</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{(stats.avgUncertainty * 100).toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground">Avg Uncertainty</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Main Chart */}
          <div className="lg:col-span-2">
            {selectedView === 'scatter' && (
              <Card>
                <CardHeader>
                  <CardTitle>Complexity vs Uncertainty Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                        <XAxis
                          dataKey="complexity"
                          name="Complexity (%)"
                          tick={{ fontSize: 12 }}
                          stroke="#6B7280"
                        />
                        <YAxis
                          dataKey="uncertainty"
                          name="Uncertainty (%)"
                          tick={{ fontSize: 12 }}
                          stroke="#6B7280"
                        />
                        <Tooltip content={<CustomScatterTooltip />} />
                        
                        <Scatter dataKey="evasiveness" onClick={(data) => setSelectedEntity(data.originalData)}>
                          {chartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={getRiskColor(entry.risk)}
                              fillOpacity={0.7}
                              stroke={selectedEntity?.entityName === entry.name ? '#000' : 'none'}
                              strokeWidth={2}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedView === 'radar' && selectedEntity && (
              <Card>
                <CardHeader>
                  <CardTitle>Communication Profile: {selectedEntity.entityName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis 
                          angle={0} 
                          domain={[0, 100]} 
                          tick={{ fontSize: 10 }}
                          tickCount={6}
                        />
                        <Radar
                          name="Current"
                          dataKey="value"
                          stroke="#3B82F6"
                          fill="#3B82F6"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                        <Radar
                          name="Baseline"
                          dataKey="baseline"
                          stroke="#94A3B8"
                          fill="transparent"
                          strokeWidth={1}
                          strokeDasharray="5 5"
                        />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedView === 'trends' && (
              <Card>
                <CardHeader>
                  <CardTitle>Complexity Trends Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="complexity" 
                          stroke="#DC2626" 
                          strokeWidth={2}
                          name="Complexity"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="uncertainty" 
                          stroke="#F59E0B" 
                          strokeWidth={2}
                          name="Uncertainty"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="evasiveness" 
                          stroke="#8B5CF6" 
                          strokeWidth={2}
                          name="Evasiveness"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Entity Details */}
          <div className="space-y-4">
            {selectedEntity ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {selectedEntity.entityName}
                      <Badge variant={getRiskBadgeVariant(selectedEntity.riskAssessment.communicationRisk)}>
                        {selectedEntity.riskAssessment.communicationRisk}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Complexity:</span>
                        <div className="font-medium">{getComplexityLevel(selectedEntity.complexityScore)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Readability:</span>
                        <div className="font-medium">{(selectedEntity.readabilityScore * 100).toFixed(0)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Uncertainty:</span>
                        <div className="font-medium">{(selectedEntity.uncertaintyLevel * 100).toFixed(0)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Evasiveness:</span>
                        <div className="font-medium">{(selectedEntity.evasivenessFactor * 100).toFixed(0)}%</div>
                      </div>
                    </div>

                    {selectedEntity.anomalyDetection.redFlags.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-semibold">Red Flags:</h5>
                        {selectedEntity.anomalyDetection.redFlags.map((flag, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <AlertTriangle className={`w-4 h-4 ${
                              flag.severity === 'high' ? 'text-red-500' : 
                              flag.severity === 'medium' ? 'text-orange-500' : 'text-yellow-500'
                            }`} />
                            <span>{flag.description}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold">Suggested Actions:</h5>
                      <ul className="space-y-1 text-xs">
                        {selectedEntity.riskAssessment.suggestedActions.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="w-1 h-1 bg-current rounded-full mt-1.5"></span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* Examples */}
                <Card>
                  <CardHeader>
                    <CardTitle>Language Examples</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="complex" className="space-y-3">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="complex">Complex</TabsTrigger>
                        <TabsTrigger value="evasive">Evasive</TabsTrigger>
                        <TabsTrigger value="uncertain">Uncertain</TabsTrigger>
                        <TabsTrigger value="clear">Clear</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="complex" className="space-y-2">
                        {selectedEntity.examples.complex.length > 0 ? (
                          selectedEntity.examples.complex.map((example, idx) => (
                            <div key={idx} className="p-2 bg-muted/50 rounded text-xs">
                              "{example.substring(0, 200)}..."
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No complex examples found</p>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="evasive" className="space-y-2">
                        {selectedEntity.examples.evasive.length > 0 ? (
                          selectedEntity.examples.evasive.map((example, idx) => (
                            <div key={idx} className="p-2 bg-muted/50 rounded text-xs">
                              "{example.substring(0, 200)}..."
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No evasive examples found</p>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="uncertain" className="space-y-2">
                        {selectedEntity.examples.uncertain.length > 0 ? (
                          selectedEntity.examples.uncertain.map((example, idx) => (
                            <div key={idx} className="p-2 bg-muted/50 rounded text-xs">
                              "{example.substring(0, 200)}..."
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No uncertain examples found</p>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="clear" className="space-y-2">
                        {selectedEntity.examples.clear.length > 0 ? (
                          selectedEntity.examples.clear.map((example, idx) => (
                            <div key={idx} className="p-2 bg-muted/50 rounded text-xs">
                              "{example.substring(0, 200)}..."
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No clear examples found</p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select an Entity</h3>
                  <p className="text-muted-foreground">
                    Click on a point in the chart to view detailed language analysis
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* High Risk Entities Summary */}
        {stats.highRisk > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                High Risk Communication Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredData
                  .filter(item => item.riskAssessment.communicationRisk === 'high' || 
                                 item.riskAssessment.communicationRisk === 'critical')
                  .slice(0, 5)
                  .map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedEntity(item)}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          item.riskAssessment.communicationRisk === 'critical' ? 'bg-red-500' : 'bg-orange-500'
                        }`} />
                        <div>
                          <h5 className="font-medium">{item.entityName}</h5>
                          <p className="text-sm text-muted-foreground">
                            {getComplexityLevel(item.complexityScore)} complexity • 
                            {(item.uncertaintyLevel * 100).toFixed(0)}% uncertainty
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge variant={getRiskBadgeVariant(item.riskAssessment.communicationRisk)}>
                          {item.riskAssessment.communicationRisk}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(item.riskAssessment.probabilityOfConcern * 100).toFixed(0)}% concern
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ChartBase>
  );
};