// Authentication routes following CLAUDE.md specification
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config';
import { getDatabase } from '../services/database/db.service';
import { authenticateToken } from '../middleware/auth.middleware';
import winston from 'winston';

const router = Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};

// Register new user
router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').optional().trim().isLength({ min: 2 }),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password, fullName } = req.body;
      const db = getDatabase(logger);

      // Check if user exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'User already exists'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const [newUser] = await db.query(
        `INSERT INTO users (email, password_hash, full_name, role, subscription_tier, subscription_status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, full_name, role, created_at`,
        [email, hashedPassword, fullName || null, 'user', 'free', 'active']
      );

      // Generate JWT
      const token = jwt.sign(
        { 
          sub: newUser.id, 
          email: newUser.email,
          role: newUser.role 
        },
        config.jwt.secret,
        { 
          expiresIn: config.jwt.expiresIn as any
        }
      );

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.full_name,
            role: newUser.role
          },
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const db = getDatabase(logger);

      // Get user
      const [user] = await db.query(
        `SELECT id, email, password_hash, full_name, role, 
                subscription_tier, subscription_status, email_verified
         FROM users 
         WHERE email = $1`,
        [email]
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Update last login
      await db.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      // Generate JWT
      const token = jwt.sign(
        { 
          sub: user.id, 
          email: user.email,
          role: user.role 
        },
        config.jwt.secret,
        { 
          expiresIn: config.jwt.expiresIn as any
        }
      );

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            subscriptionTier: user.subscription_tier,
            subscriptionStatus: user.subscription_status,
            emailVerified: user.email_verified
          },
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
router.get('/me', authenticateToken, async (req: any, res, next) => {
  try {
    const db = getDatabase(logger);
    
    const [user] = await db.query(
      `SELECT id, email, full_name, role, subscription_tier, 
              subscription_status, email_verified, created_at,
              preferences, usage_limits
       FROM users 
       WHERE id = $1`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          subscriptionTier: user.subscription_tier,
          subscriptionStatus: user.subscription_status,
          emailVerified: user.email_verified,
          createdAt: user.created_at,
          preferences: user.preferences || {},
          usageLimits: user.usage_limits || {}
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', 
  body('token').notEmpty(),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { token } = req.body;

      // Verify old token
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      // Generate new token
      const newToken = jwt.sign(
        { 
          sub: decoded.sub, 
          email: decoded.email,
          role: decoded.role 
        },
        config.jwt.secret,
        { 
          expiresIn: config.jwt.expiresIn as any
        }
      );

      res.json({
        success: true,
        data: { token: newToken }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  }
);

// Change password
router.put('/password', 
  authenticateToken,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const db = getDatabase(logger);

      // Get current password hash
      const [user] = await db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, req.user.id]
      );

      res.json({
        success: true,
        data: { message: 'Password updated successfully' }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Request password reset
router.post('/password-reset',
  body('email').isEmail().normalizeEmail(),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const db = getDatabase(logger);

      // Check if user exists
      const [user] = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (!user) {
        // Don't reveal if user exists
        return res.json({
          success: true,
          data: { message: 'If the email exists, a reset link has been sent' }
        });
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { sub: user.id, type: 'password-reset' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // Store reset token
      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')
         ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = NOW() + INTERVAL '1 hour'`,
        [user.id, resetToken]
      );

      // TODO: Send email with reset link
      logger.info('Password reset requested', { userId: user.id, email });

      res.json({
        success: true,
        data: { message: 'If the email exists, a reset link has been sent' }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Reset password with token
router.post('/password-reset/confirm',
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      const db = getDatabase(logger);

      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      if (decoded.type !== 'password-reset') {
        return res.status(400).json({
          success: false,
          error: 'Invalid reset token'
        });
      }

      // Check if token exists and not expired
      const [resetToken] = await db.query(
        `SELECT user_id FROM password_reset_tokens 
         WHERE user_id = $1 AND token = $2 AND expires_at > NOW()`,
        [decoded.sub, token]
      );

      if (!resetToken) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, decoded.sub]
      );

      // Delete reset token
      await db.query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [decoded.sub]
      );

      res.json({
        success: true,
        data: { message: 'Password reset successfully' }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout (optional - mainly for token blacklisting if implemented)
router.post('/logout', authenticateToken, async (req: any, res) => {
  // In a production system, you might want to blacklist the token
  // For now, just return success
  res.json({
    success: true,
    data: { message: 'Logged out successfully' }
  });
});

export default router;