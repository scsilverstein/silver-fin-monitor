import React, { useState } from 'react';
import { ModernCard, CardHeader, CardContent } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernInput } from '@/components/ui/ModernInput';
import { X, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface GenerateAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (date?: string) => Promise<void>;
}

export const GenerateAnalysisModal: React.FC<GenerateAnalysisModalProps> = ({
  isOpen,
  onClose,
  onGenerate
}) => {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setError('');
    setIsGenerating(true);
    
    try {
      await onGenerate(date);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <ModernCard className="relative z-10 w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Generate Analysis</h2>
            <ModernButton
              variant="ghost"
              size="sm"
              icon={<X className="h-4 w-4" />}
              onClick={onClose}
            />
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Analysis Date
              </label>
              <ModernInput
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                icon={<Calendar className="h-4 w-4" />}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Generate analysis for historical or current date
              </p>
            </div>
            
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div className="flex gap-3 justify-end">
              <ModernButton
                variant="outline"
                onClick={onClose}
                disabled={isGenerating}
              >
                Cancel
              </ModernButton>
              <ModernButton
                variant="primary"
                onClick={handleGenerate}
                disabled={isGenerating}
                icon={isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </ModernButton>
            </div>
          </div>
        </CardContent>
      </ModernCard>
    </div>
  );
};