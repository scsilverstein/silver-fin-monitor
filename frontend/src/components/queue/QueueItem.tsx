import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Trash2, RotateCcw, Play, Square, Clock, AlertCircle } from 'lucide-react';
import { QueueJob } from '@/lib/api';
import { QueueJobLink, SourceLink } from '@/components/navigation/ClickableLinks';
import { formatDistanceToNow } from 'date-fns';

interface QueueItemProps {
  job: QueueJob;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}

const StatusBadge: React.FC<{ status: QueueJob['status'] }> = ({ status }) => {
  const getStatusConfig = (status: QueueJob['status']) => {
    switch (status) {
      case 'pending':
        return { 
          variant: 'secondary' as const, 
          icon: Clock, 
          label: 'Pending',
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'processing':
        return { 
          variant: 'default' as const, 
          icon: Play, 
          label: 'Processing',
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'completed':
        return { 
          variant: 'default' as const, 
          icon: Square, 
          label: 'Completed',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      case 'failed':
        return { 
          variant: 'destructive' as const, 
          icon: AlertCircle, 
          label: 'Failed',
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      case 'retry':
        return { 
          variant: 'secondary' as const, 
          icon: RotateCcw, 
          label: 'Retrying',
          className: 'bg-orange-100 text-orange-800 border-orange-200'
        };
      default:
        return { 
          variant: 'secondary' as const, 
          icon: Clock, 
          label: status,
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};

const PriorityBadge: React.FC<{ priority: number }> = ({ priority }) => {
  const getPriorityConfig = (priority: number) => {
    if (priority <= 2) return { label: 'High', className: 'bg-red-50 text-red-700' };
    if (priority <= 5) return { label: 'Medium', className: 'bg-yellow-50 text-yellow-700' };
    return { label: 'Low', className: 'bg-gray-50 text-gray-700' };
  };

  const config = getPriorityConfig(priority);
  
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
};

const QueueItem: React.FC<QueueItemProps> = ({ job, onDelete, onRetry, onCancel }) => {
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  };

  const getJobTypeDisplayName = (jobType: string) => {
    switch (jobType) {
      case 'feed_fetch':
        return 'Feed Fetch';
      case 'content_process':
        return 'Content Processing';
      case 'daily_analysis':
        return 'Daily Analysis';
      case 'prediction_comparison':
        return 'Prediction Comparison';
      case 'cleanup':
        return 'Cleanup';
      default:
        return jobType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const canRetry = job.status === 'failed';
  const canCancel = job.status === 'pending' || job.status === 'retry';
  const canDelete = job.status === 'completed' || job.status === 'failed';

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">
              {getJobTypeDisplayName(job.jobType)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <StatusBadge status={job.status} />
              <PriorityBadge priority={job.priority} />
              <span className="text-xs text-gray-500">
                ID: {job.id.slice(0, 8)}...
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {canRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetry(job.id)}
                className="h-7 px-2"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCancel(job.id)}
                className="h-7 px-2 text-orange-600 hover:text-orange-700"
              >
                <Square className="w-3 h-3" />
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(job.id)}
                className="h-7 px-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Job Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Attempts:</span>
            <span className="ml-1 font-medium">
              {job.attempts} / {job.maxAttempts}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Priority:</span>
            <span className="ml-1 font-medium">{job.priority}</span>
          </div>
        </div>

        {/* Timestamps */}
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{formatDate(job.createdAt)}</span>
          </div>
          {job.scheduledAt && (
            <div className="flex justify-between">
              <span>Scheduled:</span>
              <span>{formatDate(job.scheduledAt)}</span>
            </div>
          )}
          {job.startedAt && (
            <div className="flex justify-between">
              <span>Started:</span>
              <span>{formatDate(job.startedAt)}</span>
            </div>
          )}
          {job.completedAt && (
            <div className="flex justify-between">
              <span>Completed:</span>
              <span>{formatDate(job.completedAt)}</span>
            </div>
          )}
        </div>

        {/* Related Links */}
        {job.payload && (
          <div className="mt-3">
            {(job.payload.sourceId || job.payload.feedId) && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">Related:</span>
                <SourceLink 
                  sourceId={job.payload.sourceId || job.payload.feedId}
                  sourceName={job.payload.sourceName || job.payload.feedName || 'Source'}
                  size="sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Payload */}
        {job.payload && Object.keys(job.payload).length > 0 && (
          <div className="mt-3">
            <details className="group">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Payload Details
              </summary>
              <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Error Message */}
        {job.errorMessage && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
            <div className="text-xs text-red-600 font-medium mb-1">Error:</div>
            <div className="text-xs text-red-700">{job.errorMessage}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QueueItem;