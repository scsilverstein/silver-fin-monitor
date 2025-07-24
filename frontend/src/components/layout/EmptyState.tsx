import React from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  RefreshCw,
  AlertCircle,
  Database,
  TrendingUp,
  Settings,
  Users,
  Calendar,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernButton } from '@/components/ui/ModernButton';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'secondary' | 'outline';
  icon?: React.ReactNode;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  variant?: 'default' | 'search' | 'error' | 'maintenance';
  className?: string;
}

const defaultIcons = {
  default: <FileText className="h-12 w-12 text-muted-foreground" />,
  search: <Search className="h-12 w-12 text-muted-foreground" />,
  error: <AlertCircle className="h-12 w-12 text-destructive" />,
  maintenance: <Settings className="h-12 w-12 text-muted-foreground" />
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actions = [],
  variant = 'default',
  className
}) => {
  const displayIcon = icon || defaultIcons[variant];

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center space-y-4 py-12",
      className
    )}>
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
        {displayIcon}
      </div>
      
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold">
          {title}
        </h3>
        <p className="text-muted-foreground">
          {description}
        </p>
      </div>
      
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {actions.map((action, index) => (
            <ModernButton
              key={index}
              variant={action.variant || 'default'}
              onClick={action.onClick}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </ModernButton>
          ))}
        </div>
      )}
    </div>
  );
};

// Predefined empty state components for common scenarios
export const NoDataEmptyState: React.FC<{
  title?: string;
  onRefresh?: () => void;
  onCreate?: () => void;
}> = ({ 
  title = 'No data available',
  onRefresh,
  onCreate
}) => {
  const actions: EmptyStateAction[] = [];
  
  if (onRefresh) {
    actions.push({
      label: 'Refresh',
      onClick: onRefresh,
      variant: 'outline',
      icon: <RefreshCw className="h-4 w-4" />
    });
  }
  
  if (onCreate) {
    actions.push({
      label: 'Create New',
      onClick: onCreate,
      icon: <Plus className="h-4 w-4" />
    });
  }

  return (
    <EmptyState
      icon={<Database className="h-12 w-12 text-muted-foreground" />}
      title={title}
      description="There's nothing here yet. Get started by adding some data."
      actions={actions}
    />
  );
};

export const NoSearchResultsEmptyState: React.FC<{
  searchQuery: string;
  onClearSearch?: () => void;
}> = ({ searchQuery, onClearSearch }) => {
  const actions: EmptyStateAction[] = [];
  
  if (onClearSearch) {
    actions.push({
      label: 'Clear Search',
      onClick: onClearSearch,
      variant: 'outline'
    });
  }

  return (
    <EmptyState
      variant="search"
      title="No results found"
      description={`No results match "${searchQuery}". Try adjusting your search terms.`}
      actions={actions}
    />
  );
};

export const NoPredictionsEmptyState: React.FC<{
  onGenerate?: () => void;
}> = ({ onGenerate }) => {
  const actions: EmptyStateAction[] = [];
  
  if (onGenerate) {
    actions.push({
      label: 'Generate Predictions',
      onClick: onGenerate,
      icon: <TrendingUp className="h-4 w-4" />
    });
  }

  return (
    <EmptyState
      icon={<BarChart3 className="h-12 w-12 text-muted-foreground" />}
      title="No predictions available"
      description="Generate some market predictions based on your analyzed content."
      actions={actions}
    />
  );
};

export const NoAnalysisEmptyState: React.FC<{
  onGenerate?: () => void;
}> = ({ onGenerate }) => {
  const actions: EmptyStateAction[] = [];
  
  if (onGenerate) {
    actions.push({
      label: 'Generate Analysis',
      onClick: onGenerate,
      icon: <TrendingUp className="h-4 w-4" />
    });
  }

  return (
    <EmptyState
      icon={<BarChart3 className="h-12 w-12 text-muted-foreground" />}
      title="No analysis available"
      description="Generate market analysis from your processed content."
      actions={actions}
    />
  );
};

export const NoContentEmptyState: React.FC<{
  onAddFeed?: () => void;
  onRefresh?: () => void;
}> = ({ onAddFeed, onRefresh }) => {
  const actions: EmptyStateAction[] = [];
  
  if (onAddFeed) {
    actions.push({
      label: 'Add Feed',
      onClick: onAddFeed,
      icon: <Plus className="h-4 w-4" />
    });
  }
  
  if (onRefresh) {
    actions.push({
      label: 'Refresh',
      onClick: onRefresh,
      variant: 'outline',
      icon: <RefreshCw className="h-4 w-4" />
    });
  }

  return (
    <EmptyState
      icon={<FileText className="h-12 w-12 text-muted-foreground" />}
      title="No content available"
      description="Add some feeds or process existing content to see data here."
      actions={actions}
    />
  );
};