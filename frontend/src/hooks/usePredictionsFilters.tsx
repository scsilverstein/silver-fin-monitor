import { useState, useMemo } from 'react';
import React from 'react';
import { Prediction } from '@/lib/api';
import { 
  TrendingUp,
  BarChart3,
  Globe,
  Layers,
  Zap
} from 'lucide-react';

interface PredictionGroup {
  type: string;
  predictions: Prediction[];
  icon: React.ReactNode;
  color: string;
}

export const usePredictionsFilters = (predictions: Prediction[]) => {
  const [selectedHorizon, setSelectedHorizon] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const filteredPredictions = useMemo(() => {
    return predictions.filter(p => {
      const horizonMatch = selectedHorizon === 'all' || p.timeHorizon === selectedHorizon;
      const typeMatch = selectedType === 'all' || p.predictionType === selectedType;
      return horizonMatch && typeMatch;
    });
  }, [predictions, selectedHorizon, selectedType]);

  const groupedPredictions: PredictionGroup[] = useMemo(() => [
    {
      type: 'market_direction',
      predictions: filteredPredictions.filter(p => p.predictionType === 'market_direction'),
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-blue-600'
    },
    {
      type: 'economic_indicator',
      predictions: filteredPredictions.filter(p => p.predictionType === 'economic_indicator'),
      icon: <BarChart3 className="h-5 w-5" />,
      color: 'text-green-600'
    },
    {
      type: 'geopolitical_event',
      predictions: filteredPredictions.filter(p => p.predictionType === 'geopolitical_event'),
      icon: <Globe className="h-5 w-5" />,
      color: 'text-purple-600'
    },
    {
      type: 'sector_rotation',
      predictions: filteredPredictions.filter(p => p.predictionType === 'sector_rotation'),
      icon: <Layers className="h-5 w-5" />,
      color: 'text-orange-600'
    },
    {
      type: 'volatility_forecast',
      predictions: filteredPredictions.filter(p => p.predictionType === 'volatility_forecast'),
      icon: <Zap className="h-5 w-5" />,
      color: 'text-red-600'
    }
  ], [filteredPredictions]);

  return {
    selectedHorizon,
    selectedType,
    filteredPredictions,
    groupedPredictions,
    setSelectedHorizon,
    setSelectedType
  };
};