// Error handling middleware following CLAUDE.md specification
import { Request, Response, NextFunction } from 'express';

// Import auth middleware to ensure user type extension is available
import '@/middleware/auth';
import { ApiError } from '@/types';
import { createContextLogger } from '@/utils/logger';
import { config } from '@/config';

const errorLogger = createContextLogger('ErrorHandler');

// Type for async route handlers
export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

// Custom error classes
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(401, 'AUTHENTICATION_ERROR', message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, 'AUTHORIZATION_ERROR', message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(502, 'EXTERNAL_SERVICE_ERROR', `${service}: ${message}`);
    this.name = 'ExternalServiceError';
  }
}

// Global error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Enhanced error logging with full request details
  errorLogger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    headers: {
      'content-type': req.get('content-type'),
      'authorization': req.get('authorization') ? 'Bearer [REDACTED]' : 'none',
      'origin': req.get('origin'),
      'user-agent': req.get('user-agent')
    },
    user: req.user?.id,
    errorName: err.name,
    errorType: err.constructor.name,
    timestamp: new Date().toISOString()
  });

  // Default error values
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details = undefined;

  // Handle known error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    // Joi validation errors
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request data';
  } else if (err.name === 'UnauthorizedError') {
    // JWT errors
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Invalid or expired token';
  } else if (err.name === 'CastError') {
    // MongoDB/Database cast errors
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  }

  // Build error response
  const errorResponse: ApiError = {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString(),
    path: req.path
  };

  // Don't expose internal error details in production
  if (config.nodeEnv === 'production' && statusCode === 500) {
    errorResponse.error.message = 'Internal server error';
    delete errorResponse.error.details;
  } else if (statusCode === 500) {
    // In development, show more details
    errorResponse.error.details = {
      stack: err.stack,
      message: err.message
    };
  }

  res.status(statusCode).json(errorResponse);
};

// Not found handler (404)
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError('Endpoint');
  next(error);
};

// Async error wrapper to catch errors in async route handlers
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request timeout middleware
export const requestTimeout = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      const error = new AppError(
        408,
        'REQUEST_TIMEOUT',
        'Request timeout'
      );
      next(error);
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// Validate content type middleware
export const validateContentType = (contentType: string = 'application/json') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      const requestContentType = req.get('Content-Type');
      
      if (!requestContentType || !requestContentType.includes(contentType)) {
        const error = new ValidationError(
          `Content-Type must be ${contentType}`,
          { received: requestContentType }
        );
        next(error);
        return;
      }
    }
    
    next();
  };
};

// Request logging middleware for debugging
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  // Log incoming request
  errorLogger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: {
      'content-type': req.get('content-type'),
      'authorization': req.get('authorization') ? 'Bearer [REDACTED]' : 'none',
      'origin': req.get('origin')
    },
    ip: req.ip
  });
  
  // Log response when finished
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    errorLogger.info('Response sent', {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      path: req.path,
      responseSize: data ? data.length : 0
    });
    return originalSend.call(this, data);
  };
  
  next();
};

