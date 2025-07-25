import React, { useState, useEffect } from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { 
  Mic, 
  Play, 
  Square, 
  RotateCcw, 
  Activity, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { whisperApi, WhisperStatus } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface WhisperServiceStatusProps {
  className?: string;
}

export const WhisperServiceStatus: React.FC<WhisperServiceStatusProps> = ({ className }) => {
  const [status, setStatus] = useState<WhisperStatus | null>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const [whisperStatus, transcriptionQueue] = await Promise.all([
        whisperApi.getStatus().catch(() => ({ isRunning: false })),
        whisperApi.getTranscriptionQueue().catch(() => ({ pending: 0, processing: 0, completed: 0, failed: 0 }))
      ]);
      setStatus(whisperStatus);
      setQueueStatus(transcriptionQueue);
    } catch (error) {
      console.error('Failed to fetch Whisper status:', error);
      setStatus({ isRunning: false });
      setQueueStatus({ pending: 0, processing: 0, completed: 0, failed: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      setActionLoading(action);
      let result;
      
      switch (action) {
        case 'start':
          result = await whisperApi.start();
          toast.success('Whisper service started');
          break;
        case 'stop':
          result = await whisperApi.stop();
          toast.success('Whisper service stopped');
          break;
        case 'restart':
          result = await whisperApi.restart();
          toast.success('Whisper service restarted');
          break;
      }
      
      console.log('Whisper action result:', result);
      
      // Refresh status after action
      setTimeout(fetchStatus, 2000);
    } catch (error: any) {
      console.error(`Failed to ${action} Whisper service:`, error);
      toast.error(error.response?.data?.error?.message || `Failed to ${action} Whisper service`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = () => {
    if (loading) {
      return (
        <ModernBadge variant="secondary">
          <Activity className="h-3 w-3 mr-1 animate-pulse" />
          Checking...
        </ModernBadge>
      );
    }

    if (!status) {
      return (
        <ModernBadge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Unknown
        </ModernBadge>
      );
    }

    if (status.isRunning) {
      return (
        <ModernBadge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Running
        </ModernBadge>
      );
    } else {
      return (
        <ModernBadge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Stopped
        </ModernBadge>
      );
    }
  };

  const getQueueStatusIndicator = () => {
    if (!queueStatus) return null;

    const { pending, processing, failed } = queueStatus;
    
    if (processing > 0) {
      return (
        <ModernBadge variant="default" className="bg-blue-100 text-blue-800">
          <Activity className="h-3 w-3 mr-1 animate-spin" />
          Processing {processing}
        </ModernBadge>
      );
    }

    if (pending > 0) {
      return (
        <ModernBadge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          {pending} Pending
        </ModernBadge>
      );
    }

    if (failed > 0) {
      return (
        <ModernBadge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {failed} Failed
        </ModernBadge>
      );
    }

    return (
      <ModernBadge variant="secondary">
        <CheckCircle className="h-3 w-3 mr-1" />
        Idle
      </ModernBadge>
    );
  };

  return (
    <ModernCard className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base">Whisper Service</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {getQueueStatusIndicator()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Service Info */}
        {status && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {status.modelLoaded && (
              <div>
                <span className="text-gray-500">Model:</span>
                <span className="ml-1 font-medium">{status.modelLoaded}</span>
              </div>
            )}
            {status.totalTranscriptions && (
              <div>
                <span className="text-gray-500">Total:</span>
                <span className="ml-1 font-medium">{status.totalTranscriptions}</span>
              </div>
            )}
            {status.averageProcessingTime && (
              <div>
                <span className="text-gray-500">Avg Time:</span>
                <span className="ml-1 font-medium">{Math.round(status.averageProcessingTime)}s</span>
              </div>
            )}
            {status.lastUsed && (
              <div>
                <span className="text-gray-500">Last Used:</span>
                <span className="ml-1 font-medium">
                  {new Date(status.lastUsed).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Queue Info */}
        {queueStatus && (
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center p-2 bg-yellow-50 rounded">
              <div className="font-medium text-yellow-800">{queueStatus?.pending || 0}</div>
              <div className="text-yellow-600">Pending</div>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="font-medium text-blue-800">{queueStatus?.processing || 0}</div>
              <div className="text-blue-600">Processing</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="font-medium text-green-800">{queueStatus?.completed || 0}</div>
              <div className="text-green-600">Completed</div>
            </div>
            <div className="text-center p-2 bg-red-50 rounded">
              <div className="font-medium text-red-800">{queueStatus?.failed || 0}</div>
              <div className="text-red-600">Failed</div>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {!status?.isRunning ? (
            <ModernButton
              variant="default"
              size="sm"
              onClick={() => handleAction('start')}
              disabled={actionLoading === 'start'}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-1" />
              {actionLoading === 'start' ? 'Starting...' : 'Start Service'}
            </ModernButton>
          ) : (
            <ModernButton
              variant="outline"
              size="sm"
              onClick={() => handleAction('stop')}
              disabled={actionLoading === 'stop'}
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-1" />
              {actionLoading === 'stop' ? 'Stopping...' : 'Stop Service'}
            </ModernButton>
          )}

          <ModernButton
            variant="outline"
            size="sm"
            onClick={() => handleAction('restart')}
            disabled={actionLoading === 'restart'}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
          </ModernButton>

          <ModernButton
            variant="ghost"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
          >
            <Activity className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </ModernButton>
        </div>

        {/* Warning for stopped service */}
        {status && !status.isRunning && (
          <div className="p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
            ⚠️ Whisper service is stopped. Audio transcription will not work until started.
          </div>
        )}
      </CardContent>
    </ModernCard>
  );
};