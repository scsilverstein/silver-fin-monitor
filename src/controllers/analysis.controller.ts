// Analysis controller following CLAUDE.md specification
import { Request, Response } from 'express';
import { db } from '@/services/database';
import { supabase } from '@/services/database/client';
import { cache, cacheKeys, cacheTtl } from '@/services/cache';
import { queueService } from '@/services/database/queue';
import { DailyAnalysis, Prediction, ApiResponse, TimeframeQuery, TimeframeAnalysis } from '@/types';
import { asyncHandler } from '@/middleware/error';
import { NotFoundError } from '@/middleware/error';
import { createContextLogger } from '@/utils/logger';
import { timeframeAnalysisService } from '@/services/ai/simple-timeframe-analysis';

const analysisLogger = createContextLogger('AnalysisController');

export class AnalysisController {
  // Get available timeframes for analysis
  getAvailableTimeframes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    analysisLogger.debug('Getting available timeframes');

    const timeframes = [
      { id: 'weekly', name: 'Weekly', description: 'Weekly market analysis' },
      { id: 'monthly', name: 'Monthly', description: 'Monthly market analysis' }
    ];
    
    res.json({
      success: true,
      data: timeframes
    } as ApiResponse<typeof timeframes>);
  });

  // Get timeframe-based analysis
  getTimeframeAnalysis = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { period, startDate, endDate, days } = req.query;
    
    analysisLogger.debug('Getting timeframe analysis', { period, startDate, endDate, days });

    // Validate required parameters
    if (!period) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PERIOD',
          message: 'Timeframe period is required'
        }
      });
      return;
    }

    // Construct timeframe query
    const timeframe: TimeframeQuery = {
      period: period as any,
      ...(startDate && { startDate: startDate as string }),
      ...(endDate && { endDate: endDate as string }),
      ...(days && { days: Number(days) })
    };

    try {
      // Simple implementation for testing
      const result = await timeframeAnalysisService.listTimeframeAnalyses({
        type: timeframe.period as any,
        limit: 10000
      });

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      analysisLogger.error('Timeframe analysis failed', { error, timeframe });
      
      if (error instanceof Error && error.message.includes('No content available')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_CONTENT',
            message: error.message
          }
        });
        return;
      }

      throw error;
    }
  });

  // Get recommended timeframe for a purpose
  getRecommendedTimeframe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { purpose } = req.query;
    
    analysisLogger.debug('Getting recommended timeframe', { purpose });

    // Simple static recommendations
    const recommendations = {
      'trading': 'weekly',
      'investment': 'monthly', 
      'research': 'monthly',
      'default': 'weekly'
    };
    
    const recommendation = recommendations[purpose as string] || recommendations.default;
    
    res.json({
      success: true,
      data: {
        purpose,
        recommendedTimeframe: recommendation
      }
    });
  });

  // Get all daily analyses
  listAnalyses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Use validated query if available, otherwise use req.query
    const query = (req as any).validatedQuery || req.query;
    const { startDate, endDate, limit = 30, offset = 0 } = query;
    
    analysisLogger.debug('Listing analyses', { startDate, endDate, limit, offset });

    try {
      // Use Supabase client directly
      const client = db.getClient();
      
      // Build query
      let query = client
        .from('daily_analysis')
        .select('*', { count: 'exact' });

      if (startDate) {
        // Ensure date is in ISO format without timezone
        const isoStartDate = new Date(startDate as string).toISOString().split('T')[0];
        query = query.gte('analysis_date', isoStartDate);
      }

      if (endDate) {
        // Ensure date is in ISO format without timezone
        const isoEndDate = new Date(endDate as string).toISOString().split('T')[0];
        query = query.lte('analysis_date', isoEndDate);
      }

      // Add ordering and pagination
      query = query
        .order('analysis_date', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      // Execute query
      const { data: analyses, error, count: total } = await query;

      if (error) {
        analysisLogger.error('Failed to fetch analyses', { error });
        throw new Error(`Failed to fetch analyses: ${error.message}`);
      }

      res.json({
        success: true,
        data: analyses || [],
        meta: {
          total: total || 0,
          page: Math.floor(Number(offset) / Number(limit)) + 1,
          limit: Number(limit)
        }
      } as ApiResponse<DailyAnalysis[]>);
    } catch (error) {
      analysisLogger.error('Error listing analyses', { error });
      throw error;
    }
  });

  // Get analysis by date
  getAnalysisByDate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { date } = req.params;
    
    analysisLogger.debug('Getting analysis by date', { date });

    // Try cache first
    const cacheKey = cacheKeys.dailyAnalysis(date!);
    const cached = await cache.get<DailyAnalysis>(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached
      } as ApiResponse<DailyAnalysis>);
      return;
    }

    // Get from database using Supabase client
    const client = db.getClient();
    const { data: analyses, error } = await client
      .from('daily_analysis')
      .select('*')
      .eq('analysis_date', date)
      .single();

    if (error || !analyses) {
      throw new NotFoundError('Daily analysis');
    }

    // Cache the result
    await cache.set(cacheKey, analyses, cacheTtl.veryLong);

    res.json({
      success: true,
      data: analyses
    } as ApiResponse<DailyAnalysis>);
  });

  // Get latest analysis
  getLatestAnalysis = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    analysisLogger.debug('Getting latest analysis');

    // Get latest analysis using Supabase client
    const client = db.getClient();
    const { data: analyses, error } = await client
      .from('daily_analysis')
      .select('*')
      .order('analysis_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !analyses) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NO_ANALYSIS',
          message: 'No analysis available yet'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: analyses
    } as ApiResponse<DailyAnalysis>);
  });

  // Trigger daily analysis
  triggerAnalysis = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { date = new Date().toISOString().split('T')[0], forceRegenerate = false } = req.body;
    
    analysisLogger.info('Triggering daily analysis', { date, forceRegenerate });

    // Check if analysis already exists
    if (!forceRegenerate) {
      const client = db.getClient();
      const { data: existing, error } = await client
        .from('daily_analysis')
        .select('id')
        .eq('analysis_date', date)
        .single();

      if (existing && !error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'ANALYSIS_EXISTS',
            message: 'Analysis already exists for this date. Use forceRegenerate=true to override.'
          }
        });
        return;
      }
    }

    // Queue analysis job
    const jobId = await queueService.enqueue('daily_analysis', { date, forceRegenerate }, 1);

    analysisLogger.info('Daily analysis queued', { date, jobId });

    res.json({
      success: true,
      data: {
        jobId,
        message: 'Daily analysis queued successfully',
        date
      }
    });
  });

  // Get predictions for an analysis
  getPredictions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { analysisId } = req.params;
    
    analysisLogger.debug('Getting predictions', { analysisId });

    // Try cache first
    const cacheKey = cacheKeys.predictions(analysisId!);
    const cached = await cache.get<Prediction[]>(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached
      } as ApiResponse<Prediction[]>);
      return;
    }

    // Verify analysis exists
    const analysis = await db.findById('daily_analysis', analysisId!);
    if (!analysis) {
      throw new NotFoundError('Daily analysis');
    }

    // Get predictions using Supabase client
    const client = db.getClient();
    const { data: predictions, error } = await client
      .from('predictions')
      .select('*')
      .eq('daily_analysis_id', analysisId)
      .order('time_horizon', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch predictions: ${error.message}`);
    }

    // Cache the result
    await cache.set(cacheKey, predictions || [], cacheTtl.veryLong);

    res.json({
      success: true,
      data: predictions || []
    } as ApiResponse<Prediction[]>);
  });


  // Generate predictions for an analysis
  generatePredictions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { analysisId } = req.params;
    
    analysisLogger.info('Generating predictions for analysis', { analysisId });

    // Verify analysis exists and get its date
    const { data: analysis, error: analysisError } = await supabase
      .from('daily_analysis')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      analysisLogger.error('Analysis not found', { analysisId, analysisError });
      throw new NotFoundError('Daily analysis');
    }

    const analysisDate = analysis.analysis_date;

    // Check if predictions already exist
    const { data: existingPredictions, error: countError } = await supabase
      .from('predictions')
      .select('id', { count: 'exact' })
      .eq('daily_analysis_id', analysisId);

    const predictionCount = existingPredictions?.length || 0;

    // Queue prediction generation job
    const jobId = await queueService.enqueue('generate_predictions', {
      analysisDate,
      analysisId
    }, 2); // Medium priority

    analysisLogger.info('Prediction generation queued', { 
      analysisId, 
      analysisDate, 
      jobId,
      existingPredictions: predictionCount 
    });

    res.json({
      success: true,
      data: {
        jobId,
        message: `Prediction generation queued for analysis ${analysisDate}`,
        analysisId,
        analysisDate,
        existingPredictions: predictionCount
      }
    });
  });

  // Get all predictions with filters
  listPredictions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { 
      timeHorizon, 
      predictionType,
      startDate,
      endDate,
      limit = 10000, 
      offset = 0 
    } = req.query;
    
    analysisLogger.debug('Listing predictions', { timeHorizon, predictionType, limit, offset });

    try {
      const client = db.getClient();
      
      // Build query for predictions with analysis date
      let query = client
        .from('predictions')
        .select(`
          *,
          daily_analysis!inner(analysis_date)
        `, { count: 'exact' });

      // Apply filters
      if (timeHorizon) {
        query = query.eq('time_horizon', timeHorizon);
      }

      if (predictionType) {
        query = query.eq('prediction_type', predictionType);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      // Add ordering and pagination
      query = query
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      // Execute query
      const { data: predictions, error, count: total } = await query;

      if (error) {
        analysisLogger.error('Failed to fetch predictions', { error });
        throw new Error(`Failed to fetch predictions: ${error.message}`);
      }

      res.json({
        success: true,
        data: predictions || [],
        meta: {
          total: total || 0,
          page: Math.floor(Number(offset) / Number(limit)) + 1,
          limit: Number(limit)
        }
      } as ApiResponse<Prediction[]>);
    } catch (error) {
      analysisLogger.error('Error listing predictions', { error });
      throw error;
    }
  });

  // Get prediction accuracy stats
  getPredictionAccuracy = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { timeHorizon, dateRange } = req.query;
    
    analysisLogger.debug('Getting prediction accuracy', { timeHorizon, dateRange });

    try {
      const client = db.getClient();
      
      // Get all predictions
      let query = client
        .from('predictions')
        .select('*');

      // Apply filters
      if (timeHorizon) {
        query = query.eq('time_horizon', timeHorizon);
      }

      if (dateRange) {
        // Parse date range (e.g., "30d", "90d", "1y")
        const days = parseInt(dateRange as string);
        if (!isNaN(days)) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          query = query.gte('created_at', startDate.toISOString());
        }
      }

      const { data: predictions, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch predictions: ${error.message}`);
      }

      // Get comparisons separately (if table exists)
      const predictionIds = predictions?.map(p => p.id) || [];
      let comparisons: any[] = [];
      
      if (predictionIds.length > 0) {
        try {
          const { data: comparisonData } = await client
            .from('prediction_comparisons')
            .select('*')
            .in('previous_prediction_id', predictionIds);
          
          comparisons = comparisonData || [];
        } catch (compError) {
          // Table doesn't exist yet, continue with empty comparisons
          analysisLogger.info('Prediction comparisons table not available, using empty comparisons');
          comparisons = [];
        }
      }

      // Process the data to calculate stats
      const statsByHorizon: Record<string, any> = {};

      predictions?.forEach(prediction => {
        const horizon = prediction.time_horizon;
        if (!statsByHorizon[horizon]) {
          statsByHorizon[horizon] = {
            time_horizon: horizon,
            total_predictions: 0,
            evaluated_predictions: 0,
            accuracy_scores: [],
            high_accuracy_count: 0,
            low_accuracy_count: 0
          };
        }

        statsByHorizon[horizon].total_predictions++;

        // Check if this prediction has been evaluated
        const comparison = comparisons.find(c => c.previous_prediction_id === prediction.id);
        if (comparison && comparison.accuracy_score !== null) {
          statsByHorizon[horizon].evaluated_predictions++;
          statsByHorizon[horizon].accuracy_scores.push(comparison.accuracy_score);
          
          if (comparison.accuracy_score >= 0.7) {
            statsByHorizon[horizon].high_accuracy_count++;
          }
          if (comparison.accuracy_score < 0.5) {
            statsByHorizon[horizon].low_accuracy_count++;
          }
        }
      });

      // Calculate averages and format output
      const stats = Object.values(statsByHorizon).map(stat => ({
        time_horizon: stat.time_horizon,
        total_predictions: stat.total_predictions,
        evaluated_predictions: stat.evaluated_predictions,
        avg_accuracy: stat.accuracy_scores.length > 0 
          ? stat.accuracy_scores.reduce((a: number, b: number) => a + b, 0) / stat.accuracy_scores.length 
          : null,
        high_accuracy_count: stat.high_accuracy_count,
        low_accuracy_count: stat.low_accuracy_count
      }));

      // Sort by time horizon
      stats.sort((a, b) => {
        const order = ['1_week', '1_month', '3_months', '6_months', '1_year'];
        return order.indexOf(a.time_horizon) - order.indexOf(b.time_horizon);
      });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      analysisLogger.error('Error getting prediction accuracy', { error });
      throw error;
    }
  });

  // Compare prediction with outcome
  comparePrediction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { predictionId } = req.params;
    
    analysisLogger.info('Triggering prediction comparison', { predictionId });

    // Verify prediction exists
    const prediction = await db.findById('predictions', predictionId!);
    if (!prediction) {
      throw new NotFoundError('Prediction');
    }

    // Queue comparison job
    const jobId = await queueService.enqueue('prediction_comparison', { 
      predictionId,
      date: new Date().toISOString().split('T')[0]
    }, 3);

    analysisLogger.info('Prediction comparison queued', { predictionId, jobId });

    res.json({
      success: true,
      data: {
        jobId,
        message: 'Prediction comparison queued successfully'
      }
    });
  });

  // Generate weekly analysis
  generateWeeklyAnalysis = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { referenceDate } = req.body;
    const date = referenceDate ? new Date(referenceDate) : new Date();
    
    analysisLogger.info('Generating weekly analysis', { referenceDate: date.toISOString() });

    try {
      const analysis = await timeframeAnalysisService.generateCompleteTimeframeAnalysis('weekly', date);
      
      res.json({
        success: true,
        data: analysis,
        message: 'Weekly analysis generated successfully'
      });
    } catch (error) {
      analysisLogger.error('Error generating weekly analysis', { error });
      throw error;
    }
  });

  // Generate monthly analysis
  generateMonthlyAnalysis = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { referenceDate } = req.body;
    const date = referenceDate ? new Date(referenceDate) : new Date();
    
    analysisLogger.info('Generating monthly analysis', { referenceDate: date.toISOString() });

    try {
      const analysis = await timeframeAnalysisService.generateCompleteTimeframeAnalysis('monthly', date);
      
      res.json({
        success: true,
        data: analysis,
        message: 'Monthly analysis generated successfully'
      });
    } catch (error) {
      analysisLogger.error('Error generating monthly analysis', { error });
      throw error;
    }
  });

  // List timeframe analyses
  listTimeframeAnalyses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { 
      type, 
      limit = 10000, 
      offset = 0, 
      startDate, 
      endDate 
    } = req.query;
    
    analysisLogger.debug('Listing timeframe analyses', { 
      type, 
      limit, 
      offset, 
      startDate, 
      endDate 
    });

    try {
      const result = await timeframeAnalysisService.listTimeframeAnalyses({
        type: type as any,
        limit: Number(limit),
        offset: Number(offset),
        startDate: startDate as string,
        endDate: endDate as string
      });
      
      res.json({
        success: true,
        data: result.data,
        meta: {
          total: result.total,
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error) {
      analysisLogger.error('Error listing timeframe analyses', { error });
      throw error;
    }
  });

  // Get specific timeframe analysis
  getTimeframeAnalysisById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    analysisLogger.debug('Getting timeframe analysis by ID', { id });

    try {
      const analysis = await timeframeAnalysisService.getTimeframeAnalysis(id);
      
      if (!analysis) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Timeframe analysis not found'
          }
        });
        return;
      }
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      analysisLogger.error('Error getting timeframe analysis', { error });
      throw error;
    }
  });
}

export const analysisController = new AnalysisController();