// Input validation middleware following CLAUDE.md specification
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Joi from 'joi';
import { createContextLogger } from '@/utils/logger';

const validationLogger = createContextLogger('Validation');

// Generic validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      validationLogger.info('Validation middleware triggered', {
        path: req.path,
        method: req.method,
        body: req.body,
        headers: {
          'content-type': req.get('content-type'),
          'authorization': req.get('authorization') ? 'Bearer [REDACTED]' : 'none'
        }
      });

      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        validationLogger.error('Validation failed', { 
          path: req.path,
          body: req.body,
          errors,
          validationError: error.message
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: errors
          }
        });
        return;
      }

      validationLogger.info('Validation passed', {
        path: req.path,
        originalBody: req.body,
        validatedBody: value
      });

      // Replace req.body with validated and sanitized data
      req.body = value;
      next();
    } catch (err) {
      validationLogger.error('Validation middleware error', {
        path: req.path,
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation processing failed'
        }
      });
    }
  };
};

// Validation schemas for different endpoints
export const schemas = {
  // Feed source schemas
  createFeedSource: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    type: Joi.string().valid('rss', 'podcast', 'youtube', 'api', 'multi_source', 'reddit').required(),
    url: Joi.string().uri().required(),
    config: Joi.object({
      categories: Joi.array().items(Joi.string()).min(1).default(['general']),
      priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
      updateFrequency: Joi.string().default('daily'),
      transcriptSource: Joi.string().optional(),
      extractGuests: Joi.boolean().optional(),
      processTranscript: Joi.boolean().optional(),
      customHeaders: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
      rateLimit: Joi.object({
        requests: Joi.number().positive().required(),
        period: Joi.string().required()
      }).optional(),
      sources: Joi.array().items(Joi.object({
        url: Joi.string().uri().required(),
        type: Joi.string().required()
      })).optional(),
      extractVideoTranscript: Joi.boolean().optional(),
      // Reddit-specific config
      subreddit: Joi.string().optional(),
      sort: Joi.string().valid('hot', 'new', 'top', 'rising').optional(),
      time: Joi.string().valid('hour', 'day', 'week', 'month', 'year', 'all').optional(),
      minScore: Joi.number().min(0).optional(),
      minComments: Joi.number().min(0).optional(),
      minUpvoteRatio: Joi.number().min(0).max(1).optional(),
      excludeNSFW: Joi.boolean().optional(),
      flairFilter: Joi.array().items(Joi.string()).optional(),
      authorFilter: Joi.array().items(Joi.string()).optional(),
      includeComments: Joi.boolean().optional()
    }).default({
      categories: ['general'],
      priority: 'medium',
      updateFrequency: 'daily'
    })
  }),

  updateFeedSource: Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    url: Joi.string().uri().optional(),
    isActive: Joi.boolean().optional(),
    config: Joi.object({
      categories: Joi.array().items(Joi.string()).min(1).optional(),
      priority: Joi.string().valid('low', 'medium', 'high').optional(),
      updateFrequency: Joi.string().optional(),
      transcriptSource: Joi.string().optional(),
      extractGuests: Joi.boolean().optional(),
      processTranscript: Joi.boolean().optional(),
      customHeaders: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
      rateLimit: Joi.object({
        requests: Joi.number().positive().required(),
        period: Joi.string().required()
      }).optional(),
      extractVideoTranscript: Joi.boolean().optional(),
      // Reddit-specific config
      subreddit: Joi.string().optional(),
      sort: Joi.string().valid('hot', 'new', 'top', 'rising').optional(),
      time: Joi.string().valid('hour', 'day', 'week', 'month', 'year', 'all').optional(),
      minScore: Joi.number().min(0).optional(),
      minComments: Joi.number().min(0).optional(),
      minUpvoteRatio: Joi.number().min(0).max(1).optional(),
      excludeNSFW: Joi.boolean().optional(),
      flairFilter: Joi.array().items(Joi.string()).optional(),
      authorFilter: Joi.array().items(Joi.string()).optional(),
      includeComments: Joi.boolean().optional()
    }).optional()
  }),

  // User authentication schemas
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('user', 'admin').default('user')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Analysis schemas
  triggerAnalysis: Joi.object({
    date: Joi.date().iso().optional(),
    forceRegenerate: Joi.boolean().default(false)
  }),

  // Prediction schemas
  createPrediction: Joi.object({
    dailyAnalysisId: Joi.string().uuid().optional(),
    predictionType: Joi.string().optional(),
    predictionText: Joi.string().required(),
    confidenceLevel: Joi.number().min(0).max(1).required(),
    timeHorizon: Joi.string().valid('1_week', '1_month', '3_months', '6_months', '1_year').required(),
    predictionData: Joi.object().default({})
  }),

  // Queue job schemas
  enqueueJob: Joi.object({
    jobType: Joi.string().required(),
    payload: Joi.object().default({}),
    priority: Joi.number().min(1).max(10).default(5),
    delaySeconds: Joi.number().min(0).default(0)
  })
};

