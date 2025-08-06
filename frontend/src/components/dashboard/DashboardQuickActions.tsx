import React from 'react';
import { FeatureCard } from '@/components/ui/ModernCard';
import { Brain, Sparkles, Target, Globe, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  
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
      title: 'Process Control',
      description: 'Manually trigger system processes',
      icon: <Zap className="h-5 w-5 text-yellow-500" />,
      action: { 
        label: 'Control', 
        onClick: () => navigate('/process-control'),
        disabled: false
      },
    },
    {
      title: 'Manage Feeds',
      description: 'Configure your data sources',
      icon: <Globe className="h-5 w-5 text-primary" />,
      action: { 
        label: 'Manage', 
        onClick: () => navigate('/feeds')
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