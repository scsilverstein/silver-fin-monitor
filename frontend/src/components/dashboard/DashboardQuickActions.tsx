import React from 'react';
import { FeatureCard } from '@/components/ui/ModernCard';
import { Brain, Sparkles, Target, Globe } from 'lucide-react';

interface QuickActionsProps {
  generatingAnalysis: boolean;
  generatingPredictions: boolean;
  onGenerateAnalysis: () => void;
  onGeneratePredictions: () => void;
  onDebugPredictions: () => void;
}

export const DashboardQuickActions: React.FC<QuickActionsProps> = ({
  generatingAnalysis,
  generatingPredictions,
  onGenerateAnalysis,
  onGeneratePredictions,
  onDebugPredictions
}) => {
  const quickActions = [
    {
      title: 'Generate Analysis',
      description: 'Create a new market analysis report',
      icon: <Brain className="h-5 w-5 text-primary" />,
      action: { 
        label: generatingAnalysis ? 'Generating...' : 'Generate', 
        onClick: onGenerateAnalysis,
        disabled: generatingAnalysis
      },
    },
    {
      title: 'Generate Predictions',
      description: 'Create predictions from latest analysis',
      icon: <Sparkles className="h-5 w-5 text-primary" />,
      action: { 
        label: generatingPredictions ? 'Generating...' : 'Generate', 
        onClick: onGeneratePredictions,
        disabled: generatingPredictions
      },
    },
    {
      title: 'Debug Predictions',
      description: 'Debug prediction loading issues',
      icon: <Target className="h-5 w-5 text-orange-500" />,
      action: { 
        label: 'Debug', 
        onClick: onDebugPredictions,
        disabled: false
      },
    },
    {
      title: 'Manage Feeds',
      description: 'Configure your data sources',
      icon: <Globe className="h-5 w-5 text-primary" />,
      action: { 
        label: 'Manage', 
        onClick: () => window.location.href = '/feeds' 
      },
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Quick Actions</h3>
      {quickActions.map((action, index) => (
        <FeatureCard key={index} {...action} />
      ))}
    </div>
  );
};