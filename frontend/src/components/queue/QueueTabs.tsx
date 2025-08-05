import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/Badge';
import QueueItem from './QueueItem';
import { EmptyQueue } from './EmptyQueue';
import { AlertCircle, Clock, CheckCircle, XCircle, RefreshCw, Play } from 'lucide-react';

interface GroupedJob {
  status: string;
  jobs: any[];
  count: number;
  averagePriority: number;
  oldestJob?: Date;
}

interface QueueTabsProps {
  groupedJobs: GroupedJob[];
  getStatusLabel: (status: string) => string;
  getStatusBadgeColor: (status: string) => string;
  onJobDelete: (jobId: string) => void;
  onJobRetry: (jobId: string) => void;
  onJobCancel: (jobId: string) => void;
  onJobReset?: (jobId: string) => void;
}

const getStatusIcon = (status: string) => {
  const iconProps = { className: "w-4 h-4" };
  
  switch (status) {
    case 'pending': return <Clock {...iconProps} />;
    case 'processing': return <Play {...iconProps} />;
    case 'completed': return <CheckCircle {...iconProps} />;
    case 'failed': return <XCircle {...iconProps} />;
    case 'retry': return <RefreshCw {...iconProps} />;
    default: return <AlertCircle {...iconProps} />;
  }
};

export const QueueTabs: React.FC<QueueTabsProps> = ({ 
  groupedJobs, 
  getStatusLabel,
  getStatusBadgeColor,
  onJobDelete,
  onJobRetry,
  onJobCancel,
  onJobReset
}) => {
  const defaultTab = groupedJobs.find(g => g.jobs.length > 0)?.status || 'pending';

  if (groupedJobs.length === 0) {
    return <EmptyQueue message="No jobs in queue" />;
  }

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList className={`grid grid-cols-${Math.min(groupedJobs.length, 5)} w-full`}>
        {groupedJobs.map(group => (
          <TabsTrigger key={group.status} value={group.status} className="text-xs">
            <div className="flex items-center gap-1">
              {getStatusIcon(group.status)}
              <span className="hidden md:inline">{getStatusLabel(group.status)}</span>
              <span className="md:hidden">{group.status.slice(0, 4)}</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {group.count}
              </Badge>
            </div>
          </TabsTrigger>
        ))}
      </TabsList>
      
      {groupedJobs.map(group => (
        <TabsContent key={group.status} value={group.status} className="space-y-4">
          {group.jobs.length === 0 ? (
            <EmptyQueue
              message={`No ${getStatusLabel(group.status).toLowerCase()} jobs`}
              description={`All ${getStatusLabel(group.status).toLowerCase()} jobs have been processed`}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(group.status)}`}>
                  {getStatusIcon(group.status)}
                  <span>{getStatusLabel(group.status)}</span>
                </div>
                <span>Average Priority: {group.averagePriority.toFixed(1)}</span>
                <span>•</span>
                <span>{group.count} jobs</span>
                {group.oldestJob && (
                  <>
                    <span>•</span>
                    <span>Oldest: {group.oldestJob.toLocaleDateString()}</span>
                  </>
                )}
              </div>
              
              <div className="space-y-2">
                {group.jobs.map(job => (
                  <QueueItem
                    key={job.id}
                    job={job}
                    onDelete={() => onJobDelete(job.id)}
                    onRetry={() => onJobRetry(job.id)}
                    onCancel={() => onJobCancel(job.id)}
                    onReset={onJobReset ? () => onJobReset(job.id) : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
};