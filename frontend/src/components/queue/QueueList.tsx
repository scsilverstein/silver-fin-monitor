import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { 
  CheckCircle, 
  Clock, 
  RotateCcw, 
  Trash2 
} from 'lucide-react';
import { QueueJob, QueueStats } from '@/lib/api';
import QueueItem from '@/components/queue/QueueItem';

interface QueueListProps {
  jobs: QueueJob[];
  stats: QueueStats | null;
  statusFilter: string;
  totalJobs: number;
  currentPage: number;
  totalPages: number;
  onJobDelete: (id: string) => void;
  onJobRetry: (id: string) => void;
  onJobCancel: (id: string) => void;
  onRetryAllFailed: () => void;
  onClearFailed: () => void;
  onPageChange: (page: number) => void;
}

export const QueueList: React.FC<QueueListProps> = ({
  jobs,
  stats,
  statusFilter,
  totalJobs,
  currentPage,
  totalPages,
  onJobDelete,
  onJobRetry,
  onJobCancel,
  onRetryAllFailed,
  onClearFailed,
  onPageChange
}) => {
  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            Jobs ({totalJobs} total)
            {statusFilter === 'failed' && stats && (
              <ModernBadge variant="destructive" className="ml-2">
                {stats.currentQueue.failed} Failed Jobs
              </ModernBadge>
            )}
          </span>
          {statusFilter === 'failed' && (
            <div className="flex gap-2">
              <ModernButton
                variant="outline"
                size="sm"
                onClick={onRetryAllFailed}
                className="text-orange-600 hover:text-orange-700"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Retry All Failed
              </ModernButton>
              <ModernButton
                variant="outline"
                size="sm"
                onClick={onClearFailed}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All Failed
              </ModernButton>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8">
            {statusFilter === 'failed' ? (
              <>
                <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
                <p className="text-muted-foreground">No failed jobs found</p>
                <p className="text-sm text-muted-foreground mt-1">All jobs are running smoothly!</p>
              </>
            ) : (
              <>
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No jobs found</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <QueueItem
                key={job.id}
                job={job}
                onDelete={onJobDelete}
                onRetry={onJobRetry}
                onCancel={onJobCancel}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            
            <div className="flex gap-2">
              <ModernButton
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </ModernButton>
              
              <ModernButton
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </ModernButton>
            </div>
          </div>
        )}
      </CardContent>
    </ModernCard>
  );
};