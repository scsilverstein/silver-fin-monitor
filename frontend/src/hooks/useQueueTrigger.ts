import { useEffect, useRef, useMemo } from 'react';
import { queueApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

export enum QueueTriggerType {
  FEED_REFRESH = 'feed_refresh',
  CONTENT_REFRESH = 'content_refresh',
  ANALYSIS_REFRESH = 'analysis_refresh',
  PREDICTION_REFRESH = 'prediction_refresh'
}

interface QueueTriggerOptions {
  type: QueueTriggerType;
  enabled?: boolean;
  cooldownMinutes?: number;
  payload?: any;
}

const TRIGGER_STORAGE_KEY = 'queue_triggers';

interface TriggerRecord {
  type: QueueTriggerType;
  lastTriggered: number;
}

export const useQueueTrigger = ({
  type,
  enabled = true,
  cooldownMinutes = 30,
  payload = {}
}: QueueTriggerOptions) => {
  const hasTriggeredRef = useRef(false);
  
  // Memoize payload to prevent infinite re-renders
  const memoizedPayload = useMemo(() => payload, [JSON.stringify(payload)]);

  useEffect(() => {
    if (!enabled) return;
    
    // Don't use hasTriggeredRef for initial check - let cooldown handle it
    const checkAndTrigger = async () => {
      try {
        // Get stored trigger records
        const storedTriggers = localStorage.getItem(TRIGGER_STORAGE_KEY);
        const triggers: Record<string, TriggerRecord> = storedTriggers 
          ? JSON.parse(storedTriggers) 
          : {};

        const now = Date.now();
        const lastTrigger = triggers[type];
        const cooldownMs = cooldownMinutes * 60 * 1000;

        // Check if we're within cooldown period
        if (lastTrigger && (now - lastTrigger.lastTriggered) < cooldownMs) {
          return;
        }
        
        // Trigger appropriate queue job based on type
        let jobId: string | null = null;

        switch (type) {
          case QueueTriggerType.FEED_REFRESH:
            // Queue feed refresh for all active feeds
            const result = await queueApi.enqueueJob({
              jobType: 'feed_fetch_all',
              payload: {
                ...memoizedPayload,
                triggeredBy: 'page_navigation',
                timestamp: new Date().toISOString()
              }
            });
            jobId = result.jobId;
            break;

          case QueueTriggerType.CONTENT_REFRESH:
            // Queue content processing check
            const contentResult = await queueApi.enqueueJob({
              jobType: 'content_process_check',
              payload: {
                ...memoizedPayload,
                triggeredBy: 'page_navigation',
                timestamp: new Date().toISOString()
              }
            });
            jobId = contentResult.jobId;
            break;

          case QueueTriggerType.ANALYSIS_REFRESH:
            // Check if daily analysis needs to be generated
            const today = new Date().toISOString().split('T')[0];
            const analysisResult = await queueApi.enqueueJob({
              jobType: 'daily_analysis',
              payload: {
                date: today,
                ...memoizedPayload,
                triggeredBy: 'page_navigation'
              }
            });
            jobId = analysisResult.jobId;
            break;

          case QueueTriggerType.PREDICTION_REFRESH:
            // Check if predictions need to be generated or compared
            const predictionResult = await queueApi.enqueueJob({
              jobType: 'prediction_check',
              payload: {
                ...memoizedPayload,
                triggeredBy: 'page_navigation',
                timestamp: new Date().toISOString()
              }
            });
            jobId = predictionResult.jobId;
            break;
        }

        if (jobId) {
          // Update trigger record
          triggers[type] = {
            type,
            lastTriggered: now
          };
          localStorage.setItem(TRIGGER_STORAGE_KEY, JSON.stringify(triggers));
          
          toast.success(`Background ${type.replace(/_/g, ' ')} task queued`, {
            duration: 3000,
            position: 'bottom-right'
          });
        }
      } catch (error) {
        // Silent failure for background operations
      }
    };

    checkAndTrigger();
  }, [type, enabled, cooldownMinutes, memoizedPayload]);

  // Function to manually trigger (bypasses cooldown)
  const triggerManually = async () => {
    try {
      let jobId: string | null = null;

      switch (type) {
        case QueueTriggerType.FEED_REFRESH:
          const feedResult = await queueApi.enqueueJob({
            jobType: 'feed_fetch_all',
            payload: {
              ...payload,
              triggeredBy: 'manual',
              timestamp: new Date().toISOString()
            }
          });
          jobId = feedResult.jobId;
          toast.success('Feed refresh queued');
          break;

        case QueueTriggerType.CONTENT_REFRESH:
          const contentResult = await queueApi.enqueueJob({
            jobType: 'content_process_check',
            payload: {
              ...payload,
              triggeredBy: 'manual',
              timestamp: new Date().toISOString()
            }
          });
          jobId = contentResult.jobId;
          toast.success('Content processing queued');
          break;

        case QueueTriggerType.ANALYSIS_REFRESH:
          const today = new Date().toISOString().split('T')[0];
          const analysisResult = await queueApi.enqueueJob({
            jobType: 'daily_analysis',
            payload: {
              date: today,
              ...payload,
              triggeredBy: 'manual'
            }
          });
          jobId = analysisResult.jobId;
          toast.success('Analysis generation queued');
          break;

        case QueueTriggerType.PREDICTION_REFRESH:
          const predictionResult = await queueApi.enqueueJob({
            jobType: 'prediction_check',
            payload: {
              ...payload,
              triggeredBy: 'manual',
              timestamp: new Date().toISOString()
            }
          });
          jobId = predictionResult.jobId;
          toast.success('Prediction check queued');
          break;
      }

      if (jobId) {
        // Update trigger record even for manual triggers
        const storedTriggers = localStorage.getItem(TRIGGER_STORAGE_KEY);
        const triggers: Record<string, TriggerRecord> = storedTriggers 
          ? JSON.parse(storedTriggers) 
          : {};
        
        triggers[type] = {
          type,
          lastTriggered: Date.now()
        };
        localStorage.setItem(TRIGGER_STORAGE_KEY, JSON.stringify(triggers));
      }

      return jobId;
    } catch (error) {
      console.error(`Failed to manually trigger ${type}:`, error);
      toast.error('Failed to queue task');
      throw error;
    }
  };

  // Get cooldown status
  const getCooldownStatus = (): { inCooldown: boolean; minutesRemaining: number } => {
    const storedTriggers = localStorage.getItem(TRIGGER_STORAGE_KEY);
    const triggers: Record<string, TriggerRecord> = storedTriggers 
      ? JSON.parse(storedTriggers) 
      : {};

    const lastTrigger = triggers[type];
    if (!lastTrigger) {
      return { inCooldown: false, minutesRemaining: 0 };
    }

    const now = Date.now();
    const cooldownMs = cooldownMinutes * 60 * 1000;
    const timeSinceLast = now - lastTrigger.lastTriggered;

    if (timeSinceLast < cooldownMs) {
      const minutesRemaining = Math.ceil((cooldownMs - timeSinceLast) / 60000);
      return { inCooldown: true, minutesRemaining };
    }

    return { inCooldown: false, minutesRemaining: 0 };
  };

  return {
    triggerManually,
    getCooldownStatus
  };
};