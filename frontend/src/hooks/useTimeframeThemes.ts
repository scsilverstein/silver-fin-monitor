import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '@/lib/api';

export interface TimeframeThemes {
  week: string[];
  month: string[];
  year: string[];
  marketDrivers: {
    week: string[];
    month: string[];
    year: string[];
  };
  riskFactors: {
    week: string[];
    month: string[];
    year: string[];
  };
}

export const useTimeframeThemes = () => {
  const [themes, setThemes] = useState<TimeframeThemes>({
    week: [],
    month: [],
    year: [],
    marketDrivers: {
      week: [],
      month: [],
      year: []
    },
    riskFactors: {
      week: [],
      month: [],
      year: []
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThemes = useCallback(async () => {
    try {
      setError(null);
      const [weekData, monthData, yearData] = await Promise.all([
        dashboardApi.themes('week'),
        dashboardApi.themes('month'),
        dashboardApi.themes('year')
      ]);

      setThemes({
        week: weekData.themes || [],
        month: monthData.themes || [],
        year: yearData.themes || [],
        marketDrivers: {
          week: weekData.marketDrivers || [],
          month: monthData.marketDrivers || [],
          year: yearData.marketDrivers || []
        },
        riskFactors: {
          week: weekData.riskFactors || [],
          month: monthData.riskFactors || [],
          year: yearData.riskFactors || []
        }
      });
    } catch (error) {
      console.error('Failed to load timeframe themes:', error);
      setError('Failed to load timeframe themes');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshThemes = useCallback(async () => {
    setLoading(true);
    await loadThemes();
  }, [loadThemes]);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  return {
    themes,
    loading,
    error,
    refreshThemes
  };
};