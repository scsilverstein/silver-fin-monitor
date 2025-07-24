import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'gradient' | 'glow';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  asChild?: boolean;
}

const ModernButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'default', 
    loading = false,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    disabled,
    children,
    ...props 
  }, ref) => {
    const baseStyles = cn(
      'inline-flex items-center justify-center gap-2',
      'font-medium transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'active:scale-[0.98]',
      'rounded-lg',
      fullWidth && 'w-full'
    );

    const variants = {
      default: cn(
        'bg-primary text-primary-foreground',
        'hover:bg-primary/90',
        'shadow-sm hover:shadow-md'
      ),
      secondary: cn(
        'bg-secondary text-secondary-foreground',
        'hover:bg-secondary/80',
        'shadow-sm hover:shadow-md'
      ),
      outline: cn(
        'border border-input bg-background',
        'hover:bg-accent hover:text-accent-foreground',
        'shadow-sm'
      ),
      ghost: cn(
        'hover:bg-accent hover:text-accent-foreground'
      ),
      destructive: cn(
        'bg-destructive text-destructive-foreground',
        'hover:bg-destructive/90',
        'shadow-sm hover:shadow-md'
      ),
      gradient: cn(
        'bg-gradient-to-r from-primary to-primary/60',
        'text-primary-foreground',
        'hover:shadow-lg hover:scale-[1.02]',
        'shadow-md'
      ),
      glow: cn(
        'bg-primary text-primary-foreground',
        'shadow-glow hover:shadow-glow-lg',
        'hover:scale-[1.02]'
      ),
    };

    const sizes = {
      default: 'h-10 px-4 py-2 text-sm',
      sm: 'h-8 px-3 text-xs',
      lg: 'h-12 px-6 text-base',
      icon: 'h-10 w-10',
    };

    const iconElement = loading ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : icon;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {iconElement && iconPosition === 'left' && iconElement}
        {children}
        {iconElement && iconPosition === 'right' && iconElement}
      </button>
    );
  }
);

ModernButton.displayName = 'ModernButton';

export { ModernButton };