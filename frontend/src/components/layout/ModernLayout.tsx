import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ModernSidebar } from './ModernSidebar';
import { ModernHeader } from './ModernHeader';

interface ModernLayoutProps {
  children: ReactNode;
  className?: string;
  showSidebar?: boolean;
  fullWidth?: boolean;
}

export const ModernLayout: React.FC<ModernLayoutProps> = ({
  children,
  className,
  showSidebar = true,
  fullWidth = false,
}) => {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
        <div className="absolute inset-0 bg-grid opacity-[0.02]" />
      </div>

      {/* Main Layout */}
      <div className="relative flex h-screen overflow-hidden">
        {/* Sidebar */}
        {showSidebar && <ModernSidebar />}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <ModernHeader />

          {/* Page Content */}
          <main
            className={cn(
              'flex-1 overflow-y-auto custom-scrollbar',
              'animate-in fade-in duration-500',
              fullWidth ? 'px-4 sm:px-6 lg:px-8' : 'p-4',
              'py-6',
              className
            )}
          >
            {/* Content Wrapper with max width */}
            <div className={cn(
              fullWidth ? '' : 'max-w-7xl mx-auto',
              'space-y-6'
            )}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

// Split Layout for Auth Pages
interface SplitLayoutProps {
  children: ReactNode;
  imageUrl?: string;
  reverseOrder?: boolean;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  children,
  imageUrl = '/auth-bg.jpg',
  reverseOrder = false,
}) => {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Content Side */}
      <div className={cn(
        'flex-1 flex items-center justify-center p-8 lg:p-12',
        'bg-background relative overflow-hidden',
        reverseOrder ? 'lg:order-2' : 'lg:order-1'
      )}>
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-dots opacity-[0.02]" />
        
        {/* Content */}
        <div className="relative z-10 w-full max-w-md space-y-8 animate-in slide-in-up duration-700">
          {children}
        </div>
      </div>

      {/* Image Side */}
      <div className={cn(
        'hidden lg:block lg:w-1/2 relative',
        reverseOrder ? 'lg:order-1' : 'lg:order-2'
      )}>
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent z-10" />
        
        {/* Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
        
        {/* Content Overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center p-12">
          <div className="text-center text-white space-y-4">
            <h2 className="text-4xl font-display font-bold">
              Silver Fin Monitor
            </h2>
            <p className="text-lg opacity-90">
              AI-Powered Market Intelligence Platform
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Grid Layout for Dashboards
interface GridLayoutProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const GridLayout: React.FC<GridLayoutProps> = ({
  children,
  columns = 3,
  gap = 'md',
  className,
}) => {
  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  };

  const columnClasses = {
    1: 'grid-cols-2',
    2: 'grid-cols-2 sm:grid-cols-3',
    3: 'grid-cols-2 sm:grid-cols-3 ',
    4: 'grid-cols-4 sm:grid-cols-4',
  };

  return (
    <div className={cn(
      'grid',
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
};

// Masonry Layout for Dynamic Content
interface MasonryLayoutProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const MasonryLayout: React.FC<MasonryLayoutProps> = ({
  children,
  columns = 3,
  gap = 'md',
  className,
}) => {
  const gapSize = gap === 'sm' ? 16 : gap === 'md' ? 24 : 32;
  
  return (
    <div
      className={cn('masonry-layout', className)}
      style={{
        columnCount: columns,
        columnGap: `${gapSize}px`,
      }}
    >
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          className="break-inside-avoid mb-6"
          style={{ marginBottom: `${gapSize}px` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};