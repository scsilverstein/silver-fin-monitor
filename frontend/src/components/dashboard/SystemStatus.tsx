import React from 'react';
import { ModernCard, CardHeader, CardTitle, CardContent } from '@/components/ui/ModernCard';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { RealtimeStats } from '@/lib/api';

interface SystemStatusProps {
  stats: RealtimeStats | null;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ stats }) => {
  return (
    <ModernCard variant="glass">
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && stats.queue && stats.transcription && (
          <>
            {/* Queue Status */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Queue Status</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Processing:</span>
                  <ModernBadge variant="warning" size="sm">
                    {stats.queue.processing || 0}
                  </ModernBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending:</span>
                  <ModernBadge variant="secondary" size="sm">
                    {stats.queue.pending || 0}
                  </ModernBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Completed:</span>
                  <ModernBadge variant="success" size="sm">
                    {stats.queue.completed || 0}
                  </ModernBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Failed:</span>
                  <ModernBadge variant="error" size="sm">
                    {stats.queue.failed || 0}
                  </ModernBadge>
                </div>
              </div>
            </div>

            {/* Transcription Status */}
            <div className="pt-2 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2">Transcription</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Processing:</span>
                  <ModernBadge variant="warning" size="sm">
                    {stats.transcription.processing || 0}
                  </ModernBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending:</span>
                  <ModernBadge variant="secondary" size="sm">
                    {stats.transcription.pending || 0}
                  </ModernBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Awaiting:</span>
                  <ModernBadge variant="info" size="sm">
                    {stats.transcription.feedsAwaitingTranscription || 0}
                  </ModernBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {(stats.transcription.failed || 0) > 0 ? 'Failed:' : 'Complete:'}
                  </span>
                  <ModernBadge 
                    variant={(stats.transcription.failed || 0) > 0 ? "error" : "success"} 
                    size="sm"
                  >
                    {(stats.transcription.failed || 0) > 0 ? (stats.transcription.failed || 0) : (stats.transcription.completed || 0)}
                  </ModernBadge>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t text-xs text-muted-foreground">
              Last updated: {new Date(stats.timestamp).toLocaleTimeString()}
            </div>
          </>
        )}
      </CardContent>
    </ModernCard>
  );
};