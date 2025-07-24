import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  error?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
}

const ModernSelect = forwardRef<HTMLSelectElement, SelectProps>(
  ({ 
    className, 
    variant = 'default',
    size = 'default',
    error = false,
    fullWidth = false,
    placeholder,
    children,
    ...props 
  }, ref) => {
    const baseStyles = cn(
      'relative inline-flex w-full cursor-pointer items-center justify-between',
      'font-medium transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'appearance-none',
      'rounded-lg',
      fullWidth && 'w-full'
    );

    const variants = {
      default: cn(
        'bg-background border border-input',
        'hover:border-ring/50',
        'shadow-sm hover:shadow-md',
        error && 'border-destructive focus-visible:ring-destructive'
      ),
      outline: cn(
        'border border-input bg-background',
        'hover:bg-accent/5 hover:border-ring/50',
        'shadow-sm',
        error && 'border-destructive focus-visible:ring-destructive'
      ),
      ghost: cn(
        'border-transparent bg-transparent',
        'hover:bg-accent hover:text-accent-foreground'
      )
    };

    const sizes = {
      default: 'h-10 px-3 py-2 text-sm pr-8',
      sm: 'h-8 px-2 py-1 text-xs pr-7',
      lg: 'h-12 px-4 py-3 text-base pr-10',
    };

    const iconSizes = {
      default: 'h-4 w-4 right-2 top-3',
      sm: 'h-3 w-3 right-2 top-2.5',
      lg: 'h-5 w-5 right-3 top-3.5',
    };

    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            baseStyles,
            variants[variant],
            sizes[size],
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDown className={cn(
          'absolute opacity-50 pointer-events-none text-muted-foreground',
          iconSizes[size]
        )} />
      </div>
    );
  }
);

ModernSelect.displayName = 'ModernSelect';

// Additional compound components for more complex select functionality
interface ModernSelectRootProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

export const ModernSelectRoot = forwardRef<HTMLDivElement, ModernSelectRootProps>(
  ({ value = "", onValueChange = () => {}, children, disabled = false }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(value);

    React.useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const handleValueChange = React.useCallback((newValue: string) => {
      setInternalValue(newValue);
      onValueChange(newValue);
      setOpen(false);
    }, [onValueChange]);

    return (
      <SelectContext.Provider value={{
        value: internalValue,
        onValueChange: handleValueChange,
        open,
        onOpenChange: setOpen,
        disabled
      }}>
        <div ref={ref} className="relative">
          {children}
        </div>
      </SelectContext.Provider>
    );
  }
);
ModernSelectRoot.displayName = "ModernSelectRoot";

interface ModernSelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  error?: boolean;
}

export const ModernSelectTrigger = forwardRef<HTMLButtonElement, ModernSelectTriggerProps>(
  ({ className, variant = 'default', size = 'default', error = false, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    
    if (!context) {
      throw new Error('ModernSelectTrigger must be used within ModernSelectRoot');
    }

    const baseStyles = cn(
      'flex h-10 w-full items-center justify-between',
      'font-medium transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'rounded-lg text-left'
    );

    const variants = {
      default: cn(
        'bg-background border border-input',
        'hover:border-ring/50',
        'shadow-sm hover:shadow-md',
        error && 'border-destructive focus-visible:ring-destructive'
      ),
      outline: cn(
        'border border-input bg-background',
        'hover:bg-accent/5 hover:border-ring/50',
        'shadow-sm',
        error && 'border-destructive focus-visible:ring-destructive'
      ),
      ghost: cn(
        'border-transparent bg-transparent',
        'hover:bg-accent hover:text-accent-foreground'
      )
    };

    const sizes = {
      default: 'h-10 px-3 py-2 text-sm',
      sm: 'h-8 px-2 py-1 text-xs',
      lg: 'h-12 px-4 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={context.disabled}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        onClick={() => !context.disabled && context.onOpenChange(!context.open)}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50 text-muted-foreground" />
      </button>
    );
  }
);
ModernSelectTrigger.displayName = "ModernSelectTrigger";

export const ModernSelectContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    
    if (!context) {
      throw new Error('ModernSelectContent must be used within ModernSelectRoot');
    }
    
    if (!context.open) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-80 slide-in-from-top-2 mt-2 w-full",
          className
        )}
        {...props}
      >
        <div className="p-1">
          {children}
        </div>
      </div>
    );
  }
);
ModernSelectContent.displayName = "ModernSelectContent";

interface ModernSelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

export const ModernSelectItem = forwardRef<HTMLDivElement, ModernSelectItemProps>(
  ({ className, children, value, disabled = false, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    
    if (!context) {
      throw new Error('ModernSelectItem must be used within ModernSelectRoot');
    }
    
    const isSelected = context.value === value;

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm outline-none transition-colors",
          "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
          isSelected && "bg-accent text-accent-foreground",
          disabled && "pointer-events-none opacity-50",
          className
        )}
        onClick={() => !disabled && context.onValueChange(value)}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {isSelected && <Check className="h-4 w-4" />}
        </span>
        {children}
      </div>
    );
  }
);
ModernSelectItem.displayName = "ModernSelectItem";

interface ModernSelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

export const ModernSelectValue = forwardRef<HTMLSpanElement, ModernSelectValueProps>(
  ({ className, placeholder, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    
    if (!context) {
      throw new Error('ModernSelectValue must be used within ModernSelectRoot');
    }
    
    return (
      <span
        ref={ref}
        className={cn("block truncate", className)}
        {...props}
      >
        {context.value || placeholder}
      </span>
    );
  }
);
ModernSelectValue.displayName = "ModernSelectValue";

export { ModernSelect };