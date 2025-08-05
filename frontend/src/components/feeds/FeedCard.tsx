import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { ModernButton } from '@/components/ui/ModernButton';
import { 
  Power, 
  PowerOff, 
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  ExternalLink
} from 'lucide-react';
import { FeedSource } from '@/lib/api';
import { QuickLinks } from '@/components/navigation/ClickableLinks';
import { cn } from '@/lib/utils';

interface FeedCardProps {
  feed: FeedSource;
  expanded: boolean;
  updating: boolean;
  icon: React.ReactNode;
  colorClass: string;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onProcess: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}

export const FeedCard: React.FC<FeedCardProps> = ({
  feed,
  expanded,
  updating,
  icon,
  colorClass,
  onToggleExpand,
  onToggleActive,
  onProcess,
  children
}) => {

  return (
    <ModernCard 
      variant="bordered" 
      className={cn(
        "hover:shadow-lg transition-all duration-200 hover-lift",
        !feed.is_active && "opacity-60"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn("p-2 rounded-lg", colorClass)}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                {feed.name}
                {!feed.is_active && (
                  <ModernBadge variant="secondary" size="sm">
                    Inactive
                  </ModernBadge>
                )}
              </CardTitle>
              {feed.last_processed_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last processed: {new Date(feed.last_processed_at).toLocaleString()}
                </p>
              )}
              
              {/* Navigation Links */}
              <QuickLinks 
                sourceId={feed.id}
                sourceName={feed.name}
                className="mt-2"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onToggleActive}
              disabled={updating}
            >
              {feed.is_active ? (
                <Power className="h-4 w-4 text-success" />
              ) : (
                <PowerOff className="h-4 w-4 text-muted-foreground" />
              )}
            </ModernButton>
            
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onProcess}
              disabled={!feed.is_active}
            >
              <RefreshCw className="h-4 w-4" />
            </ModernButton>
            
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </ModernButton>
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent>
          {children}
        </CardContent>
      )}
    </ModernCard>
  );
};