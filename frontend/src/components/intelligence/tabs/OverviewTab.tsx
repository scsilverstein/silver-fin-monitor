import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  SignalDivergenceRadar,
  EntityNetworkGraph,
  AnomalyHeatmapCalendar,
} from '@/components/charts';

interface OverviewTabProps {
  divergenceData: any;
  networkData: any;
  anomalyData: any[];
  narrativeMomentumData: any;
  silenceDetectionData: any;
  selectedMonth: Date;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNodeClick: (node: any) => void;
  onDateClick: (date: string, data: any) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  divergenceData,
  networkData,
  anomalyData,
  narrativeMomentumData,
  silenceDetectionData,
  selectedMonth,
  loading,
  error,
  onRefresh,
  onNodeClick,
  onDateClick,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            onRefresh={onRefresh}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entity Network Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <NetworkStats stats={networkData?.stats} />
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
              onRefresh={onRefresh}
              onNodeClick={onNodeClick}
            />
          </div>
        </CardContent>
      </Card>

      <NarrativeMomentumSummary data={narrativeMomentumData} />
      <SilenceDetectionSummary data={silenceDetectionData} />

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
            onRefresh={onRefresh}
            onDateClick={onDateClick}
          />
        </CardContent>
      </Card>
    </div>
  );
};

const NetworkStats: React.FC<{ stats: any }> = ({ stats }) => (
  <div className="grid grid-cols-3 gap-4 mb-4">
    <div className="text-center">
      <p className="text-2xl font-bold">{stats?.totalNodes || 0}</p>
      <p className="text-sm text-muted-foreground">Entities</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold">{stats?.totalEdges || 0}</p>
      <p className="text-sm text-muted-foreground">Connections</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold">
        {stats?.avgConnections?.toFixed(1) || 0}
      </p>
      <p className="text-sm text-muted-foreground">Avg Links</p>
    </div>
  </div>
);

const NarrativeMomentumSummary: React.FC<{ data: any }> = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle>Narrative Momentum Overview</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold">{data?.stats?.totalNarratives || 0}</p>
          <p className="text-sm text-muted-foreground">Active Narratives</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-500">{data?.stats?.explosiveNarratives || 0}</p>
          <p className="text-sm text-muted-foreground">Explosive Growth</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-500">{data?.stats?.crossoverCandidates || 0}</p>
          <p className="text-sm text-muted-foreground">Crossover Ready</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-500">{data?.stats?.highMomentum || 0}</p>
          <p className="text-sm text-muted-foreground">High Momentum</p>
        </div>
      </div>
      <NarrativeAlerts alerts={data?.alerts} />
    </CardContent>
  </Card>
);

const NarrativeAlerts: React.FC<{ alerts: any[] }> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm">Active Narrative Alerts</h4>
      {alerts.slice(0, 3).map((alert: any) => (
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
  );
};

const SilenceDetectionSummary: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Silence Detection Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{data?.stats?.bySeverity?.critical || 0}</p>
            <p className="text-sm text-muted-foreground">Critical Silences</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">{data?.stats?.byType?.pre_announcement || 0}</p>
            <p className="text-sm text-muted-foreground">Pre-Announcement</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{data?.stats?.totalAlertsGenerated || 0}</p>
            <p className="text-sm text-muted-foreground">Total Silences</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-500">{data?.stats?.bySeverity?.high || 0}</p>
            <p className="text-sm text-muted-foreground">High Severity</p>
          </div>
        </div>
        <SilenceAlerts alerts={data?.alerts} />
      </CardContent>
    </Card>
  );
};

const SilenceAlerts: React.FC<{ alerts: any[] }> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm">Top Silence Alerts</h4>
      {alerts.slice(0, 3).map((alert: any) => (
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
  );
};