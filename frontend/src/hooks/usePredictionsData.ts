import { useState, useEffect } from 'react';
import { predictionsApi, analysisApi, Prediction } from '@/lib/api';

export const usePredictionsData = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null);

  const loadPredictions = async () => {
    try {
      setLoading(true);
      const data = await predictionsApi.list();
      console.log('Loaded predictions data:', data);
      setPredictions(data || []);
    } catch (error: any) {
      // Only log if it's not an auth issue
      if (!error.message?.includes('401')) {
        console.error('Failed to load predictions:', error);
      }
      // Set empty array if no predictions exist yet
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLatestAnalysis = async () => {
    try {
      const analysis = await analysisApi.getLatest();
      setLatestAnalysis(analysis);
    } catch (error) {
      // Don't log error for expected cases (no analysis exists yet)
      setLatestAnalysis(null);
    }
  };

  const generatePredictions = async () => {
    if (!latestAnalysis) {
      alert('No analysis found. Please generate an analysis first.');
      return;
    }

    try {
      setGenerating(true);
      const result = await predictionsApi.generate(latestAnalysis.id);
      alert(`Prediction generation queued! Job ID: ${result.jobId}`);
      
      // Refresh predictions after a delay
      setTimeout(() => {
        loadPredictions();
      }, 5000);
    } catch (error) {
      console.error('Failed to generate predictions:', error);
      alert('Failed to generate predictions. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadPredictions();
    loadLatestAnalysis();
  }, []);

  return {
    predictions,
    loading,
    generating,
    latestAnalysis,
    loadPredictions,
    generatePredictions
  };
};