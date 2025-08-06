import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  feedsApi, 
  analysisApi, 
  predictionsApi, 
  queueApi,
  dashboardApi 
} from '@/lib/api';
import {
  ModernCard,
  CardContent,
  CardHeader,
  CardTitle,
  ModernButton,
  ModernBadge,
  ModernInput
} from '@/components/ui';
import { 
  Play, 
  RefreshCw, 
  Brain, 
  TrendingUp, 
  FileText, 
  Database,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface ProcessStatus {
  isRunning: boolean;
  lastRun?: string;
  nextRun?: string;
  message?: string;
}

export const ProcessControl: React.FC = () => {
  const queryClient = useQueryClient();
  const [processStatuses, setProcessStatuses] = useState<Record<string, ProcessStatus>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [daysBack, setDaysBack] = useState(7);

  // Get queue stats for monitoring
  const { data: queueStats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: queueApi.getStats,
    refetchInterval: 5000
  });

  // Get latest analysis info
  const { data: latestAnalysis } = useQuery({
    queryKey: ['analysis-latest'],
    queryFn: analysisApi.getLatest
  });

  // Get dashboard stats
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats
  });

  // Manual trigger mutations
  const feedProcessingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/.netlify/functions/trigger-feed-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to trigger feed processing');
      return response.json();
    },
    onMutate: () => {
      setProcessStatuses(prev => ({
        ...prev,
        feedProcessing: { isRunning: true, message: 'Triggering feed processing...' }
      }));
    },
    onSuccess: (data) => {
      toast.success(`Feed processing started: ${data.stats?.enqueued || 0} feeds queued`);
      setProcessStatuses(prev => ({
        ...prev,
        feedProcessing: { 
          isRunning: false, 
          lastRun: new Date().toISOString(),
          message: `${data.stats?.enqueued || 0} feeds queued for processing`
        }
      }));
    },
    onError: (error) => {
      toast.error('Failed to trigger feed processing');
      setProcessStatuses(prev => ({
        ...prev,
        feedProcessing: { isRunning: false, message: 'Failed to trigger' }
      }));
    }
  });

  const dailyAnalysisMutation = useMutation({
    mutationFn: (date?: string) => analysisApi.generate(date),
    onMutate: () => {
      setProcessStatuses(prev => ({
        ...prev,
        dailyAnalysis: { isRunning: true, message: 'Generating daily analysis...' }
      }));
    },
    onSuccess: (data) => {
      toast.success('Daily analysis generation started');
      setProcessStatuses(prev => ({
        ...prev,
        dailyAnalysis: { 
          isRunning: false, 
          lastRun: new Date().toISOString(),
          message: `Analysis job ${data.jobId} queued`
        }
      }));
    },
    onError: (error) => {
      toast.error('Failed to generate daily analysis');
      setProcessStatuses(prev => ({
        ...prev,
        dailyAnalysis: { isRunning: false, message: 'Failed to generate' }
      }));
    }
  });

  const predictionGenerationMutation = useMutation({
    mutationFn: async () => {
      if (!latestAnalysis?.id) {
        throw new Error('No analysis available to generate predictions from');
      }
      return predictionsApi.generate(latestAnalysis.id);
    },
    onMutate: () => {
      setProcessStatuses(prev => ({
        ...prev,
        predictions: { isRunning: true, message: 'Generating predictions...' }
      }));
    },
    onSuccess: (data) => {
      toast.success('Prediction generation started');
      setProcessStatuses(prev => ({
        ...prev,
        predictions: { 
          isRunning: false, 
          lastRun: new Date().toISOString(),
          message: `Predictions job ${data.jobId} queued`
        }
      }));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to generate predictions');
      setProcessStatuses(prev => ({
        ...prev,
        predictions: { isRunning: false, message: 'Failed to generate' }
      }));
    }
  });

  const historicalBackfillMutation = useMutation({
    mutationFn: (options: { daysBack: number; forceRefetch?: boolean; generatePredictions?: boolean; generateAnalysis?: boolean }) => 
      feedsApi.startHistoricalBackfill(options),
    onMutate: () => {
      setProcessStatuses(prev => ({
        ...prev,
        backfill: { isRunning: true, message: 'Starting historical backfill...' }
      }));
    },
    onSuccess: (data) => {
      toast.success(`Historical backfill started: ${data.jobsQueued} jobs queued`);
      setProcessStatuses(prev => ({
        ...prev,
        backfill: { 
          isRunning: false, 
          lastRun: new Date().toISOString(),
          message: `${data.jobsQueued} jobs queued for backfill`
        }
      }));
    },
    onError: (error) => {
      toast.error('Failed to start historical backfill');
      setProcessStatuses(prev => ({
        ...prev,
        backfill: { isRunning: false, message: 'Failed to start' }
      }));
    }
  });

  const queueWorkerMutation = useMutation({
    mutationFn: async (action: 'start' | 'stop' | 'restart') => {
      switch (action) {
        case 'start':
          return queueApi.startWorker();
        case 'stop':
          return queueApi.stopWorker();
        case 'restart':
          return queueApi.restartWorker();
      }
    },
    onSuccess: (data, action) => {
      toast.success(`Queue worker ${action}ed successfully`);
    },
    onError: (error, action) => {
      toast.error(`Failed to ${action} queue worker`);
    }
  });

  const retryFailedJobsMutation = useMutation({
    mutationFn: () => queueApi.retryAllFailed(),
    onSuccess: (data) => {
      toast.success(`Retrying ${data.retriedCount} failed jobs`);
    },
    onError: () => {
      toast.error('Failed to retry failed jobs');
    }
  });

  const clearJobsMutation = useMutation({
    mutationFn: (status: 'completed' | 'failed') => {
      return status === 'completed' 
        ? queueApi.clearCompleted(1)
        : queueApi.clearFailed(1);
    },
    onSuccess: (data, status) => {
      toast.success(`Cleared ${data.deletedCount} ${status} jobs`);
    },
    onError: (error, status) => {
      toast.error(`Failed to clear ${status} jobs`);
    }
  });

  const processQueueJobsMutation = useMutation({
    mutationFn: async (maxJobs: number = 20) => {
      const response = await fetch('/.netlify/functions/process-queue-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxJobs })
      });
      if (!response.ok) throw new Error('Failed to process queue jobs');
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Processed ${data.data?.processed || 0} jobs`);
      // Refetch queue stats
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (error) => {
      toast.error('Failed to process queue jobs');
    }
  });

  // Helper to get process status icon
  const getStatusIcon = (status?: ProcessStatus) => {
    if (!status) return <Clock className="h-5 w-5 text-gray-400" />;
    if (status.isRunning) return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    if (status.message?.includes('Failed')) return <AlertCircle className="h-5 w-5 text-red-500" />;
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  // Calculate queue health
  const queueHealth = queueStats ? {
    total: (queueStats.currentQueue?.pending || 0) + 
           (queueStats.currentQueue?.processing || 0) + 
           (queueStats.currentQueue?.completed || 0) + 
           (queueStats.currentQueue?.failed || 0),
    healthy: (queueStats.currentQueue?.failed || 0) < 10 && 
             (queueStats.currentQueue?.processing || 0) < 50
  } : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Process Control</h1>
        <p className="text-muted-foreground">
          Manually trigger and monitor system processes
        </p>
      </div>

      {/* System Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <ModernCard>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Queue Status</p>
                <p className="text-2xl font-bold">
                  {queueStats?.currentQueue?.processing || 0} Active
                </p>
                <p className="text-xs text-muted-foreground">
                  {queueStats?.currentQueue?.pending || 0} pending
                </p>
              </div>
              <Activity className={`h-8 w-8 ${queueHealth?.healthy ? 'text-green-500' : 'text-orange-500'}`} />
            </div>
          </CardContent>
        </ModernCard>

        <ModernCard>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Latest Analysis</p>
                <p className="text-2xl font-bold">
                  {latestAnalysis ? formatDate(latestAnalysis.createdAt) : 'None'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {latestAnalysis?.marketSentiment || 'No data'}
                </p>
              </div>
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </ModernCard>

        <ModernCard>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed Jobs</p>
                <p className="text-2xl font-bold">
                  {queueStats?.currentQueue?.failed || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {queueStats?.currentQueue?.retry || 0} retrying
                </p>
              </div>
              <AlertCircle className={`h-8 w-8 ${(queueStats?.currentQueue?.failed || 0) > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </ModernCard>

        <ModernCard>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processing Status</p>
                <p className="text-2xl font-bold">
                  {dashboardStats?.processing?.processing || 0} Active
                </p>
                <p className="text-xs text-muted-foreground">
                  {dashboardStats?.processing?.completed || 0} today
                </p>
              </div>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </ModernCard>
      </div>

      {/* Main Process Controls */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Feed Processing */}
        <ModernCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Feed Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Fetch and process latest content from all active feed sources
            </p>
            <div className="flex items-center gap-2">
              <ModernButton
                onClick={() => feedProcessingMutation.mutate()}
                disabled={feedProcessingMutation.isPending}
                className="flex-1"
              >
                {feedProcessingMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Process All Feeds
                  </>
                )}
              </ModernButton>
              {getStatusIcon(processStatuses.feedProcessing)}
            </div>
            {processStatuses.feedProcessing?.message && (
              <p className="text-xs text-muted-foreground">
                {processStatuses.feedProcessing.message}
              </p>
            )}
          </CardContent>
        </ModernCard>

        {/* Daily Analysis */}
        <ModernCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Daily Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate AI-powered market analysis from processed content
            </p>
            <div className="space-y-2">
              <ModernInput
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <div className="flex items-center gap-2">
                <ModernButton
                  onClick={() => dailyAnalysisMutation.mutate(selectedDate)}
                  disabled={dailyAnalysisMutation.isPending}
                  className="flex-1"
                >
                  {dailyAnalysisMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Generate Analysis
                    </>
                  )}
                </ModernButton>
                {getStatusIcon(processStatuses.dailyAnalysis)}
              </div>
            </div>
            {processStatuses.dailyAnalysis?.message && (
              <p className="text-xs text-muted-foreground">
                {processStatuses.dailyAnalysis.message}
              </p>
            )}
          </CardContent>
        </ModernCard>

        {/* Predictions */}
        <ModernCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Predictions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate market predictions based on the latest analysis
            </p>
            <div className="flex items-center gap-2">
              <ModernButton
                onClick={() => predictionGenerationMutation.mutate()}
                disabled={predictionGenerationMutation.isPending || !latestAnalysis}
                className="flex-1"
              >
                {predictionGenerationMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Generate Predictions
                  </>
                )}
              </ModernButton>
              {getStatusIcon(processStatuses.predictions)}
            </div>
            {!latestAnalysis && (
              <p className="text-xs text-orange-600">
                No analysis available. Generate daily analysis first.
              </p>
            )}
            {processStatuses.predictions?.message && (
              <p className="text-xs text-muted-foreground">
                {processStatuses.predictions.message}
              </p>
            )}
          </CardContent>
        </ModernCard>

        {/* Historical Backfill */}
        <ModernCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Historical Backfill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Process historical data and generate analysis for past dates
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ModernInput
                  type="number"
                  value={daysBack}
                  onChange={(e) => setDaysBack(parseInt(e.target.value) || 7)}
                  min={1}
                  max={30}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days back</span>
              </div>
              <div className="flex items-center gap-2">
                <ModernButton
                  onClick={() => historicalBackfillMutation.mutate({
                    daysBack,
                    forceRefetch: false,
                    generatePredictions: true,
                    generateAnalysis: true
                  })}
                  disabled={historicalBackfillMutation.isPending}
                  className="flex-1"
                >
                  {historicalBackfillMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Start Backfill
                    </>
                  )}
                </ModernButton>
                {getStatusIcon(processStatuses.backfill)}
              </div>
            </div>
            {processStatuses.backfill?.message && (
              <p className="text-xs text-muted-foreground">
                {processStatuses.backfill.message}
              </p>
            )}
          </CardContent>
        </ModernCard>
      </div>

      {/* Queue Management */}
      <ModernCard>
        <CardHeader>
          <CardTitle>Queue Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Process Jobs */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Process Jobs</h4>
              <ModernButton
                size="sm"
                variant="primary"
                onClick={() => processQueueJobsMutation.mutate(20)}
                disabled={processQueueJobsMutation.isPending || (queueStats?.currentQueue?.pending || 0) === 0}
              >
                {processQueueJobsMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Process {Math.min(queueStats?.currentQueue?.pending || 0, 20)} Jobs
                  </>
                )}
              </ModernButton>
            </div>

            {/* Worker Control */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Worker Control</h4>
              <div className="flex gap-2">
                <ModernButton
                  size="sm"
                  variant="outline"
                  onClick={() => queueWorkerMutation.mutate('start')}
                  disabled={queueWorkerMutation.isPending}
                >
                  Start
                </ModernButton>
                <ModernButton
                  size="sm"
                  variant="outline"
                  onClick={() => queueWorkerMutation.mutate('stop')}
                  disabled={queueWorkerMutation.isPending}
                >
                  Stop
                </ModernButton>
                <ModernButton
                  size="sm"
                  variant="outline"
                  onClick={() => queueWorkerMutation.mutate('restart')}
                  disabled={queueWorkerMutation.isPending}
                >
                  Restart
                </ModernButton>
              </div>
            </div>

            {/* Job Management */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Failed Jobs</h4>
              <div className="flex gap-2">
                <ModernButton
                  size="sm"
                  variant="outline"
                  onClick={() => retryFailedJobsMutation.mutate()}
                  disabled={retryFailedJobsMutation.isPending || (queueStats?.currentQueue?.failed || 0) === 0}
                >
                  Retry All
                </ModernButton>
                <ModernButton
                  size="sm"
                  variant="outline"
                  onClick={() => clearJobsMutation.mutate('failed')}
                  disabled={clearJobsMutation.isPending || (queueStats?.currentQueue?.failed || 0) === 0}
                >
                  Clear Failed
                </ModernButton>
              </div>
            </div>

            {/* Cleanup */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Cleanup</h4>
              <div className="flex gap-2">
                <ModernButton
                  size="sm"
                  variant="outline"
                  onClick={() => clearJobsMutation.mutate('completed')}
                  disabled={clearJobsMutation.isPending}
                >
                  Clear Completed
                </ModernButton>
              </div>
            </div>
          </div>
        </CardContent>
      </ModernCard>

      {/* Current Queue Stats */}
      {queueStats && (
        <ModernCard>
          <CardHeader>
            <CardTitle>Current Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {queueStats.currentQueue?.pending || 0}
                </p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {queueStats.currentQueue?.processing || 0}
                </p>
                <p className="text-sm text-muted-foreground">Processing</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {queueStats.currentQueue?.completed || 0}
                </p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {queueStats.currentQueue?.failed || 0}
                </p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {queueStats.currentQueue?.retry || 0}
                </p>
                <p className="text-sm text-muted-foreground">Retry</p>
              </div>
            </div>
          </CardContent>
        </ModernCard>
      )}
    </div>
  );
};