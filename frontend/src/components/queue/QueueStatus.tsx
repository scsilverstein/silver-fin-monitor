import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { Activity, Play, Pause } from 'lucide-react';
import { QueueStatus as QueueStatusType } from '@/lib/api';

interface QueueStatusProps {
  status: QueueStatusType;
  onPauseResume: (isProcessing: boolean) => void;
}

export const QueueStatus: React.FC<QueueStatusProps> = ({
  status,
  onPauseResume
}) => {
  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Queue Status
          <ModernBadge variant={status?.isProcessing ? 'default' : 'secondary'}>
            {status?.isProcessing ? 'Processing' : 'Paused'}
          </ModernBadge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <ModernButton
            onClick={() => onPauseResume(status?.isProcessing)}
            variant={status?.isProcessing ? 'destructive' : 'default'}
            className="flex items-center gap-2"
          >
            {status?.isProcessing ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {status?.isProcessing ? 'Pause Queue' : 'Resume Queue'}
          </ModernButton>
          
          <div className="text-sm text-muted-foreground">
            Last updated: {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'N/A'}
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );
};