// Query parameter validation middleware
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      validationLogger.info('Validating query parameters', { 
        path: req.path,
        originalQuery: req.query 
      });

      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        validationLogger.error('Query validation failed', { 
          path: req.path,
          originalQuery: req.query,
          errors 
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: errors
          }
        });
        return;
      }

      validationLogger.info('Query validation successful', { 
        path: req.path,
        validatedQuery: value 
      });

      // In newer Express versions, req.query is read-only
      // So we need to attach the validated values differently
      (req as any).validatedQuery = value;
      
      // For backwards compatibility, try to set req.query if possible
      try {
        req.query = value as any;
      } catch (e) {
        // If it fails, we'll use validatedQuery in the controller
      }
      
      next();
    } catch (validationError) {
      validationLogger.error('Validation middleware error', { 
        path: req.path,
        error: validationError instanceof Error ? validationError.message : validationError,
        stack: validationError instanceof Error ? validationError.stack : undefined,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_MIDDLEWARE_ERROR',
          message: 'Validation middleware failed',
          details: validationError instanceof Error ? validationError.message : 'Unknown error'
        }
      });
    }
  };
};

// Common query schemas
export const querySchemas = {
  pagination: Joi.object({
    limit: Joi.number().min(1).max(100).default(20),
    offset: Joi.number().min(0).default(0),
    orderBy: Joi.string().optional(),
    orderDirection: Joi.string().valid('asc', 'desc').default('desc')
  }),

  feedFilter: Joi.object({
    type: Joi.string().optional(),
    category: Joi.string().optional(),
    isActive: Joi.string().optional(),
    limit: Joi.string().optional(),
    offset: Joi.string().optional()
  }),

  contentFilter: Joi.object({
    sourceId: Joi.string().uuid().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    sentiment: Joi.string().valid('positive', 'negative', 'neutral').optional(),
    limit: Joi.number().min(1).max(100).default(20),
    offset: Joi.number().min(0).default(0)
  }),

  dateRange: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required()
  }),

  analysisFilter: Joi.object({
    startDate: Joi.alternatives().try(
      Joi.date().iso(),
      Joi.string().isoDate()
    ).optional(),
    endDate: Joi.alternatives().try(
      Joi.date().iso(),
      Joi.string().isoDate()
    ).optional(),
    limit: Joi.alternatives().try(
      Joi.number().min(1).max(50000),
      Joi.string().regex(/^\d+$/).custom((value) => {
        const num = parseInt(value, 10);
        if (num < 1 || num > 50000) throw new Error('limit must be between 1 and 50000');
        return num;
      })
    ).default(30),
    offset: Joi.alternatives().try(
      Joi.number().min(0),
      Joi.string().regex(/^\d+$/).custom((value) => {
        const num = parseInt(value, 10);
        if (num < 0) throw new Error('offset must be non-negative');
        return num;
      })
    ).default(0)
  })
};

// Validate UUID parameter
export const validateUUID = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const uuid = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuid || !uuidRegex.test(uuid)) {
      validationLogger.debug('Invalid UUID', { 
        path: req.path,
        paramName,
        value: uuid 
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_UUID',
          message: `Invalid ${paramName} format`
        }
      });
      return;
    }

    next();
  };
};

// Sanitize input to prevent XSS
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
};

// Express validator middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};