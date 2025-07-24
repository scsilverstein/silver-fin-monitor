// JWT authentication middleware following CLAUDE.md specification
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '@/types';
import { User, UsageType, AuthenticationError, AuthorizationError, UsageLimitError } from '@/types/auth';
import config from '@/config';
import { authService } from '@/services/auth/supabase-auth';
import { createContextLogger } from '@/utils/logger';

const authLogger = createContextLogger('Auth');

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// JWT verification middleware with Supabase integration
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      authLogger.debug('No token provided', { 
        path: req.path,
        method: req.method 
      });
      res.status(401).json({ 
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Access token required'
        }
      });
      return;
    }

    // Verify JWT token
    const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
    // Handle hardcoded demo/admin users
    if (payload.sub === 'demo-user-id' || payload.sub === 'admin-user-id' || payload.sub === 'test-user-id' || 
        payload.sub === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') {
      const user: User = {
        id: payload.sub,
        email: payload.email,
        fullName: payload.sub === 'demo-user-id' ? 'Demo User' : 
                  payload.sub === 'admin-user-id' ? 'Admin User' : 'Test Admin User',
        role: payload.role as 'admin' | 'user',
        subscriptionTier: 'enterprise',
        subscriptionStatus: 'active',
        preferences: {},
        usageLimits: {
          feeds: -1,
          apiCalls: -1,
          analysis: -1,
          predictions: -1,
          dataRetention: 365
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true
      };
      
      req.user = user;
      authLogger.debug('Hardcoded user authenticated', { 
        userId: user.id,
        role: user.role,
        tier: user.subscriptionTier
      });
      
      next();
      return;
    }
    
    // Get full user details from database
    const user = await authService.getUserById(payload.sub);
    
    if (!user) {
      authLogger.warn('User not found for valid token', { 
        userId: payload.sub,
        path: req.path 
      });
      res.status(401).json({ 
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found'
        }
      });
      return;
    }

    // Check if subscription is active (for paid features)
    if (user.subscriptionStatus === 'past_due' || user.subscriptionStatus === 'cancelled') {
      // Allow access to basic features only
      user.subscriptionTier = 'free';
    }

    req.user = user;

    authLogger.debug('User authenticated', { 
      userId: user.id,
      role: user.role,
      tier: user.subscriptionTier
    });
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      authLogger.warn('Invalid token', { 
        error: error.message,
        path: req.path 
      });
      res.status(403).json({ 
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
      return;
    }

    authLogger.error('Authentication error', error);
    res.status(500).json({ 
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

// Role-based access control middleware
export const requireRole = (role: 'admin' | 'user') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated'
        }
      });
      return;
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      authLogger.warn('Insufficient permissions', { 
        userId: req.user.id,
        requiredRole: role,
        userRole: req.user.role,
        path: req.path 
      });
      
      res.status(403).json({ 
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Role '${role}' required`
        }
      });
      return;
    }

    next();
  };
};

// Optional authentication middleware (legacy version for JWT only)
export const optionalAuthJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, continue without user
    next();
    return;
  }

  // If token is provided, verify it
  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (!err && decoded) {
      const payload = decoded as JWTPayload;
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        createdAt: new Date()
      } as User;
    }
    // Continue regardless of token validity
    next();
  });
};

// Generate JWT token
export const generateToken = (user: User): string => {
  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  };

  return jwt.sign(payload, config.jwt.secret);
};

// Verify and decode token (for password reset, etc.)
export const verifyToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    return decoded;
  } catch (error) {
    authLogger.debug('Token verification failed', error);
    return null;
  }
};

// API key authentication middleware (for external services)
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ 
        success: false,
        error: {
          code: 'NO_API_KEY',
          message: 'API key required'
        }
      });
      return;
    }

    // Validate API key against database
    const user = await authService.getUserByApiKey(apiKey);
    
    if (!user) {
      authLogger.warn('Invalid API key', { 
        path: req.path,
        method: req.method,
        keyPreview: apiKey.substring(0, 8) + '...'
      });
      
      res.status(403).json({ 
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        }
      });
      return;
    }

    // Check if subscription allows API access
    if (user.subscriptionTier === 'free') {
      res.status(403).json({ 
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'API access requires Professional or Enterprise subscription'
        }
      });
      return;
    }

    req.user = user;

    authLogger.debug('API key authenticated', { 
      userId: user.id,
      tier: user.subscriptionTier
    });

    next();
  } catch (error) {
    authLogger.error('API key authentication error', error);
    res.status(500).json({ 
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

// Subscription tier requirement middleware
export const requireSubscription = (minTier: 'professional' | 'enterprise') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated'
        }
      });
      return;
    }

    const tierHierarchy = {
      free: 0,
      professional: 1,
      enterprise: 2
    };

    const userTierLevel = tierHierarchy[req.user.subscriptionTier];
    const requiredTierLevel = tierHierarchy[minTier];

    if (userTierLevel < requiredTierLevel) {
      authLogger.warn('Insufficient subscription tier', { 
        userId: req.user.id,
        userTier: req.user.subscriptionTier,
        requiredTier: minTier,
        path: req.path 
      });
      
      res.status(403).json({ 
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: `${minTier.charAt(0).toUpperCase() + minTier.slice(1)} subscription required`,
          userTier: req.user.subscriptionTier,
          requiredTier: minTier
        }
      });
      return;
    }

    next();
  };
};

// Usage limit checking middleware
export const checkUsageLimit = (usageType: UsageType, count: number = 1) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ 
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated'
        }
      });
      return;
    }

    try {
      const hasQuota = await authService.checkUserLimit(req.user.id, usageType);

      if (!hasQuota) {
        authLogger.warn('Usage limit exceeded', { 
          userId: req.user.id,
          usageType,
          tier: req.user.subscriptionTier,
          path: req.path 
        });
        
        res.status(429).json({ 
          success: false,
          error: {
            code: 'USAGE_LIMIT_EXCEEDED',
            message: `${usageType.replace('_', ' ')} limit exceeded for ${req.user.subscriptionTier} plan`,
            usageType,
            subscriptionTier: req.user.subscriptionTier
          }
        });
        return;
      }

      // Store usage count for later increment (after successful operation)
      req.user.pendingUsage = { type: usageType, count };

      next();
    } catch (error) {
      authLogger.error('Usage limit check error', error);
      res.status(500).json({ 
        success: false,
        error: {
          code: 'USAGE_CHECK_ERROR',
          message: 'Unable to verify usage limits'
        }
      });
    }
  };
};

// Usage tracking middleware (to be used after successful operations)
export const incrementUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.user?.pendingUsage) {
    try {
      await authService.incrementUsage(
        req.user.id, 
        req.user.pendingUsage.type, 
        req.user.pendingUsage.count
      );
      
      authLogger.debug('Usage incremented', {
        userId: req.user.id,
        usageType: req.user.pendingUsage.type,
        count: req.user.pendingUsage.count
      });
    } catch (error) {
      authLogger.error('Failed to increment usage', error);
      // Don't fail the request, just log the error
    }
    
    delete req.user.pendingUsage;
  }
  
  next();
};

// Enhanced optional authentication with API key support
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'] as string;
  const token = authHeader && authHeader.split(' ')[1];

  try {
    if (apiKey) {
      // Try API key authentication first
      const user = await authService.getUserByApiKey(apiKey);
      if (user) {
        req.user = user;
        authLogger.debug('Optional API key auth successful', { userId: user.id });
      }
    } else if (token) {
      // Try JWT authentication
      const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
      const user = await authService.getUserById(payload.sub);
      if (user) {
        req.user = user;
        authLogger.debug('Optional JWT auth successful', { userId: user.id });
      }
    }
  } catch (error) {
    // Silent fail for optional auth
    authLogger.debug('Optional authentication failed', { error: error.message });
  }

  next();
};