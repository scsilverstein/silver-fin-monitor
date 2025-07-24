import { useState, useMemo } from 'react';

interface Prediction {
  id: string;
  predictionType: string;
  predictionText: string;
  confidenceLevel: number;
  timeHorizon: '1_week' | '1_month' | '3_months' | '6_months' | '1_year';
  predictionData: Record<string, any>;
  createdAt: Date | string;
  dailyAnalysisId?: string;
  [key: string]: any;
}

interface GroupedPrediction {
  timeHorizon: string;
  predictions: Prediction[];
  averageConfidence: number;
  count: number;
}

export const usePredictionsFilters = (predictions: Prediction[] = []) => {
  const [selectedHorizon, setSelectedHorizon] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Filter predictions based on selected filters
  const filteredPredictions = useMemo(() => {
    return predictions.filter((prediction) => {
      // Time horizon filter
      if (selectedHorizon !== 'all' && prediction.timeHorizon !== selectedHorizon) {
        return false;
      }

      // Prediction type filter
      if (selectedType !== 'all' && prediction.predictionType !== selectedType) {
        return false;
      }

      return true;
    });
  }, [predictions, selectedHorizon, selectedType]);

  // Group predictions by time horizon
  const groupedPredictions = useMemo(() => {
    const groups: Record<string, GroupedPrediction> = {};

    filteredPredictions.forEach((prediction) => {
      const horizon = prediction.timeHorizon;

      if (!groups[horizon]) {
        groups[horizon] = {
          timeHorizon: horizon,
          predictions: [],
          averageConfidence: 0,
          count: 0
        };
      }

      groups[horizon].predictions.push(prediction);
      groups[horizon].count++;
    });

    // Calculate average confidence for each group
    Object.values(groups).forEach((group) => {
      const totalConfidence = group.predictions.reduce(
        (sum, pred) => sum + (pred.confidenceLevel || 0),
        0
      );
      group.averageConfidence = group.count > 0 ? totalConfidence / group.count : 0;
    });

    // Sort groups by time horizon order
    const horizonOrder = ['1_week', '1_month', '3_months', '6_months', '1_year'];
    const sortedGroups = horizonOrder
      .filter(horizon => groups[horizon])
      .map(horizon => groups[horizon]);

    return sortedGroups;
  }, [filteredPredictions]);

  // Get unique prediction types for filter options
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    predictions.forEach((prediction) => {
      if (prediction.predictionType) {
        types.add(prediction.predictionType);
      }
    });
    return Array.from(types).sort();
  }, [predictions]);

  // Get unique time horizons for filter options
  const availableHorizons = useMemo(() => {
    const horizons = new Set<string>();
    predictions.forEach((prediction) => {
      if (prediction.timeHorizon) {
        horizons.add(prediction.timeHorizon);
      }
    });
    return Array.from(horizons).sort();
  }, [predictions]);

  // Helper functions for time horizon labels
  const getHorizonLabel = (horizon: string): string => {
    const labels: Record<string, string> = {
      '1_week': '1 Week',
      '1_month': '1 Month',
      '3_months': '3 Months',
      '6_months': '6 Months',
      '1_year': '1 Year'
    };
    return labels[horizon] || horizon;
  };

  const getTypeLabel = (type: string): string => {
    // Convert snake_case to Title Case
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedHorizon('all');
    setSelectedType('all');
  };

  // Get predictions count by status/confidence
  const getPredictionStats = () => {
    const high = filteredPredictions.filter(p => (p.confidenceLevel || 0) >= 0.8).length;
    const medium = filteredPredictions.filter(p => {
      const conf = p.confidenceLevel || 0;
      return conf >= 0.6 && conf < 0.8;
    }).length;
    const low = filteredPredictions.filter(p => (p.confidenceLevel || 0) < 0.6).length;

    return {
      total: filteredPredictions.length,
      high,
      medium,
      low,
      averageConfidence: filteredPredictions.length > 0 
        ? filteredPredictions.reduce((sum, p) => sum + (p.confidenceLevel || 0), 0) / filteredPredictions.length
        : 0
    };
  };

  return {
    // Filter state
    selectedHorizon,
    selectedType,
    setSelectedHorizon,
    setSelectedType,

    // Filtered data
    filteredPredictions,
    groupedPredictions,

    // Available options
    availableTypes,
    availableHorizons,

    // Helper functions
    getHorizonLabel,
    getTypeLabel,
    resetFilters,
    getPredictionStats
  };
};