import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { 
  CheckCircle, 
  Trash2, 
  RotateCcw, 
  Plus 
} from 'lucide-react';

interface QueueActionsProps {
  handleClearCompleted: () => void;
  handleClearFailed: () => void;
  handleRetryAllFailed: () => void;
  handleAddJob: () => void;
}

export const QueueActions: React.FC<QueueActionsProps> = ({
  handleClearCompleted,
  handleClearFailed,
  handleRetryAllFailed,
  handleAddJob
}) => {
  return (
    <ModernCard variant="bordered">
      <CardHeader>
        <CardTitle>Queue Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <ModernButton
            variant="outline"
            onClick={handleClearCompleted}
            className="flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Clear Completed
          </ModernButton>
          
          <ModernButton
            variant="outline"
            onClick={handleClearFailed}
            className="flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Clear Failed
          </ModernButton>
          
          <ModernButton
            variant="outline"
            onClick={handleRetryAllFailed}
            className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
          >
            <RotateCcw className="w-4 h-4" />
            Retry All Failed
          </ModernButton>
          
          <ModernButton
            variant="outline"
            onClick={handleAddJob}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Cleanup Job
          </ModernButton>
        </div>
      </CardContent>
    </ModernCard>
  );
};