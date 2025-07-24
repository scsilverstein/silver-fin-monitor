import React, { useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';

export interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface SharedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  primaryAction?: ModalAction;
  secondaryActions?: ModalAction[];
  className?: string;
}

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl'
};

const variantIcons = {
  default: null,
  success: <CheckCircle className="h-5 w-5 text-green-600" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
  error: <AlertCircle className="h-5 w-5 text-red-600" />,
  info: <Info className="h-5 w-5 text-blue-600" />
};

const variantColors = {
  default: '',
  success: 'border-l-4 border-green-500',
  warning: 'border-l-4 border-yellow-500', 
  error: 'border-l-4 border-red-500',
  info: 'border-l-4 border-blue-500'
};

export const SharedModal: React.FC<SharedModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  variant = 'default',
  showCloseButton = true,
  closeOnOverlayClick = true,
  primaryAction,
  secondaryActions = [],
  className
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className={cn('w-full max-h-[90vh] overflow-hidden', modalSizes[size])}>
        <ModernCard 
          variant="glass" 
          className={cn('shadow-2xl', variantColors[variant], className)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              {variantIcons[variant]}
              <CardTitle className="text-lg font-semibold">
                {title}
              </CardTitle>
            </div>
            {showCloseButton && (
              <ModernButton
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </ModernButton>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {description && (
              <p className="text-sm text-muted-foreground -mt-2">
                {description}
              </p>
            )}

            <div>
              {children}
            </div>

            {(primaryAction || secondaryActions.length > 0) && (
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                {secondaryActions.map((action, index) => (
                  <ModernButton
                    key={index}
                    variant={action.variant || 'outline'}
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                  >
                    {action.loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    ) : action.icon ? (
                      <span className="mr-2">{action.icon}</span>
                    ) : null}
                    {action.label}
                  </ModernButton>
                ))}
                
                {primaryAction && (
                  <ModernButton
                    variant={primaryAction.variant || 'default'}
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled || primaryAction.loading}
                  >
                    {primaryAction.loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    ) : primaryAction.icon ? (
                      <span className="mr-2">{primaryAction.icon}</span>
                    ) : null}
                    {primaryAction.label}
                  </ModernButton>
                )}
              </div>
            )}
          </CardContent>
        </ModernCard>
      </div>
    </div>
  );
};

// Specialized modal components for common use cases
export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: 'warning' | 'error';
  loading?: boolean;
}> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'warning',
  loading = false
}) => (
  <SharedModal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    variant={variant}
    size="sm"
    primaryAction={{
      label: confirmLabel,
      onClick: onConfirm,
      variant: variant === 'error' ? 'destructive' : 'default',
      loading
    }}
    secondaryActions={[{
      label: cancelLabel,
      onClick: onClose,
      variant: 'outline'
    }]}
  >
    <p className="text-sm text-muted-foreground">
      {message}
    </p>
  </SharedModal>
);

export const InfoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({
  isOpen,
  onClose,
  title,
  content,
  size = 'md'
}) => (
  <SharedModal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    variant="info"
    size={size}
    primaryAction={{
      label: 'Close',
      onClick: onClose,
      variant: 'outline'
    }}
  >
    {content}
  </SharedModal>
);

export const FormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  submitLabel?: string;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  submitLabel = 'Save',
  onSubmit,
  loading = false,
  disabled = false,
  size = 'md'
}) => (
  <SharedModal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    description={description}
    size={size}
    closeOnOverlayClick={false}
    primaryAction={{
      label: submitLabel,
      onClick: onSubmit,
      loading,
      disabled
    }}
    secondaryActions={[{
      label: 'Cancel',
      onClick: onClose,
      variant: 'outline'
    }]}
  >
    {children}
  </SharedModal>
);

// Utility functions for creating modal actions
export const createModalActions = {
  confirm: (onClick: () => void, loading = false): ModalAction => ({
    label: 'Confirm',
    onClick,
    loading
  }),
  
  cancel: (onClick: () => void): ModalAction => ({
    label: 'Cancel',
    onClick,
    variant: 'outline'
  }),
  
  delete: (onClick: () => void, loading = false): ModalAction => ({
    label: 'Delete',
    onClick,
    variant: 'destructive',
    loading,
    icon: loading ? null : <AlertTriangle className="h-4 w-4" />
  }),
  
  save: (onClick: () => void, loading = false): ModalAction => ({
    label: 'Save',
    onClick,
    loading,
    icon: loading ? null : <CheckCircle className="h-4 w-4" />
  }),
  
  close: (onClick: () => void): ModalAction => ({
    label: 'Close',
    onClick,
    variant: 'outline'
  })
};