import React, { useState, useMemo } from 'react';
import { ChartBase } from './ChartBase';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
  TrendingDown,
  Target,
  Calendar,
  Activity,
  Bell,
  Search,
  Filter,
  ChevronRight,
  Zap
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface SilenceAlert {
  id: string;
  entityName: string;
  entityType: 'company' | 'person' | 'topic' | 'sector';
  silenceType: 'sudden_drop' | 'expected_absence' | 'pre_announcement' | 'information_void';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  
  expectedMentions: number;
  actualMentions: number;
  silenceRatio: number;
  silenceDuration: number;
  
  historicalPattern: {
    averageMentions: number;
    typicalSilenceBefore: string[];
    lastMajorEvent: string;
    daysSinceLastEvent: number;
  };
  
  predictionSignals: {
    announcementProbability: number;
    timeToEvent: number;
    eventType: string;
    marketImpactPotential: 'low' | 'medium' | 'high';
  };
  
  contextualFactors: {
    earningsSeasonProximity: boolean;
    marketConditions: string;
    sectorActivity: number;
    relatedEntitySilences: string[];
  };
  
  actionable: {
    watchWindow: string;
    monitoringSuggestions: string[];
    riskLevel: string;
    potentialCatalysts: string[];
  };
  
  timestamp: string;
  detectedAt: string;
}

