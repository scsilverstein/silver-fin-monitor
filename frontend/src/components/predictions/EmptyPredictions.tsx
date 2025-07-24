import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { AlertCircle } from 'lucide-react';

interface EmptyPredictionsProps {
  message?: string;
  description?: string;
}

export const EmptyPredictions: React.FC<EmptyPredictionsProps> = ({ 
  message = "No predictions found",
  description = "Try adjusting your filters or generating new predictions"
}) => {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">{message}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};