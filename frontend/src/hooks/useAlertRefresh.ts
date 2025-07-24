import { useState, useEffect, useRef } from 'react';
import { intelligenceApi } from '@/lib/intelligence-api';

interface UseAlertRefreshOptions {
  interval?: number;
  enabled?: boolean;
}

export const useAlertRefresh = (options: UseAlertRefreshOptions = {}) => {
  const { interval = 60000, enabled = true } = options;
  const [alerts, setAlerts] = useState<any[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();

  const refreshAlerts = async () => {
    try {
      const alertsData = await intelligenceApi.getAlerts('all');
      setAlerts(alertsData?.alerts || []);
    } catch (err) {
      console.error('Failed to refresh alerts:', err);
    }
  };

  useEffect(() => {
    if (!enabled) return;

    refreshAlerts();
    intervalRef.current = setInterval(refreshAlerts, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, enabled]);

  return { alerts, refreshAlerts };
};