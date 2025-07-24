import React from 'react';
import { ModernCard, CardContent } from '@/components/ui/ModernCard';
import { CheckCircle } from 'lucide-react';

interface EmptyQueueProps {
  message?: string;
  description?: string;
}

export const EmptyQueue: React.FC<EmptyQueueProps> = ({ 
  message = "No jobs in queue",
  description = "All jobs have been processed successfully"
}) => {
  return (
    <ModernCard variant="bordered">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <p className="text-lg font-medium">{message}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </ModernCard>
  );
};