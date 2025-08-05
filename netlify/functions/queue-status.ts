import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Get queue statistics
    const [
      { data: pendingJobs },
      { data: processingJobs },
      { data: completedJobs },
      { data: failedJobs },
      { data: recentJobs }
    ] = await Promise.all([
      supabase
        .from('job_queue')
        .select('id, job_type, priority, created_at')
        .eq('status', 'pending')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true }),
      
      supabase
        .from('job_queue')
        .select('id, job_type, priority, started_at')
        .eq('status', 'processing'),
      
      supabase
        .from('job_queue')
        .select('id, job_type, completed_at')
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('completed_at', { ascending: false }),
            
      supabase
        .from('job_queue')
        .select('id, job_type, error_message, completed_at')
        .eq('status', 'failed')
        .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('completed_at', { ascending: false })
        .limit(10),
      
      supabase
        .from('job_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    // Calculate job type distribution
    const jobTypeStats = recentJobs?.reduce((acc, job) => {
      acc[job.job_type] = (acc[job.job_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Calculate processing times for completed jobs
    const processingTimes = completedJobs?.map(job => {
      if (job.completed_at && job.started_at) {
        return new Date(job.completed_at).getTime() - new Date(job.started_at).getTime();
      }
      return null;
    }).filter(time => time !== null) || [];

    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    // System health metrics
    const totalPending = pendingJobs?.length || 0;
    const totalProcessing = processingJobs?.length || 0;
    const totalCompleted = completedJobs?.length || 0;
    const totalFailed = failedJobs?.length || 0;

    const successRate = totalCompleted + totalFailed > 0 
      ? (totalCompleted / (totalCompleted + totalFailed)) * 100 
      : 100;

    const response = {
      success: true,
      data: {
        summary: {
          pending: totalPending,
          processing: totalProcessing,
          completed: totalCompleted,
          failed: totalFailed,
          successRate: Math.round(successRate * 100) / 100,
          avgProcessingTimeMs: Math.round(avgProcessingTime)
        },
        
        jobs: {
          pending: pendingJobs || [],
          processing: processingJobs || [],
          recentCompleted: completedJobs || [],
          recentFailed: failedJobs || []
        },
        
        stats: {
          jobTypeDistribution: jobTypeStats,
          processingTimes: {
            average: Math.round(avgProcessingTime),
            samples: processingTimes.length
          }
        },
        
        health: {
          queueBacklog: totalPending,
          isHealthy: totalPending < 100 && successRate > 80,
          status: totalPending < 10 ? 'healthy' : totalPending < 50 ? 'moderate' : 'high_load'
        }
      },
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Queue status error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
};