// Auth middleware exports following CLAUDE.md specification
import { authenticateToken } from './auth';
import { Request, Response, NextFunction } from 'express';

// Export authenticateToken as requireAuth for backward compatibility
export const requireAuth = authenticateToken;

// Role-based access control middleware
export const requireRole = (role: string) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Re-export authenticateToken for consistency
export { authenticateToken };