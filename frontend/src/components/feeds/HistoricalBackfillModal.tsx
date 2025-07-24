import React, { useState } from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { AlertCircle, Clock, Database, Loader2, X } from 'lucide-react';
import { feedsApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface HistoricalBackfillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const durationOptions = [
  { value: 1, label: '24 Hours', description: 'Quick update with recent content' },
  { value: 3, label: '3 Days', description: 'Catch up on the last few days' },
  { value: 7, label: '1 Week', description: 'Standard weekly backfill' },
  { value: 14, label: '2 Weeks', description: 'Extended historical data' },
  { value: 30, label: '1 Month', description: 'Comprehensive monthly analysis' },
];

export const HistoricalBackfillModal: React.FC<HistoricalBackfillModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [selectedDuration, setSelectedDuration] = useState(7);
  const [isProcessing, setIsProcessing] = useState(false);
  const [options, setOptions] = useState({
    forceRefetch: true,
    generatePredictions: true,
    generateAnalysis: true
  });

  const handleBackfill = async () => {
    setIsProcessing(true);
    
    try {
      // Call the backfill endpoint
      const response = await feedsApi.startHistoricalBackfill({
        daysBack: selectedDuration,
        ...options
      });

      toast.success(`Historical backfill started! Processing ${selectedDuration} days of data.`);
      
      // Show progress toast
      toast.loading(
        'Processing historical data... This may take several minutes.',
        { duration: 30000 }
      );

      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start historical backfill');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Database className="h-5 w-5" />
              Historical Data Backfill
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Fetch and process historical feed data to improve analysis accuracy
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Duration Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Duration
            </label>
            <div className="grid gap-2">
              {durationOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedDuration(option.value)}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border text-left transition-all
                    ${selectedDuration === option.value 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-muted-foreground'
                    }
                  `}
                >
                  <div className="mt-0.5">
                    <div className={`
                      w-4 h-4 rounded-full border-2 
                      ${selectedDuration === option.value 
                        ? 'border-primary bg-primary' 
                        : 'border-muted-foreground'
                      }
                    `}>
                      {selectedDuration === option.value && (
                        <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Processing Options
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.forceRefetch}
                  onChange={(e) => setOptions(prev => ({ ...prev, forceRefetch: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Force re-fetch existing content</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.generateAnalysis}
                  onChange={(e) => setOptions(prev => ({ ...prev, generateAnalysis: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Generate daily analyses</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.generatePredictions}
                  onChange={(e) => setOptions(prev => ({ ...prev, generatePredictions: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Generate predictions</span>
              </label>
            </div>
          </div>

          {/* Warning for longer durations */}
          {selectedDuration > 14 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Processing {selectedDuration} days of data may take 10-30 minutes depending on the number of feeds.
                </p>
              </div>
            </div>
          )}

          {/* Estimated time */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <span>
              Estimated time: {selectedDuration <= 3 ? '2-5' : selectedDuration <= 7 ? '5-15' : '15-30'} minutes
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <ModernButton
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </ModernButton>
          <ModernButton
            variant="gradient"
            onClick={handleBackfill}
            disabled={isProcessing}
            icon={isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          >
            {isProcessing ? 'Starting...' : 'Start Backfill'}
          </ModernButton>
        </div>
      </div>
    </div>
  );
};