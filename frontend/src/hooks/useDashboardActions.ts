import { useState, useCallback } from 'react';
import { analysisApi, predictionsApi, dashboardApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

export const useDashboardActions = (onRefresh?: () => void) => {
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [generatingPredictions, setGeneratingPredictions] = useState(false);

  const handleGenerateAnalysis = useCallback(async () => {
    try {
      setGeneratingAnalysis(true);
      const result = await analysisApi.generate();
      toast.success(`Analysis generation started! Job ID: ${result.jobId}`, {
        duration: 4000,
      });
      
      setTimeout(() => onRefresh?.(), 1000);
    } catch (error) {
      console.error('Failed to generate analysis:', error);
      toast.error('Failed to start analysis generation. Please try again.');
    } finally {
      setGeneratingAnalysis(false);
    }
  }, [onRefresh]);

  const handleGeneratePredictions = useCallback(async () => {
    try {
      setGeneratingPredictions(true);
      
      const latestAnalysis = await analysisApi.getLatest();
      if (!latestAnalysis) {
        toast.error('No analysis found. Please generate an analysis first.');
        return;
      }

      const result = await predictionsApi.generate(latestAnalysis.id);
      toast.success(`Prediction generation queued successfully! Job ID: ${result.jobId}`, {
        duration: 4000,
      });
      
      setTimeout(() => onRefresh?.(), 1000);
    } catch (error) {
      console.error('Failed to generate predictions:', error);
      toast.error('Failed to generate predictions. Please ensure you have a recent analysis.');
    } finally {
      setGeneratingPredictions(false);
    }
  }, [onRefresh]);

  const debugPredictions = useCallback(async () => {
    try {
      console.log('=== DEBUGGING PREDICTIONS ===');
      
      const allPredictions = await predictionsApi.list();
      console.log('All Predictions from API:', allPredictions);
      
      const latestAnalysis = await analysisApi.getLatest();
      console.log('Latest Analysis:', latestAnalysis);
      
      if (latestAnalysis) {
        const analysisPredictions = await predictionsApi.getByAnalysis(latestAnalysis.id);
        console.log('Predictions for Latest Analysis:', analysisPredictions);
      }
      
      const freshOverview = await dashboardApi.overview();
      console.log('Fresh Dashboard Overview:', freshOverview);
      
      toast.success('Check console for prediction debug info');
    } catch (error) {
      console.error('Debug error:', error);
      toast.error('Debug failed - check console');
    }
  }, []);

  return {
    generatingAnalysis,
    generatingPredictions,
    handleGenerateAnalysis,
    handleGeneratePredictions,
    debugPredictions
  };
};