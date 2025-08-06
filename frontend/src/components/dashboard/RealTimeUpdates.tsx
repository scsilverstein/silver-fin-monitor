import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFeedUpdates, useAnalysisUpdates, useStockAlerts } from '@/hooks/useWebSocket';
import { formatDate } from '@/lib/utils';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  TrendingUp,
  Rss,
  Brain,
  Wifi,
  WifiOff
} from 'lucide-react';

interface Update {
  id: string;
  type: 'feed' | 'analysis' | 'stock';
  status: 'started' | 'progress' | 'completed' | 'failed' | 'alert';
  title: string;
  description?: string;
  timestamp: Date;
  data?: any;
}

export const RealTimeUpdates: React.FC = () => {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Subscribe to feed updates
  useFeedUpdates((data) => {
    const update: Update = {
      id: `feed-${Date.now()}`,
      type: 'feed',
      status: data.status,
      title: `Feed ${data.feedName || data.feedId}`,
      description: data.status === 'completed' 
        ? `Processed ${data.itemsProcessed} items`
        : data.error || 'Processing...',
      timestamp: new Date(),
      data
    };
    
    setUpdates(prev => [update, ...prev].slice(0, 50)); // Keep last 50 updates
  });
  
  // Subscribe to analysis updates
  useAnalysisUpdates((data) => {
    const update: Update = {
      id: `analysis-${Date.now()}`,
      type: 'analysis',
      status: data.status,
      title: 'Market Analysis',
      description: data.message || `Progress: ${data.progress}%`,
      timestamp: new Date(),
      data
    };
    
    setUpdates(prev => [update, ...prev].slice(0, 50));
  });
  
  // Subscribe to stock alerts
  useStockAlerts((alert) => {
    const update: Update = {
      id: `stock-${Date.now()}`,
      type: 'stock',
      status: 'alert',
      title: `${alert.symbol} - ${alert.type}`,
      description: alert.message,
      timestamp: new Date(),
      data: alert
    };
    
    setUpdates(prev => [update, ...prev].slice(0, 50));
  });
  
  // Monitor connection status (polling-based)
  useEffect(() => {
    setIsConnected(true); // Always connected for polling-based updates
    
    // Optional: Add API health check for more accurate status
    const checkHealth = async () => {
      try {
        // Could add a health check API call here
        setIsConnected(true);
      } catch (error) {
        setIsConnected(false);
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);
  
  const getStatusIcon = (status: Update['status']) => {
    switch (status) {
      case 'started':
      case 'progress':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'alert':
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getTypeIcon = (type: Update['type']) => {
    switch (type) {
      case 'feed':
        return <Rss className="h-4 w-4" />;
      case 'analysis':
        return <Brain className="h-4 w-4" />;
      case 'stock':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };
  
  const getStatusColor = (status: Update['status']): string => {
    switch (status) {
      case 'started':
      case 'progress':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'alert':
        return 'outline';
      default:
        return 'secondary';
    }
  };
  
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Real-Time Updates</CardTitle>
            <CardDescription>Live system activity and alerts</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-xs text-green-500">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-xs text-red-500">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {updates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No recent updates</p>
              <p className="text-xs mt-1">Updates will appear here in real-time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {updates.map((update) => (
                <div
                  key={update.id}
                  className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(update.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(update.type)}
                      <span className="font-medium text-sm truncate">
                        {update.title}
                      </span>
                      <Badge variant={getStatusColor(update.status) as any} className="text-xs">
                        {update.status}
                      </Badge>
                    </div>
                    {update.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {update.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(update.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};