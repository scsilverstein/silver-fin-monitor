import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useSmartNavigation, generateBreadcrumbs, NavigationFilter } from '@/utils/navigation';

interface BreadcrumbsProps {
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ className = '' }) => {
  const { getCurrentContext, getCurrentFilters, navigateWithFilters } = useSmartNavigation();
  const context = getCurrentContext();
  const filters = getCurrentFilters();
  const currentPath = window.location.pathname;

  const breadcrumbs = generateBreadcrumbs(currentPath, context, filters);

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs if only home
  }

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`}>
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <button
            onClick={() => navigateWithFilters(crumb.path, crumb.filters)}
            className={`
              flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors
              ${index === breadcrumbs.length - 1 
                ? 'text-foreground font-medium cursor-default' 
                : 'text-muted-foreground hover:text-foreground cursor-pointer'
              }
            `}
            disabled={index === breadcrumbs.length - 1}
          >
            {index === 0 && <Home className="w-3 h-3" />}
            {crumb.label}
          </button>
        </React.Fragment>
      ))}
      
      {/* Show active filters */}
      {Object.keys(filters).length > 0 && (
        <div className="flex items-center gap-1 ml-4">
          <span className="text-xs text-muted-foreground">Filtered by:</span>
          {filters.sourceName && (
            <Badge variant="secondary" className="text-xs">
              Source: {filters.sourceName}
            </Badge>
          )}
          {filters.entity && (
            <Badge variant="secondary" className="text-xs">
              Entity: {filters.entity}
            </Badge>
          )}
          {filters.topic && (
            <Badge variant="secondary" className="text-xs">
              Topic: {filters.topic}
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="text-xs">
              Status: {filters.status}
            </Badge>
          )}
        </div>
      )}
    </nav>
  );
};