interface SilenceDetectionAlertsProps {
  data: SilenceAlert[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onAlertClick?: (alert: SilenceAlert) => void;
}

export const SilenceDetectionAlerts: React.FC<SilenceDetectionAlertsProps> = ({
  data,
  title = "Silence Detection Alerts",
  subtitle,
  height = 600,
  loading = false,
  error = null,
  onRefresh,
  onAlertClick
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'severity' | 'confidence' | 'duration' | 'probability'>('severity');

  const { filteredAlerts, stats } = useMemo(() => {
    let filtered = data;

    // Apply filters
    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(alert => alert.severity === selectedSeverity);
    }
    
    if (selectedType !== 'all') {
      filtered = filtered.filter(alert => alert.silenceType === selectedType);
    }
    
    if (selectedEntityType !== 'all') {
      filtered = filtered.filter(alert => alert.entityType === selectedEntityType);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(alert => 
        alert.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.predictionSignals.eventType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort alerts
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        case 'confidence':
          return b.confidence - a.confidence;
        case 'duration':
          return b.silenceDuration - a.silenceDuration;
        case 'probability':
          return b.predictionSignals.announcementProbability - a.predictionSignals.announcementProbability;
        default:
          return 0;
      }
    });

    // Calculate stats
    const stats = {
      total: data.length,
      critical: data.filter(a => a.severity === 'critical').length,
      preAnnouncement: data.filter(a => a.silenceType === 'pre_announcement').length,
      highProbability: data.filter(a => a.predictionSignals.announcementProbability > 0.7).length,
      avgSilenceDuration: data.length > 0 ? 
        data.reduce((sum, a) => sum + a.silenceDuration, 0) / data.length : 0
    };

    return { filteredAlerts: filtered, stats };
  }, [data, selectedSeverity, selectedType, selectedEntityType, searchTerm, sortBy]);

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityBadgeVariant = (severity: string): 'destructive' | 'secondary' | 'default' => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getSilenceTypeIcon = (type: string) => {
    switch (type) {
      case 'sudden_drop': return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'pre_announcement': return <Target className="w-4 h-4 text-orange-500" />;
      case 'information_void': return <EyeOff className="w-4 h-4 text-purple-500" />;
      case 'expected_absence': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSilenceTypeLabel = (type: string): string => {
    switch (type) {
      case 'sudden_drop': return 'Sudden Drop';
      case 'pre_announcement': return 'Pre-Announcement';
      case 'information_void': return 'Information Void';
      case 'expected_absence': return 'Expected Absence';
      default: return type;
    }
  };

  const formatDuration = (hours: number): string => {
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.round(days / 7);
    return `${weeks}w`;
  };

  const badges = [
    {
      text: `${stats.total} Detected`,
      variant: 'secondary' as const
    },
    {
      text: `${stats.critical} Critical`,
      variant: stats.critical > 0 ? 'destructive' : 'secondary' as const,
      icon: stats.critical > 0 ? <AlertTriangle className="w-3 h-3" /> : undefined
    },
    {
      text: `${stats.preAnnouncement} Pre-Announcement`,
      variant: stats.preAnnouncement > 0 ? 'default' : 'secondary' as const,
      icon: stats.preAnnouncement > 0 ? <Target className="w-3 h-3" /> : undefined
    },
    {
      text: `Avg ${formatDuration(stats.avgSilenceDuration)} Silence`,
      variant: 'outline' as const
    }
  ];

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `Real-time detection of suspicious silence patterns • ${data.length} entities monitored`}
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
              placeholder="Search entities or event types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Types</option>
              <option value="sudden_drop">Sudden Drop</option>
              <option value="pre_announcement">Pre-Announcement</option>
              <option value="information_void">Information Void</option>
              <option value="expected_absence">Expected Absence</option>
            </select>

            {/* Entity Type Filter */}
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="px-3 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Entity Types</option>
              <option value="company">Companies</option>
              <option value="person">People</option>
              <option value="topic">Topics</option>
              <option value="sector">Sectors</option>
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="severity">Sort by Severity</option>
              <option value="confidence">Sort by Confidence</option>
              <option value="duration">Sort by Duration</option>
              <option value="probability">Sort by Probability</option>
            </select>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
              <p className="text-sm text-muted-foreground">Critical Alerts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">{stats.preAnnouncement}</p>
              <p className="text-sm text-muted-foreground">Pre-Announcement</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-500">{stats.highProbability}</p>
              <p className="text-sm text-muted-foreground">High Probability</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{formatDuration(stats.avgSilenceDuration)}</p>
              <p className="text-sm text-muted-foreground">Avg Silence</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        <div className="space-y-4" style={{ maxHeight: height - 300, overflowY: 'auto' }}>
          {filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <EyeOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Silence Detected</h3>
                <p className="text-muted-foreground">
                  {searchTerm || selectedSeverity !== 'all' || selectedType !== 'all' ? 
                    'No alerts match your current filters.' :
                    'All entities are within normal activity ranges.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAlerts.map((alert) => (
              <Card 
                key={alert.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                style={{ borderLeftColor: getSeverityColor(alert.severity).replace('bg-', '#') }}
                onClick={() => onAlertClick?.(alert)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full ${getSeverityColor(alert.severity)} flex items-center justify-center`}>
                        {getSilenceTypeIcon(alert.silenceType)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-lg">{alert.entityName}</h4>
                          <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline">
                            {alert.entityType}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-2">
                          {getSilenceTypeLabel(alert.silenceType)} • Silent for {formatDuration(alert.silenceDuration)}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Expected: {alert.expectedMentions} mentions</span>
                          <span>Actual: {alert.actualMentions} mentions</span>
                          <span>Confidence: {(alert.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground mb-1">
                        {format(parseISO(alert.detectedAt), 'MMM dd, HH:mm')}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {/* Prediction Signals */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        Prediction Signals
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Announcement Probability:</span>
                          <span className="font-medium">
                            {(alert.predictionSignals.announcementProbability * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estimated Time:</span>
                          <span className="font-medium">{alert.actionable.watchWindow}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Event Type:</span>
                          <span className="font-medium">{alert.predictionSignals.eventType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Market Impact:</span>
                          <Badge 
                            variant={
                              alert.predictionSignals.marketImpactPotential === 'high' ? 'destructive' :
                              alert.predictionSignals.marketImpactPotential === 'medium' ? 'secondary' : 'default'
                            }
                            className="text-xs"
                          >
                            {alert.predictionSignals.marketImpactPotential}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Context */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Context
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Market Conditions:</span>
                          <span className="font-medium capitalize">{alert.contextualFactors.marketConditions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Earnings Season:</span>
                          <Badge variant={alert.contextualFactors.earningsSeasonProximity ? 'secondary' : 'outline'} className="text-xs">
                            {alert.contextualFactors.earningsSeasonProximity ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Days Since Event:</span>
                          <span className="font-medium">{alert.historicalPattern.daysSinceLastEvent}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        Monitoring
                      </h5>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>Risk Level:</span>
                          <Badge 
                            variant={
                              alert.actionable.riskLevel === 'High' ? 'destructive' :
                              alert.actionable.riskLevel === 'Medium' ? 'secondary' : 'default'
                            }
                            className="text-xs"
                          >
                            {alert.actionable.riskLevel}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Watch for:</span>
                          <ul className="mt-1 space-y-0.5">
                            {alert.actionable.potentialCatalysts.slice(0, 2).map((catalyst, idx) => (
                              <li key={idx} className="flex items-center gap-1">
                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                {catalyst}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar for Silence Duration */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Silence Progress</span>
                      <span>{(alert.silenceRatio * 100).toFixed(0)}% below expected</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          alert.silenceRatio > 0.8 ? 'bg-red-500' :
                          alert.silenceRatio > 0.6 ? 'bg-orange-500' :
                          alert.silenceRatio > 0.4 ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${alert.silenceRatio * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </ChartBase>
  );
};