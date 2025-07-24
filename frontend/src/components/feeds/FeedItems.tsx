import React from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { ModernSkeleton } from '@/components/ui/ModernSkeleton';
import { 
  Calendar, 
  ExternalLink, 
  FileText, 
  Volume2, 
  VolumeX,
  RefreshCw
} from 'lucide-react';

interface FeedItem {
  id: string;
  title: string;
  published_at: string;
  processing_status: string;
  external_id?: string;
  metadata?: any;
  content?: string;
  hasTranscription?: boolean;
  isAudioContent?: boolean;
  hasTextProcessing?: boolean;
  transcription?: string;
  processingData?: any;
}

interface FeedItemsProps {
  items: FeedItem[];
  loading: boolean;
  processingItems: Set<string>;
  onProcessItem: (itemId: string) => void;
  onViewContent?: (item: FeedItem) => void;
  onViewTranscript?: (item: FeedItem) => void;
}

export const FeedItems: React.FC<FeedItemsProps> = ({
  items,
  loading,
  processingItems,
  onProcessItem,
  onViewContent,
  onViewTranscript
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <ModernBadge variant="success" size="sm">Processed</ModernBadge>;
      case 'processing':
        return <ModernBadge variant="warning" size="sm">Processing</ModernBadge>;
      case 'failed':
        return <ModernBadge variant="error" size="sm">Failed</ModernBadge>;
      default:
        return <ModernBadge variant="secondary" size="sm">Pending</ModernBadge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <ModernSkeleton className="h-16" animation="pulse" />
        <ModernSkeleton className="h-16" animation="pulse" style={{ animationDelay: '100ms' }} />
        <ModernSkeleton className="h-16" animation="pulse" style={{ animationDelay: '200ms' }} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No items found for this feed.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto stagger-in">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors animate-in slide-in-up hover-scale"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium truncate">
                {item.title}
              </h4>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(item.published_at).toLocaleDateString()}
                </span>
                {getStatusBadge(item.processing_status)}
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {item.processing_status === 'completed' && onViewContent && (
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewContent(item)}
                  title="View processed content"
                >
                  <FileText className="h-4 w-4" />
                </ModernButton>
              )}
              
              {(item.metadata?.audio_url || item.metadata?.audioUrl || item.isAudioContent) && onViewTranscript && (
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewTranscript(item)}
                  title={item.hasTranscription || item.transcription || (item.content && item.content.length > 100) ? "View transcript" : "No transcript available"}
                >
                  {item.hasTranscription || item.transcription || (item.content && item.content.length > 100) ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                </ModernButton>
              )}
              
              {(item.processing_status === 'pending' || item.processing_status === 'completed') && (
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onProcessItem(item.id)}
                  disabled={processingItems.has(item.id)}
                  title={item.processing_status === 'completed' ? "Reprocess this item" : "Process this item"}
                >
                  <RefreshCw 
                    className={`h-4 w-4 ${
                      processingItems.has(item.id) ? 'animate-spin' : ''
                    }`} 
                  />
                </ModernButton>
              )}
              
              {item.external_id && (
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(item.external_id, '_blank')}
                  title="View original"
                >
                  <ExternalLink className="h-4 w-4" />
                </ModernButton>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};