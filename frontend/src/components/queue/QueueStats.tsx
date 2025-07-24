import React from 'react';
import { ModernCard, CardContent, MetricCard } from '@/components/ui/ModernCard';
import { GridLayout } from '@/components/layout';
import { 
  Clock, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  RotateCcw, 
  Activity
} from 'lucide-react';
import { QueueStats as QueueStatsType } from '@/lib/api';
import { QueueStatus } from '@/components/queue/QueueStatus';

interface QueueStatsProps {
  stats: QueueStatsType;
  status: QueueStatusType;
  onFailedClick: () => void;
}

export const QueueStats: React.FC<QueueStatsProps> = ({
  stats,
  status,
  onFailedClick
}) => {
  return (
    <GridLayout columns={3} gap="sm" >
      <QueueStatus
        title="Queue Status"
        value={status}
        icon={<Activity className="w-5 h-5 text-blue-500" />}
        description="Current queue status"
      />
      <MetricCard
        title="Pending"
        value={stats.currentQueue.pending.toString()}
        icon={<Clock className="w-5 h-5 text-blue-500" />}
        description="Waiting to process"
      />

      <MetricCard
        title="Processing"
        value={stats.currentQueue.processing.toString()}
        icon={<Play className="w-5 h-5 text-green-500" />}
        description="Currently active"
      />

      <MetricCard
        title="Completed"
        value={stats.currentQueue.completed.toString()}
        icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
        description="Successfully finished"
      />

      <ModernCard 
        variant="bordered"
        className={`cursor-pointer transition-colors ${
          stats.currentQueue.failed > 0 
            ? 'hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800' 
            : ''
        }`}
        onClick={() => stats.currentQueue.failed > 0 && onFailedClick()}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.currentQueue.failed}
                {stats.currentQueue.failed > 0 && (
                  <span className="text-xs ml-1 text-red-500">⚠️</span>
                )}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          {stats.currentQueue.failed > 0 && (
            <p className="text-xs text-red-500 mt-1">Click to view failed jobs</p>
          )}
        </CardContent>
      </ModernCard>

      <MetricCard
        title="Retrying"
        value={stats.currentQueue.retry.toString()}
        icon={<RotateCcw className="w-5 h-5 text-orange-500" />}
        description="Attempting retry"
      />
    </GridLayout>
  );
};