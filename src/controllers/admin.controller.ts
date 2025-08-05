// Admin controller for user and system management
import { Request, Response } from 'express';
import { authService } from '@/services/auth/supabase-auth';
import { asyncHandler } from '@/middleware/error';
import { createContextLogger } from '@/utils/logger';
import { db } from '@/services/database/index';
import { validateUUID } from '@/utils/validation';
import { OpenAI } from 'openai';
import { format, subDays } from 'date-fns';

const adminLogger = createContextLogger('AdminController');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AdminController {
  // Get all users with pagination and filters
  listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      role, 
      subscriptionTier, 
      subscriptionStatus,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    adminLogger.info('Listing users', { page, limit, search });

    try {
      // Build query
      let query = `
        SELECT 
          u.id,
          u.email,
          u.full_name,
          u.role,
          u.subscription_tier,
          u.subscription_status,
          u.created_at,
          u.updated_at,
          u.last_login_at,
          u.email_verified,
          us.plan_id,
          us.current_period_end,
          COUNT(DISTINCT uu.id) as usage_count
        FROM users u
        LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
        LEFT JOIN user_usage uu ON u.id = uu.user_id AND uu.created_at > NOW() - INTERVAL '30 days'
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;

      // Add filters
      if (search) {
        query += ` AND (u.email ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (role) {
        query += ` AND u.role = $${paramIndex}`;
        params.push(role);
        paramIndex++;
      }

      if (subscriptionTier) {
        query += ` AND u.subscription_tier = $${paramIndex}`;
        params.push(subscriptionTier);
        paramIndex++;
      }

      if (subscriptionStatus) {
        query += ` AND u.subscription_status = $${paramIndex}`;
        params.push(subscriptionStatus);
        paramIndex++;
      }

      // Group by for aggregation
      query += ` GROUP BY u.id, us.plan_id, us.current_period_end`;

      // Add sorting
      const validSortColumns = ['created_at', 'last_login_at', 'email', 'full_name'];
      const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'created_at';
      const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY u.${sortColumn} ${order}`;

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(Number(limit), offset);

      // Execute query
      const users = await db.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        WHERE 1=1
      `;
      
      const countParams: any[] = [];
      let countParamIndex = 1;

      if (search) {
        countQuery += ` AND (u.email ILIKE $${countParamIndex} OR u.full_name ILIKE $${countParamIndex})`;
        countParams.push(`%${search}%`);
        countParamIndex++;
      }

      if (role) {
        countQuery += ` AND u.role = $${countParamIndex}`;
        countParams.push(role);
        countParamIndex++;
      }

      if (subscriptionTier) {
        countQuery += ` AND u.subscription_tier = $${countParamIndex}`;
        countParams.push(subscriptionTier);
        countParamIndex++;
      }

      if (subscriptionStatus) {
        countQuery += ` AND u.subscription_status = $${countParamIndex}`;
        countParams.push(subscriptionStatus);
        countParamIndex++;
      }

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult[0]?.total || '0');

      res.json({
        success: true,
        data: users,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      adminLogger.error('Failed to list users', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_USERS_ERROR',
          message: 'Failed to retrieve users'
        }
      });
    }
  });

  // Get specific user details
  getUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    if (!userId || !validateUUID(userId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID format'
        }
      });
      return;
    }

    try {
      const user = await authService.getUserById(userId!);
      
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
        return;
      }

      // Get additional stats
      const stats = await db.query(`
        SELECT 
          COUNT(DISTINCT uu.id) as total_api_calls,
          COUNT(DISTINCT rf.id) as feeds_processed,
          COUNT(DISTINCT da.id) as analyses_generated,
          COUNT(DISTINCT p.id) as predictions_made
        FROM users u
        LEFT JOIN user_usage uu ON u.id = uu.user_id AND uu.usage_type = 'api_calls'
        LEFT JOIN raw_feeds rf ON u.id = rf.processed_by
        LEFT JOIN daily_analysis da ON u.id = da.created_by
        LEFT JOIN predictions p ON u.id = p.created_by
        WHERE u.id = $1
      `, [userId]);

      res.json({
        success: true,
        data: {
          user,
          stats: stats[0] || {}
        }
      });
    } catch (error) {
      adminLogger.error('Failed to get user', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_USER_ERROR',
          message: 'Failed to retrieve user details'
        }
      });
    }
  });

  // Update user details (admin override)
  updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { 
      role, 
      subscriptionTier, 
      subscriptionStatus,
      emailVerified,
      usageLimits
    } = req.body;

    if (!userId || !validateUUID(userId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID format'
        }
      });
      return;
    }

    try {
      const updates: any = {};
      
      if (role) updates.role = role;
      if (subscriptionTier) updates.subscription_tier = subscriptionTier;
      if (subscriptionStatus) updates.subscription_status = subscriptionStatus;
      if (typeof emailVerified === 'boolean') updates.email_verified = emailVerified;
      if (usageLimits) updates.usage_limits = usageLimits;

      // Update user
      const result = await db.query(`
        UPDATE users 
        SET ${Object.keys(updates).map((key, idx) => `${key} = $${idx + 2}`).join(', ')}, 
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [userId!, ...Object.values(updates)]);

      if (result.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
        return;
      }

      adminLogger.info('User updated by admin', { userId, updates });

      res.json({
        success: true,
        data: result[0]
      });
    } catch (error) {
      adminLogger.error('Failed to update user', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_USER_ERROR',
          message: 'Failed to update user'
        }
      });
    }
  });

  // Delete user (soft delete)
  deleteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    if (!userId || !validateUUID(userId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID format'
        }
      });
      return;
    }

    try {
      // Don't allow deleting the requesting admin
      if (userId === req.user?.id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_DELETE_SELF',
            message: 'Cannot delete your own account'
          }
        });
        return;
      }

      await authService.deleteUser(userId);

      adminLogger.info('User deleted by admin', { userId, deletedBy: req.user?.id });

      res.json({
        success: true,
        data: {
          message: 'User deleted successfully'
        }
      });
    } catch (error) {
      adminLogger.error('Failed to delete user', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_USER_ERROR',
          message: 'Failed to delete user'
        }
      });
    }
  });

  // Get system statistics
  getSystemStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '30 days') as new_users_30d,
          (SELECT COUNT(*) FROM users WHERE subscription_tier != 'free') as paid_users,
          (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active') as active_subscriptions,
          (SELECT COUNT(*) FROM raw_feeds WHERE created_at > NOW() - INTERVAL '24 hours') as feeds_24h,
          (SELECT COUNT(*) FROM daily_analysis) as total_analyses,
          (SELECT COUNT(*) FROM predictions) as total_predictions,
          (SELECT COUNT(*) FROM job_queue WHERE status = 'pending') as pending_jobs,
          (SELECT COUNT(*) FROM job_queue WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') as failed_jobs_24h,
          (SELECT SUM(count) FROM user_usage WHERE created_at > NOW() - INTERVAL '24 hours') as api_calls_24h
      `);

      // Get subscription breakdown
      const subscriptionBreakdown = await db.query(`
        SELECT 
          subscription_tier,
          COUNT(*) as count,
          ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)) as avg_days_active
        FROM users
        GROUP BY subscription_tier
        ORDER BY count DESC
      `);

      // Get top active users
      const topUsers = await db.query(`
        SELECT 
          u.email,
          u.subscription_tier,
          COUNT(uu.id) as api_calls_30d
        FROM users u
        LEFT JOIN user_usage uu ON u.id = uu.user_id AND uu.created_at > NOW() - INTERVAL '30 days'
        GROUP BY u.id, u.email, u.subscription_tier
        ORDER BY api_calls_30d DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        data: {
          overview: stats[0] || {},
          subscriptionBreakdown,
          topUsers
        }
      });
    } catch (error) {
      adminLogger.error('Failed to get system stats', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SYSTEM_STATS_ERROR',
          message: 'Failed to retrieve system statistics'
        }
      });
    }
  });

  // Create admin user
  createAdminUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password, fullName } = req.body;

    try {
      const result = await authService.register({
        email,
        password,
        fullName,
        role: 'admin',
        subscriptionTier: 'enterprise'
      });

      adminLogger.info('Admin user created', { 
        email, 
        createdBy: req.user?.id 
      });

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          temporaryPassword: result.temporaryPassword,
          message: result.temporaryPassword 
            ? 'Admin user created with temporary password'
            : 'Admin user created successfully'
        }
      });
    } catch (error) {
      adminLogger.error('Failed to create admin user', error);
      res.status(400).json({
        success: false,
        error: {
          code: 'CREATE_ADMIN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create admin user'
        }
      });
    }
  });

  // Reset user password
  resetUserPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!userId || !validateUUID(userId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID format'
        }
      });
      return;
    }

    try {
      await authService.changePassword(userId, newPassword);

      adminLogger.info('User password reset by admin', { 
        userId, 
        resetBy: req.user?.id 
      });

      res.json({
        success: true,
        data: {
          message: 'Password reset successfully'
        }
      });
    } catch (error) {
      adminLogger.error('Failed to reset user password', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RESET_PASSWORD_ERROR',
          message: 'Failed to reset user password'
        }
      });
    }
  });

  // Grant subscription (for testing/support)
  grantSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { tier, durationDays = 30 } = req.body;

    if (!userId || !validateUUID(userId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID format'
        }
      });
      return;
    }

    if (!['professional', 'enterprise'].includes(tier)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIER',
          message: 'Invalid subscription tier'
        }
      });
      return;
    }

    try {
      // Update user subscription
      await db.query(`
        UPDATE users 
        SET 
          subscription_tier = $2,
          subscription_status = 'active',
          trial_ends_at = NOW() + INTERVAL '${durationDays} days',
          updated_at = NOW()
        WHERE id = $1
      `, [userId, tier]);

      // Create subscription record
      await db.query(`
        INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_end, metadata)
        VALUES ($1, $2, 'active', NOW() + INTERVAL '${durationDays} days', $3)
        ON CONFLICT (user_id) WHERE status = 'active'
        DO UPDATE SET 
          plan_id = EXCLUDED.plan_id,
          current_period_end = EXCLUDED.current_period_end,
          updated_at = NOW()
      `, [userId, tier, { granted_by: req.user?.id, reason: 'admin_grant' }]);

      adminLogger.info('Subscription granted by admin', { 
        userId, 
        tier,
        durationDays,
        grantedBy: req.user?.id 
      });

      res.json({
        success: true,
        data: {
          message: `${tier} subscription granted for ${durationDays} days`
        }
      });
    } catch (error) {
      adminLogger.error('Failed to grant subscription', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GRANT_SUBSCRIPTION_ERROR',
          message: 'Failed to grant subscription'
        }
      });
    }
  });

  // Backfill historical analysis
  backfillHistoricalAnalysis = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.body;
      
      // Start the backfill process in the background
      res.json({ 
        success: true, 
        message: 'Historical analysis backfill started. This will run in the background.' 
      });

      // Run the backfill asynchronously
      this.runBackfillProcess(
        startDate ? new Date(startDate) : new Date('2025-07-14'),
        endDate ? new Date(endDate) : new Date()
      ).catch(error => {
        adminLogger.error('Backfill process failed:', error);
      });

    } catch (error) {
      adminLogger.error('Failed to start backfill:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to start historical analysis backfill' 
      });
    }
  });

  // Get backfill status
  getBackfillStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // Get analysis coverage
      const client = db;
      const { data: analyses } = await client
        .from('daily_analysis')
        .select('analysis_date')
        .order('analysis_date', { ascending: true });

      const { data: oldestContent } = await client
        .from('raw_feeds')
        .select('published_at')
        .order('published_at', { ascending: true })
        .limit(1)
        .single();

      const { data: newestContent } = await client
        .from('raw_feeds')
        .select('published_at')
        .order('published_at', { ascending: false })
        .limit(1)
        .single();

      // Calculate coverage
      const analyzedDates = new Set(analyses?.map(a => a.analysis_date) || []);
      const totalDays = oldestContent && newestContent ? 
        Math.ceil((new Date(newestContent.published_at).getTime() - new Date(oldestContent.published_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      res.json({
        success: true,
        data: {
          totalAnalyses: analyses?.length || 0,
          oldestContent: oldestContent?.published_at,
          newestContent: newestContent?.published_at,
          totalDaysWithContent: totalDays,
          analyzedDates: Array.from(analyzedDates).sort(),
          coverage: totalDays > 0 ? ((analyses?.length || 0) / totalDays * 100).toFixed(1) + '%' : '0%'
        }
      });
    } catch (error) {
      adminLogger.error('Failed to get backfill status:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get backfill status' 
      });
    }
  });

  private async runBackfillProcess(startDate: Date, endDate: Date) {
    adminLogger.info(`Starting historical analysis backfill from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
    
    let currentDate = new Date(startDate);
    let successCount = 0;
    let errorCount = 0;

    while (currentDate <= endDate) {
      try {
        await this.generateDailyAnalysisForDate(currentDate);
        successCount++;
      } catch (error) {
        adminLogger.error(`Failed to generate analysis for ${format(currentDate, 'yyyy-MM-dd')}:`, error);
        errorCount++;
      }
      
      // Add delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Move to next date
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    adminLogger.info(`Backfill complete. Success: ${successCount}, Errors: ${errorCount}`);
  }

  private async generateDailyAnalysisForDate(date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    adminLogger.info(`Generating analysis for ${dateStr}...`);

    // Check if analysis already exists
    const client = db;
    const { data: existingAnalysis } = await client
      .from('daily_analysis')
      .select('id')
      .eq('analysis_date', dateStr)
      .single();

    if (existingAnalysis) {
      adminLogger.info(`Analysis already exists for ${dateStr}, skipping...`);
      return;
    }

    // Define the type for the joined query result
    interface ProcessedContentWithRelations {
      id: string;
      summary: string;
      key_topics: string[];
      sentiment_score: number;
      entities: any;
      raw_feed_id: string;
      raw_feeds: {
        title: string;
        published_at: string;
        source_id: string;
        feed_sources: {
          name: string;
          type: string;
        };
      };
    }

    // Fetch processed content for this date
    const { data: content, error } = await client
      .from('processed_content')
      .select(`
        id,
        summary,
        key_topics,
        sentiment_score,
        entities,
        raw_feed_id,
        raw_feeds!inner(
          title,
          published_at,
          source_id,
          feed_sources!inner(
            name,
            type
          )
        )
      `)
      .gte('raw_feeds.published_at', `${dateStr}T00:00:00`)
      .lt('raw_feeds.published_at', `${dateStr}T23:59:59`);

    if (error) throw error;

    if (!content || content.length === 0) {
      adminLogger.info(`No content found for ${dateStr}, skipping...`);
      return;
    }

    adminLogger.info(`Found ${content.length} content items for ${dateStr}`);

    // Type assertion for TypeScript - convert to unknown first due to structure mismatch
    const typedContent = content as unknown as ProcessedContentWithRelations[];

    // Prepare content for AI analysis
    const contentSummary = typedContent.map(item => ({
      title: item.raw_feeds?.title,
      source: item.raw_feeds?.feed_sources?.name,
      summary: item.summary,
      sentiment: item.sentiment_score,
      topics: item.key_topics,
      entities: item.entities
    }));

    // Generate AI analysis
    const prompt = `You are a world-class market analyst synthesizing information from multiple sources.

Today's date: ${dateStr}

Source content:
${JSON.stringify(contentSummary, null, 2)}

Please analyze the current market and world state based on this information and provide:

1. **Overall Market Sentiment**: Bullish/Bearish/Neutral with confidence level
2. **Key Themes**: Top 5 themes emerging from the content
3. **Market Drivers**: Primary factors affecting markets
4. **Geopolitical Context**: Key geopolitical developments
5. **Economic Indicators**: Relevant economic signals
6. **Risk Factors**: Potential risks to monitor

Format your response as JSON with the following structure:
{
  "market_sentiment": "bullish|bearish|neutral",
  "confidence_score": 0.85,
  "key_themes": ["theme1", "theme2", ...],
  "market_drivers": ["driver1", "driver2", ...],
  "geopolitical_context": "summary",
  "economic_indicators": ["indicator1", "indicator2", ...],
  "risk_factors": ["risk1", "risk2", ...],
  "overall_summary": "comprehensive summary"
}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial market analyst. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const aiAnalysis = JSON.parse(completion.choices[0].message.content || '{}');

    // Store the analysis
    const { error: insertError } = await client
      .from('daily_analysis')
      .insert({
        analysis_date: dateStr,
        market_sentiment: aiAnalysis.market_sentiment,
        key_themes: aiAnalysis.key_themes || [],
        overall_summary: aiAnalysis.overall_summary,
        ai_analysis: aiAnalysis,
        confidence_score: aiAnalysis.confidence_score || 0.7,
        sources_analyzed: content.length,
        created_at: new Date().toISOString()
      });

    if (insertError) throw insertError;

    adminLogger.info(`✅ Successfully generated analysis for ${dateStr}`);
    
    // Generate predictions for this analysis
    await this.generatePredictionsForDate(dateStr, aiAnalysis);
  }

  private async generatePredictionsForDate(dateStr: string, analysis: any) {
    adminLogger.info(`Generating predictions for ${dateStr}...`);
    
    // Get the daily analysis ID
    const client = db;
    const { data: dailyAnalysis } = await client
      .from('daily_analysis')
      .select('id')
      .eq('analysis_date', dateStr)
      .single();

    if (!dailyAnalysis) {
      throw new Error(`No daily analysis found for ${dateStr}`);
    }

    const prompt = `Based on the market analysis provided, generate specific predictions for different time horizons.

Market Analysis:
${JSON.stringify(analysis, null, 2)}

Generate predictions for:
1. 1-week outlook
2. 1-month outlook
3. 3-month outlook
4. 6-month outlook
5. 1-year outlook

For each prediction, include:
- Specific prediction statement
- Confidence level (0-1)
- Key assumptions
- Measurable outcomes

Format as JSON object with "predictions" array containing prediction objects with this structure:
{
  "predictions": [
    {
      "prediction_type": "market_direction|economic_indicator|geopolitical_event",
      "prediction_text": "specific prediction",
      "confidence_level": 0.75,
      "time_horizon": "1_week|1_month|3_months|6_months|1_year",
      "prediction_data": {
        "assumptions": ["assumption1", "assumption2"],
        "measurable_outcomes": ["outcome1", "outcome2"],
        "key_risks": ["risk1", "risk2"]
      }
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: process.env.PREDICTION_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial market analyst making specific, measurable predictions. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' }
    });

    const predictionsResponse = JSON.parse(completion.choices[0].message.content || '{"predictions": []}');
    const predictions = predictionsResponse.predictions || [];

    // Insert predictions
    for (const prediction of predictions) {
      await client
        .from('predictions')
        .insert({
          daily_analysis_id: dailyAnalysis.id,
          prediction_type: prediction.prediction_type,
          prediction_text: prediction.prediction_text,
          confidence_level: prediction.confidence_level,
          time_horizon: prediction.time_horizon,
          prediction_data: prediction.prediction_data,
          created_at: new Date().toISOString()
        });
    }

    adminLogger.info(`✅ Generated ${predictions.length} predictions for ${dateStr}`);
  }
}

export const adminController = new AdminController();