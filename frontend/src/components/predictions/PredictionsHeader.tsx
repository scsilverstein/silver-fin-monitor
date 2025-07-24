import React from 'react';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Download, Activity } from 'lucide-react';

interface PredictionsHeaderProps {
  loading: boolean;
  generating: boolean;
  hasLatestAnalysis: boolean;
  hasPredictions: boolean;
  onRefresh: () => void;
  onExport: () => void;
  onGenerate: () => void;
}

export const PredictionsHeader: React.FC<PredictionsHeaderProps> = ({
  loading,
  generating,
  hasLatestAnalysis,
  hasPredictions,
  onRefresh,
  onExport,
  onGenerate
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Market Predictions</h1>
        <p className="text-muted-foreground mt-1">
          AI-generated predictions across multiple time horizons
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button 
          variant="outline"
          onClick={onExport}
          disabled={!hasPredictions}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button 
          onClick={onGenerate}
          disabled={generating || !hasLatestAnalysis}
        >
          {generating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Activity className="h-4 w-4 mr-2" />
              Generate New
            </>
          )}
        </Button>
      </div>
    </div>
  );
};