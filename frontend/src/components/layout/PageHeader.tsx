import React from 'react';
import { RefreshCw, Search, Plus, Download, Settings, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernButton } from '@/components/ui/ModernButton';
import { Input } from '@/components/ui/input';
import { ModernBadge } from '@/components/ui/ModernBadge';

interface PageAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  searchPlaceholder?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  primaryActions?: PageAction[];
  secondaryActions?: PageAction[];
  badges?: Array<{
    label: string;
    variant?: 'default' | 'secondary' | 'outline' | 'info' | 'success' | 'warning' | 'destructive';
    dot?: boolean;
  }>;
  className?: string;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  searchQuery,
  searchPlaceholder = "Search...",
  onSearchChange,
  showSearch = false,
  refreshing = false,
  onRefresh,
  primaryActions = [],
  secondaryActions = [],
  badges = [],
  className,
  children
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Title and Description */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {title}
            </h1>
            {badges.length > 0 && (
              <div className="flex items-center gap-2">
                {badges.map((badge, index) => (
                  <ModernBadge
                    key={index}
                    variant={badge.variant}
                    dot={badge.dot}
                  >
                    {badge.label}
                  </ModernBadge>
                ))}
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>

        {/* Primary Actions */}
        {(primaryActions.length > 0 || onRefresh) && (
          <div className="flex items-center gap-2">
            {onRefresh && (
              <ModernButton
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn(
                  "h-4 w-4 mr-2",
                  refreshing && "animate-spin"
                )} />
                Refresh
              </ModernButton>
            )}
            
            {primaryActions.map((action, index) => (
              <ModernButton
                key={index}
                variant={action.variant || 'default'}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
              >
                {action.loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : action.icon ? (
                  <span className="mr-2">{action.icon}</span>
                ) : null}
                {action.label}
              </ModernButton>
            ))}
          </div>
        )}
      </div>

      {/* Search and Secondary Actions */}
      {(showSearch || secondaryActions.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          {showSearch && onSearchChange && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
          
          {secondaryActions.length > 0 && (
            <div className="flex items-center gap-2">
              {secondaryActions.map((action, index) => (
                <ModernButton
                  key={index}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled || action.loading}
                >
                  {action.loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : action.icon ? (
                    <span className="mr-2">{action.icon}</span>
                  ) : null}
                  {action.label}
                </ModernButton>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom children */}
      {children}
    </div>
  );
};

// Common action creators for convenience
export const createPageActions = {
  add: (onClick: () => void, loading = false): PageAction => ({
    label: 'Add',
    icon: <Plus className="h-4 w-4" />,
    onClick,
    loading
  }),
  
  export: (onClick: () => void, loading = false): PageAction => ({
    label: 'Export',
    icon: <Download className="h-4 w-4" />,
    onClick,
    variant: 'outline',
    loading
  }),
  
  settings: (onClick: () => void): PageAction => ({
    label: 'Settings',
    icon: <Settings className="h-4 w-4" />,
    onClick,
    variant: 'outline'
  }),
  
  filters: (onClick: () => void): PageAction => ({
    label: 'Filters',
    icon: <Filter className="h-4 w-4" />,
    onClick,
    variant: 'outline'
  }),
  
  refresh: (onClick: () => void, loading = false): PageAction => ({
    label: 'Refresh',
    icon: <RefreshCw className="h-4 w-4" />,
    onClick,
    variant: 'outline',
    loading
  })
};