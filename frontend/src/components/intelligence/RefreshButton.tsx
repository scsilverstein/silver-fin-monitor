import React from 'react';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  loading: boolean;
  onRefresh: () => void;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({ loading, onRefresh }) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={loading}
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  );
};