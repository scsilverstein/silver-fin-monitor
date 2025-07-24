import React from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { Activity, RefreshCw } from 'lucide-react';

interface QueueHeaderProps {
  autoRefresh: boolean;
  refreshing: boolean;
  onAutoRefreshToggle: () => void;
  onRefresh: () => void;
}

export const QueueHeader: React.FC<QueueHeaderProps> = ({
  autoRefresh,
  refreshing,
  onAutoRefreshToggle,
  onRefresh
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-display font-bold text-gradient">
          Queue Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitor and manage background job processing
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <ModernButton
          variant="outline"
          size="sm"
          onClick={onAutoRefreshToggle}
          className={autoRefresh ? 'bg-green-50 border-green-200 dark:bg-green-950/30' : ''}
        >
          <Activity className="w-4 h-4 mr-2" />
          Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
        </ModernButton>
        
        <ModernButton
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </ModernButton>
      </div>
    </div>
  );
};