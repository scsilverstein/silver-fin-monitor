import React from 'react';
import { cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showBreadcrumbs?: boolean;
  showSidebar?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  title,
  description,
  showBreadcrumbs = false,
  showSidebar = true,
  fullWidth = false,
  className
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {showBreadcrumbs && <Breadcrumbs className="mb-4" />}
      
      {(title || description) && (
        <div className="space-y-2">
          {title && (
            <h1 className="text-3xl font-bold tracking-tight">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      
      {children}
    </div>
  );
};