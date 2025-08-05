import React from 'react';
import { Button } from '@/components/ui/Button';
import { useQueueTrigger, QueueTriggerType } from '@/hooks/useQueueTrigger';

export const QueueDebug: React.FC = () => {
  const feedTrigger = useQueueTrigger({
    type: QueueTriggerType.FEED_REFRESH,
    cooldownMinutes: 1, // Short cooldown for testing
    enabled: true
  });

  const contentTrigger = useQueueTrigger({
    type: QueueTriggerType.CONTENT_REFRESH,
    cooldownMinutes: 1,
    enabled: true
  });

  const clearCooldowns = () => {
    localStorage.removeItem('queue_triggers');
    console.log('Cleared queue trigger cooldowns');
    window.location.reload();
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Queue Debug</h1>
      
      <div className="space-y-2">
        <Button onClick={clearCooldowns} variant="outline">
          Clear All Cooldowns
        </Button>
        
        <Button onClick={() => feedTrigger.triggerManually()}>
          Trigger Feed Refresh
        </Button>
        
        <Button onClick={() => contentTrigger.triggerManually()}>
          Trigger Content Refresh
        </Button>
      </div>
      
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold">Cooldown Status:</h3>
        <p>Feed: {JSON.stringify(feedTrigger.getCooldownStatus())}</p>
        <p>Content: {JSON.stringify(contentTrigger.getCooldownStatus())}</p>
      </div>
    </div>
  );
};

export default QueueDebug;