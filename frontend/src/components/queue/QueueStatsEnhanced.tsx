import React from 'react';
import { ModernCard, CardContent } from '@/components/ui/ModernCard';
import { Clock, Play, CheckCircle, XCircle, RefreshCw, BarChart3 } from 'lucide-react';

interface QueueStatsEnhancedProps {
  stats: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retry: number;
    averagePriority: number;
  };
  onStatusClick?: (status: string) => void;
}

export const QueueStatsEnhanced: React.FC<QueueStatsEnhancedProps> = ({ 
  stats, 
  onStatusClick 
}) => {
  const statCards = [
    {
      label: 'Total Jobs',
      value: stats.total,
      icon: <BarChart3 className="w-5 h-5 text-blue-500" />,
      color: 'text-blue-600',
      status: 'all'
    },
    {
      label: 'Pending',
      value: stats.pending,
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      color: 'text-blue-600',
      status: 'pending'
    },
    {
      label: 'Processing',
      value: stats.processing,
      icon: <Play className="w-5 h-5 text-yellow-500" />,
      color: 'text-yellow-600',
      status: 'processing'
    },
    {
      label: 'Completed',
      value: stats.completed,
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      color: 'text-green-600',
      status: 'completed'
    },
    {
      label: 'Failed',
      value: stats.failed,
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      color: 'text-red-600',
      status: 'failed'
    },
    {
      label: 'Retrying',
      value: stats.retry,
      icon: <RefreshCw className="w-5 h-5 text-orange-500" />,
      color: 'text-orange-600',
      status: 'retry'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statCards.map((stat) => (
        <ModernCard 
          key={stat.status}
          variant="bordered" 
          className={`${onStatusClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
          onClick={() => onStatusClick && stat.status !== 'all' && onStatusClick(stat.status)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {stat.icon}
              <div>
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </div>
          </CardContent>
        </ModernCard>
      ))}
      
      {/* Average Priority Card */}
      <ModernCard variant="glass" className="md:col-span-2 lg:col-span-1">
        <CardContent className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {stats.averagePriority.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg Priority
            </p>
          </div>
        </CardContent>
      </ModernCard>
    </div>
  );
};