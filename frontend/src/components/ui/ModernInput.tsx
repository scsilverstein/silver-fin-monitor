import React, { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Search, X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  onClear?: () => void;
}

const ModernInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, hint, icon, onClear, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const isSearch = type === 'search';
    const hasValue = props.value && String(props.value).length > 0;

    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
            {props.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {/* Icon */}
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          
          {/* Search Icon for search inputs */}
          {isSearch && !icon && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          
          {/* Input */}
          <input
            ref={ref}
            type={isPassword && showPassword ? 'text' : type}
            className={cn(
              'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-all duration-200',
              error && 'border-destructive focus:ring-destructive',
              (icon || isSearch) && 'pl-10',
              (isPassword || (onClear && hasValue)) && 'pr-10',
              className
            )}
            {...props}
          />
          
          {/* Password Toggle */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
          
          {/* Clear Button */}
          {onClear && hasValue && !isPassword && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Error Message */}
        {error && (
          <p className="text-sm text-destructive animate-in slide-in-up">
            {error}
          </p>
        )}
        
        {/* Hint Message */}
        {hint && !error && (
          <p className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

ModernInput.displayName = 'ModernInput';

// Textarea Component
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const ModernTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
            {props.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        
        <textarea
          ref={ref}
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200 resize-none',
            error && 'border-destructive focus:ring-destructive',
            className
          )}
          {...props}
        />
        
        {error && (
          <p className="text-sm text-destructive animate-in slide-in-up">
            {error}
          </p>
        )}
        
        {hint && !error && (
          <p className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

ModernTextarea.displayName = 'ModernTextarea';

// Search Input Component
interface SearchInputProps extends Omit<InputProps, 'type'> {
  onSearch?: (value: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  ...props
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(value);
  };

  const handleClear = () => {
    setValue('');
    onSearch?.('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <ModernInput
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClear={handleClear}
        {...props}
      />
    </form>
  );
};

// Floating Label Input
interface FloatingLabelInputProps extends InputProps {
  label: string;
}

export const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  className,
  ...props
}) => {
  const [focused, setFocused] = useState(false);
  const hasValue = props.value && String(props.value).length > 0;

  return (
    <div className="relative">
      <input
        className={cn(
          'peer h-12 w-full rounded-lg border border-input bg-background px-3 pt-6 pb-2 text-sm',
          'placeholder:text-transparent',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-all duration-200',
          className
        )}
        placeholder={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      <label
        className={cn(
          'absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground',
          'transition-all duration-200 pointer-events-none',
          'peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-base',
          'peer-focus:top-3 peer-focus:text-xs peer-focus:text-primary',
          (focused || hasValue) && 'top-3 text-xs'
        )}
      >
        {label}
      </label>
    </div>
  );
};

// Select Component
interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  onValueChange?: (value: string) => void;
  placeholder?: string;
}

const ModernSelect = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options = [], onValueChange, placeholder, value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onValueChange?.(e.target.value);
    };

    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
            {props.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          <select
            ref={ref}
            value={value}
            onChange={handleChange}
            className={cn(
              'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-all duration-200',
              'appearance-none cursor-pointer',
              error && 'border-destructive focus:ring-destructive',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          {/* Custom dropdown arrow */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <p className="text-sm text-destructive animate-in slide-in-up">
            {error}
          </p>
        )}
        
        {/* Hint Message */}
        {hint && !error && (
          <p className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

ModernSelect.displayName = 'ModernSelect';

export { ModernInput, ModernTextarea, ModernSelect };