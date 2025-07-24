import { useState, useEffect, useCallback } from 'react';
import { intelligenceApi } from '@/lib/intelligence-api';
import { format } from 'date-fns';

interface UseIntelligenceDataProps {
  selectedTimeframe: string;
  selectedMonth: Date;
}

interface IntelligenceData {
  divergenceData: any;
  networkData: any;
  anomalyData: any[];
  narrativeMomentumData: any;
  silenceDetectionData: any;
  languageComplexityData: any;
  alerts: any[];
}

export const useIntelligenceData = ({ selectedTimeframe, selectedMonth }: UseIntelligenceDataProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<IntelligenceData>({
    divergenceData: null,
    networkData: null,
    anomalyData: [],
    narrativeMomentumData: null,
    silenceDetectionData: null,
    languageComplexityData: null,
    alerts: [],
  });

  const mapTimeframes = useCallback((timeframe: string) => {
    const narrativeTimeframe = timeframe === '1d' ? '24h' : 
                              timeframe === '7d' ? '7d' : 
                              timeframe === '30d' ? '30d' : '7d';
    
    const silenceLookbackDays = timeframe === '1d' ? 7 : 
                               timeframe === '7d' ? 30 : 
                               timeframe === '30d' ? 60 : 
                               timeframe === '90d' ? 90 : 30;
    
    return { narrativeTimeframe, silenceLookbackDays };
  }, []);

  const loadIntelligenceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { narrativeTimeframe, silenceLookbackDays } = mapTimeframes(selectedTimeframe);

      const [divergence, network, anomalies, narrativeMomentum, silenceDetection, languageComplexity, alertsData] = await Promise.all([
        intelligenceApi.getSignalDivergence(selectedTimeframe),
        intelligenceApi.getEntityNetwork(selectedTimeframe, 5),
        intelligenceApi.getAnomalyCalendar(format(selectedMonth, 'yyyy-MM')),
        intelligenceApi.getNarrativeMomentum(narrativeTimeframe as '24h' | '7d' | '30d'),
        intelligenceApi.getSilenceDetection(silenceLookbackDays),
        intelligenceApi.getLanguageComplexity(narrativeTimeframe as '24h' | '7d' | '30d'),
        intelligenceApi.getAlerts('all')
      ]);

      setData({
        divergenceData: divergence,
        networkData: network,
        anomalyData: anomalies,
        narrativeMomentumData: narrativeMomentum,
        silenceDetectionData: silenceDetection,
        languageComplexityData: languageComplexity,
        alerts: alertsData?.alerts || [],
      });
    } catch (err) {
      console.error('Failed to load intelligence data:', err);
      setError('Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  }, [selectedTimeframe, selectedMonth, mapTimeframes]);

  useEffect(() => {
    loadIntelligenceData();
  }, [loadIntelligenceData]);

  return {
    loading,
    error,
    data,
    refresh: loadIntelligenceData,
  };
};