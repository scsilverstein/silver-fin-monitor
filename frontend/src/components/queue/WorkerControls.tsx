import React, { useState, useEffect } from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Activity,
  Zap,
  AlertCircle
} from 'lucide-react';
import { queueApi } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface WorkerStatus {
  isRunning: boolean;
  concurrency: number;
  activeJobs: number;
  activeJobIds: string[];
  workerCount: number;
}

export const WorkerControls: React.FC = () => {
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const toast = useToast();

  const fetchWorkerStatus = async () => {
    try {
      setIsLoading(true);
      const workerStatus = await queueApi.getWorkerStatus();
      console.log('Worker status fetched:', workerStatus);
      setWorkerStatus(workerStatus);
    } catch (error: any) {
      console.error('Failed to fetch worker status:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to fetch worker status';
      toast.error(errorMessage);
      // Set a default status to prevent rendering issues
      setWorkerStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkerAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      setActionLoading(action);
      
      let response;
      switch (action) {
        case 'start':
          response = await queueApi.startWorker();
          break;
        case 'stop':
          response = await queueApi.stopWorker();
          break;
        case 'restart':
          response = await queueApi.restartWorker();
          break;
      }
      
      // Log the response to debug
      console.log(`Worker ${action} response:`, response);
      
      // Ensure we're accessing the message property correctly
      const message = response?.message || `Worker ${action}ed successfully`;
      toast.success(message);
      
      // Fetch fresh status after a short delay
      setTimeout(fetchWorkerStatus, 1000);
    } catch (error: any) {
      console.error(`Failed to ${action} worker:`, error);
      // Safely access error message
      const errorMessage = error?.response?.data?.error || error?.message || `Failed to ${action} worker`;
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchWorkerStatus();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchWorkerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (!workerStatus) return 'gray';
    return workerStatus.isRunning ? 'green' : 'red';
  };

  const getStatusText = () => {
    if (!workerStatus) return 'Unknown';
    return workerStatus.isRunning ? 'Running' : 'Stopped';
  };

  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Queue Worker Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Worker Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Status:</span>
              <Badge 
                variant={workerStatus?.isRunning ? 'success' : 'destructive'}
                className="flex items-center gap-1"
              >
                {workerStatus?.isRunning ? (
                  <Activity className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {getStatusText()}
              </Badge>
            </div>
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={fetchWorkerStatus}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </ModernButton>
          </div>

          {/* Worker Stats */}
          {workerStatus && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {workerStatus.concurrency}
                </div>
                <div className="text-xs text-gray-600">Max Concurrent</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {workerStatus.activeJobs}
                </div>
                <div className="text-xs text-gray-600">Active Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  {workerStatus.workerCount}
                </div>
                <div className="text-xs text-gray-600">Workers</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-600">
                  {workerStatus.activeJobIds.length}
                </div>
                <div className="text-xs text-gray-600">Tracked Jobs</div>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-2">
            <ModernButton
              variant={workerStatus?.isRunning ? 'ghost' : 'default'}
              onClick={() => handleWorkerAction('start')}
              disabled={actionLoading !== null || workerStatus?.isRunning}
              className="flex items-center gap-2"
            >
              {actionLoading === 'start' ? (
                <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Start Worker
            </ModernButton>

            <ModernButton
              variant={workerStatus?.isRunning ? 'destructive' : 'ghost'}
              onClick={() => handleWorkerAction('stop')}
              disabled={actionLoading !== null || !workerStatus?.isRunning}
              className="flex items-center gap-2"
            >
              {actionLoading === 'stop' ? (
                <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Stop Worker
            </ModernButton>

            <ModernButton
              variant="outline"
              onClick={() => handleWorkerAction('restart')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2"
            >
              {actionLoading === 'restart' ? (
                <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Restart Worker
            </ModernButton>
          </div>

          {/* Active Jobs List */}
          {workerStatus && workerStatus.activeJobIds.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Active Jobs:</h4>
              <div className="flex flex-wrap gap-1">
                {workerStatus.activeJobIds.map((jobId) => (
                  <Badge key={jobId} variant="secondary" className="text-xs">
                    {jobId.substring(0, 8)}...
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Concurrency Info */}
          <div className="text-xs text-gray-500 mt-2">
            <Zap className="w-3 h-3 inline mr-1" />
            Concurrent processing allows up to {workerStatus?.concurrency || '?'} jobs to run simultaneously
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );
};