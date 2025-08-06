import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RealTimeUpdates } from '@/components/dashboard/RealTimeUpdates';
import { usePolling } from '@/hooks/usePolling';
import { formatDate } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Server,
  Settings,
  Users,
  Zap,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Shield
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  services: {
    database: 'up' | 'down' | 'degraded';
    cache: 'up' | 'down' | 'degraded';
    websocket: 'up' | 'down' | 'degraded';
    queue: 'up' | 'down' | 'degraded';
  };
  uptime: number;
  version: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalJobs: number;
}

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'healthy',
    services: {
      database: 'up',
      cache: 'up',
      websocket: 'up',
      queue: 'up'
    },
    uptime: 0,
    version: '1.0.0'
  });
  const [queueStats, setQueueStats] = useState<QueueStats>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalJobs: 0
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState({
    cpuUsage: 0,
    memoryUsage: 0,
    activeJobs: 0,
    queueSize: 0,
    uptime: 0
  });
  
  // Subscribe to system metrics via polling
  usePolling('/api/admin/metrics', (newMetrics) => {
    if (newMetrics && newMetrics.success) {
      setMetrics(newMetrics.data);
    }
  }, { interval: 5000 }); // Poll every 5 seconds
  
  useEffect(() => {
    // Fetch initial system data
    fetchSystemHealth();
    fetchQueueStats();
    fetchAlerts();
    
    // Refresh data periodically
    const interval = setInterval(() => {
      fetchSystemHealth();
      fetchQueueStats();
      fetchAlerts();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/admin/health');
      const data = await response.json();
      setSystemHealth(data);
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    }
  };
  
  const fetchQueueStats = async () => {
    try {
      const response = await fetch('/api/queue/stats');
      const data = await response.json();
      setQueueStats(data);
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
    }
  };
  
  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/alerts');
      const data = await response.json();
      setAlerts(data.slice(0, 10)); // Show latest 10 alerts
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'degraded':
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'down':
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'up':
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'down':
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };
  
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'error':
        return 'destructive';
      case 'warning':
        return 'outline';
      case 'info':
        return 'secondary';
      default:
        return 'secondary';
    }
  };
  
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              System monitoring and administration
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* System Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center space-x-2">
                <Server className="h-4 w-4" />
                <span>System Health</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getStatusIcon(systemHealth.status)}
              <Badge className={getStatusColor(systemHealth.status)}>
                {systemHealth.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Uptime: {formatUptime(systemHealth.uptime)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4" />
                <span>CPU Usage</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{metrics.cpuUsage.toFixed(1)}%</div>
              <Progress value={metrics.cpuUsage} className="h-2" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center space-x-2">
                <MemoryStick className="h-4 w-4" />
                <span>Memory Usage</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{metrics.memoryUsage.toFixed(1)}%</div>
              <Progress value={metrics.memoryUsage} className="h-2" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>Queue Status</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats.pending}</div>
            <p className="text-xs text-muted-foreground">
              {queueStats.processing} processing
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="logs">Live Updates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
                <CardDescription>Current system status and metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Version</span>
                  <Badge variant="outline">{systemHealth.version}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Jobs</span>
                  <span className="text-sm">{metrics.activeJobs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Queue Size</span>
                  <span className="text-sm">{metrics.queueSize}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uptime</span>
                  <span className="text-sm">{formatUptime(metrics.uptime)}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest system alerts and warnings</CardDescription>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">No active alerts</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-start space-x-2 p-2 rounded-md bg-muted/50">
                        <Badge variant={getSeverityColor(alert.severity) as any} className="text-xs">
                          {alert.severity}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{alert.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(alert.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="services" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(systemHealth.services).map(([service, status]) => (
              <Card key={service}>
                <CardHeader>
                  <CardTitle className="capitalize flex items-center space-x-2">
                    <Database className="h-4 w-4" />
                    <span>{service}</span>
                    {getStatusIcon(status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={getStatusColor(status)}>
                    {status}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Service is {status === 'up' ? 'running normally' : 
                               status === 'degraded' ? 'experiencing issues' : 
                               'not responding'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="queue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{queueStats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{queueStats.processing}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{queueStats.completed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>All system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-medium mb-2">No alerts</h3>
                  <p className="text-sm text-muted-foreground">
                    System is running smoothly
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <Alert key={alert.id}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="flex items-center space-x-2">
                        <span>{alert.title}</span>
                        <Badge variant={getSeverityColor(alert.severity) as any}>
                          {alert.severity}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription>
                        <p>{alert.message}</p>
                        <p className="text-xs mt-2 opacity-75">
                          {formatDate(alert.timestamp)}
                        </p>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="logs" className="space-y-4">
          <RealTimeUpdates />
        </TabsContent>
      </Tabs>
    </div>
  );
};