import React from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface SyncStatusBadgeProps {
  status: 'idle' | 'syncing' | 'completed' | 'failed' | 'loading';
  lastSyncAt?: string;
  itemsProcessed?: number;
  totalItems?: number;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  status,
  lastSyncAt,
  itemsProcessed,
  totalItems,
  error,
  size = 'md',
  showText = true,
  className
}) => {
  const getIcon = () => {
    const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5';
    
    switch (status) {
      case 'loading':
        return <Loader2 className={cn(iconSize, 'animate-spin')} />;
      case 'syncing':
        return <RefreshCw className={cn(iconSize, 'animate-spin')} />;
      case 'completed':
        return <CheckCircle className={iconSize} />;
      case 'failed':
        return <AlertCircle className={iconSize} />;
      default:
        return <div className={cn(iconSize.replace('h-', 'w-').replace('w-', 'h-'), 'rounded-full bg-current')} />;
    }
  };

  const getVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'syncing':
      case 'loading':
        return 'secondary';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getText = () => {
    switch (status) {
      case 'loading':
        return 'Loading';
      case 'syncing':
        return itemsProcessed !== undefined && totalItems !== undefined 
          ? `Syncing ${itemsProcessed}/${totalItems}`
          : 'Syncing';
      case 'completed':
        return 'Synced';
      case 'failed':
        return 'Failed';
      default:
        return 'Not synced';
    }
  };

  const getTooltipContent = () => {
    const parts = [];
    
    if (status === 'completed' && lastSyncAt) {
      parts.push(`Last synced: ${new Date(lastSyncAt).toLocaleString()}`);
    }
    
    if (itemsProcessed !== undefined && totalItems !== undefined) {
      parts.push(`Items: ${itemsProcessed}/${totalItems}`);
    }
    
    if (error) {
      parts.push(`Error: ${error}`);
    }
    
    return parts.length > 0 ? parts.join('\n') : getText();
  };

  const badge = (
    <Badge
      variant={getVariant()}
      className={cn(
        'flex items-center gap-1',
        size === 'sm' && 'text-xs px-1.5 py-0.5',
        size === 'lg' && 'text-base px-3 py-1',
        className
      )}
    >
      {getIcon()}
      {showText && <span>{getText()}</span>}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <pre className="text-xs">{getTooltipContent()}</pre>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};