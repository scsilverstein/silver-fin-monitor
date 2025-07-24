import React from 'react';
import { X, FileText, Volume2, VolumeX } from 'lucide-react';
import { ModernCard, CardContent, CardHeader, CardTitle } from './ModernCard';
import { ModernButton } from './ModernButton';
import { ModernBadge } from './ModernBadge';
import { cn } from '@/lib/utils';

interface TranscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    title?: string;
    description?: string;
    transcription?: string;
    hasTranscription?: boolean;
    metadata?: {
      duration?: number;
      audioUrl?: string;
      hasTranscription?: boolean;
    };
    processing_status?: string;
  };
}

export const TranscriptionModal: React.FC<TranscriptionModalProps> = ({
  isOpen,
  onClose,
  item
}) => {
  if (!isOpen) return null;

  const hasTranscription = (item.transcription && item.transcription.length > 0) || item.hasTranscription;
  const hasAudio = item.metadata?.audioUrl;
  const duration = item.metadata?.duration;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <ModernCard variant="glass" className="shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                {hasTranscription ? (
                  <Volume2 className="h-5 w-5 text-primary" />
                ) : (
                  <VolumeX className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg line-clamp-2">
                  {item.title || 'Untitled'}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <ModernBadge 
                    variant={hasTranscription ? "success" : "secondary"} 
                    size="sm"
                  >
                    {hasTranscription ? "Transcribed" : "No Transcription"}
                  </ModernBadge>
                  {duration && (
                    <ModernBadge variant="outline" size="sm">
                      {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                    </ModernBadge>
                  )}
                </div>
              </div>
            </div>
            <ModernButton
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </ModernButton>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Audio Player Section */}
            {hasAudio && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Audio Player
                  </h4>
                  <ModernButton
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(item.metadata?.audioUrl, '_blank')}
                  >
                    Open Original
                  </ModernButton>
                </div>
                <audio
                  controls
                  className="w-full"
                  preload="metadata"
                >
                  <source src={item.metadata?.audioUrl} type="audio/mpeg" />
                  <source src={item.metadata?.audioUrl} type="audio/wav" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {/* Description Section */}
            {item.description && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Description
                  </h4>
                  <ModernBadge variant="outline" size="sm">
                    {item.description.split(' ').length} words
                  </ModernBadge>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <div className="p-4 bg-muted/10 rounded-lg">
                    <p className="text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Transcription Content */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Audio Transcription
                </h4>
                {hasTranscription && (
                  <ModernBadge variant="outline" size="sm">
                    {item.transcription?.split(' ').length || 0} words
                  </ModernBadge>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {hasTranscription ? (
                  <div className="p-4 bg-muted/20 rounded-lg">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {item.transcription}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <VolumeX className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <h5 className="text-sm font-medium mb-2">No Transcription Available</h5>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      {item.processing_status === 'pending' || item.processing_status === 'processing'
                        ? 'Transcription is being processed. Please check back later.'
                        : hasAudio
                        ? 'This audio content has not been transcribed yet.'
                        : 'This item does not contain audio content to transcribe.'
                      }
                    </p>
                    {item.processing_status === 'failed' && (
                      <ModernBadge variant="error" size="sm" className="mt-2">
                        Transcription Failed
                      </ModernBadge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Processing Status */}
            {item.processing_status && (
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <span className="text-xs text-muted-foreground">Processing Status:</span>
                <ModernBadge 
                  variant={
                    item.processing_status === 'completed' ? "success" : 
                    item.processing_status === 'failed' ? "error" : 
                    item.processing_status === 'processing' ? "warning" : "secondary"
                  } 
                  size="sm"
                >
                  {item.processing_status}
                </ModernBadge>
              </div>
            )}
          </CardContent>
        </ModernCard>
      </div>
    </div>
  );
};