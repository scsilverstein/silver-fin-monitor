import React, { useState } from 'react';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Activity,
  Clock,
  Database
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { formatDistanceToNow } from 'date-fns';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '../ui/popover';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/scroll-area';

export const SyncStatusIndicator: React.FC = () => {
  const { syncStatus, loading, error, refresh, isConnected } = useSyncStatus();
  const [isOpen, setIsOpen] = useState(false);

  const getStatusIcon = () => {
    if (loading && !syncStatus.feeds.length) {
      return <Loader2 className="h-4 w-4 animate-spin text-gray-500" />;
    }

    if (error || !isConnected) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }

    if (syncStatus.isAnySyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    }

    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (loading && !syncStatus.feeds.length) return 'Loading...';
    if (error) return 'Sync Error';
    if (!isConnected) return 'Disconnected';
    if (syncStatus.isAnySyncing) return `Syncing (${syncStatus.syncingCount})`;
    return 'All Synced';
  };

  const getStatusColor = () => {
    if (error || !isConnected) return 'text-red-600 bg-red-50';
    if (syncStatus.isAnySyncing) return 'text-blue-600 bg-blue-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors',
            getStatusColor()
          )}
        >
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-96 p-0" align="end">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Sync Status</h3>
            <div className="flex items-center gap-2">
              <Badge 
                variant={isConnected ? 'default' : 'destructive'}
                className="text-xs"
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refresh()}
                disabled={loading}
              >
                <RefreshCw className={cn(
                  'h-3 w-3',
                  loading && 'animate-spin'
                )} />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-96">
          <div className="p-4 space-y-4">
            {/* Workflow Status */}
            {syncStatus.workflow && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Daily Workflow
                  </h4>
                  <Badge variant={
                    syncStatus.workflow.status === 'completed' ? 'default' :
                    syncStatus.workflow.status === 'in_progress' ? 'secondary' :
                    syncStatus.workflow.status === 'failed' ? 'destructive' :
                    'outline'
                  }>
                    {syncStatus.workflow.status.replace('_', ' ')}
                  </Badge>
                </div>
                
                {syncStatus.workflow.status === 'in_progress' && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600">
                      Feeds: {syncStatus.workflow.progress.feeds.completed}/{syncStatus.workflow.progress.feeds.total}
                    </div>
                    <Progress 
                      value={(syncStatus.workflow.progress.feeds.completed / syncStatus.workflow.progress.feeds.total) * 100} 
                      className="h-2"
                    />
                    
                    {syncStatus.workflow.progress.content.total > 0 && (
                      <>
                        <div className="text-xs text-gray-600">
                          Content: {syncStatus.workflow.progress.content.processed}/{syncStatus.workflow.progress.content.total}
                        </div>
                        <Progress 
                          value={(syncStatus.workflow.progress.content.processed / syncStatus.workflow.progress.content.total) * 100} 
                          className="h-2"
                        />
                      </>
                    )}
                    
                    <div className="flex gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        Analysis: {syncStatus.workflow.progress.analysis}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        Predictions: {syncStatus.workflow.progress.predictions}
                      </div>
                    </div>
                    
                    {syncStatus.workflow.estimatedCompletion && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Est. completion: {formatDistanceToNow(new Date(syncStatus.workflow.estimatedCompletion), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Feed Statuses */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Feed Sources</h4>
              <div className="space-y-1">
                {syncStatus.feeds.map(feed => (
                  <div 
                    key={feed.feedId}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        feed.status === 'syncing' && 'bg-blue-500 animate-pulse',
                        feed.status === 'completed' && 'bg-green-500',
                        feed.status === 'failed' && 'bg-red-500',
                        feed.status === 'idle' && 'bg-gray-300'
                      )} />
                      <span className="text-sm truncate">{feed.feedName}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {feed.status === 'syncing' ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Syncing...
                        </span>
                      ) : feed.lastSyncAt ? (
                        <span>
                          {formatDistanceToNow(new Date(feed.lastSyncAt), { addSuffix: true })}
                        </span>
                      ) : (
                        <span>Never synced</span>
                      )}
                      
                      {feed.itemsProcessed !== undefined && feed.totalItems !== undefined && feed.totalItems > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {feed.itemsProcessed}/{feed.totalItems}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                
                {syncStatus.feeds.length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    No feed sources configured
                  </div>
                )}
              </div>
            </div>

            {/* Last Updated */}
            <div className="text-xs text-gray-500 text-center pt-2 border-t">
              Last updated: {formatDistanceToNow(syncStatus.lastUpdated, { addSuffix: true })}
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};