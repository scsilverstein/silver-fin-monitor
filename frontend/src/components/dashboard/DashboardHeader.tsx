import React from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { RefreshCw, Brain } from 'lucide-react';

interface DashboardHeaderProps {
  refreshing: boolean;
  generatingAnalysis: boolean;
  onRefresh: () => void;
  onGenerateAnalysis: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  refreshing,
  generatingAnalysis,
  onRefresh,
  onGenerateAnalysis
}) => {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-display font-bold text-gradient">
          Market Intelligence Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Real-time insights powered by AI analysis
        </p>
      </div>
      
      <div className="flex gap-3">
        <ModernButton 
          variant="outline" 
          icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={onRefresh}
          disabled={refreshing}
        >
          Refresh
        </ModernButton>
        <ModernButton 
          variant="gradient" 
          icon={<Brain className="h-4 w-4" />}
          onClick={onGenerateAnalysis}
          disabled={generatingAnalysis}
        >
          {generatingAnalysis ? 'Generating...' : 'Generate Report'}
        </ModernButton>
      </div>
    </div>
  );
};