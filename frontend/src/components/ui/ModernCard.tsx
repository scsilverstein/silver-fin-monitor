import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'gradient' | 'glow' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const ModernCard = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', interactive = false, ...props }, ref) => {
    const baseStyles = cn(
      'rounded-xl',
      'transition-all duration-200'
    );

    const variants = {
      default: 'bg-card text-card-foreground shadow-sm',
      glass: 'glass border border-border/50',
      gradient: 'card-gradient shadow-md',
      glow: 'card-glow bg-card',
      bordered: 'border border-border bg-card',
    };

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    const interactiveStyles = interactive ? cn(
      'cursor-pointer',
      'hover:shadow-lg hover:scale-[1.02]',
      'active:scale-[0.98]'
    ) : '';

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          paddings[padding],
          interactiveStyles,
          className
        )}
        {...props}
      />
    );
  }
);

ModernCard.displayName = 'ModernCard';

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, noPadding = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-1.5',
        !noPadding && 'p-6 pb-0',
        className
      )}
      {...props}
    />
  )
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Component = 'h3', ...props }, ref) => (
    <Component
      ref={ref as any}
      className={cn(
        'text-xl font-semibold leading-none tracking-tight',
        className
      )}
      {...props}
    />
  )
);

CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));

CardDescription.displayName = 'CardDescription';

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, noPadding = false, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn(
        !noPadding && 'p-6 pt-4',
        className
      )} 
      {...props} 
    />
  )
);

CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';

// Specialized Card Components

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  description,
  className,
}) => {
  return (
    <ModernCard variant="bordered" className={cn('relative overflow-hidden', className)}>
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
      
      <CardContent className="relative">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            
            {change && (
              <div className={cn(
                'inline-flex items-center gap-1 text-sm font-medium',
                change.type === 'increase' ? 'text-success' : 'text-destructive'
              )}>
                <span>{change.type === 'increase' ? '↑' : '↓'}</span>
                <span>{Math.abs(change.value)}%</span>
              </div>
            )}
            
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          
          {icon && (
            <div className="p-3 bg-primary/10 rounded-lg">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </ModernCard>
  );
};

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  action,
  className,
}) => {
  return (
    <ModernCard 
      variant="glass" 
      interactive={!!action && !action.disabled}
      onClick={action?.disabled ? undefined : action?.onClick}
      className={cn('group', action?.disabled && 'opacity-50 cursor-not-allowed', className)}
    >
      <CardContent>
        <div className="space-y-4">
          {icon && (
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              {icon}
            </div>
          )}
          
          <div className="space-y-2">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          
          {action && (
            <div className="pt-2">
              <span className={cn(
                "text-sm font-medium transition-colors",
                action.disabled 
                  ? "text-muted-foreground" 
                  : "text-primary group-hover:underline"
              )}>
                {action.label} →
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </ModernCard>
  );
};