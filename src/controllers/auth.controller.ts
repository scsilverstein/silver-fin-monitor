// Authentication controller following CLAUDE.md specification
import { Request, Response } from 'express';
import { generateToken } from '@/middleware/auth';
import { 
  AuthResponse, 
  TokenRefreshResponse,
  CreateUserData, 
  LoginData, 
  UpdateUserData
} from '@/types/auth';
import { authService } from '@/services/auth/supabase-auth';
import { asyncHandler } from '@/middleware/error';
import { createContextLogger } from '@/utils/logger';
import { validateEmail, validatePassword } from '@/utils/validation';

const authLogger = createContextLogger('AuthController');

export class AuthController {
  // Register new user
  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password, fullName, role }: CreateUserData = req.body;
    
    authLogger.info('Registration attempt', { email, fullName });

    // Validate input
    if (!email || !validateEmail(email)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Valid email address is required'
        }
      } as AuthResponse);
      return;
    }

    if (password && !validatePassword(password)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password must be at least 8 characters with numbers and special characters'
        }
      } as AuthResponse);
      return;
    }

    try {
      const result = await authService.register({
        email: email.toLowerCase(),
        password,
        fullName,
        role: role || 'user'
      });

      const token = generateToken(result.user);

      authLogger.info('Registration successful', { 
        userId: result.user.id, 
        email: result.user.email 
      });

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          token,
          accessToken: token,
          refreshToken: token
        },
        temporaryPassword: result.temporaryPassword,
        message: result.temporaryPassword 
          ? 'Account created with temporary password. Please check your email.'
          : 'Account created successfully'
      });
    } catch (error) {
      authLogger.error('Registration failed', error);
      res.status(400).json({
        success: false,
        message: error.message
      } as AuthResponse);
    }
  });

  // Login endpoint with enhanced authentication
  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password }: LoginData = req.body;
    
    authLogger.info('Login attempt', { email, body: req.body });

    // Keep demo credentials for development
    if (email === 'demo@silverfin.com' && password === 'demo123') {
      const demoUser = {
        id: 'demo-user-id',
        email: 'demo@silverfin.com',
        fullName: 'Demo User',
        role: 'admin' as const,
        subscriptionTier: 'enterprise' as const,
        subscriptionStatus: 'active' as const,
        preferences: {},
        usageLimits: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true
      };

      const token = generateToken(demoUser);

      res.json({
        success: true,
        data: {
          user: demoUser,
          token,
          accessToken: token,
          refreshToken: token
        },
        message: 'Demo login successful'
      });
      return;
    }

    // Quick access for testing - accept any email with password 'test123'
    if (password === 'test123') {
      const testUser = {
        id: 'test-user-id',
        email: email,
        fullName: 'Test Admin User',
        role: 'admin' as const,
        subscriptionTier: 'enterprise' as const,
        subscriptionStatus: 'active' as const,
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

      const token = generateToken(testUser);
      
      res.json({
        success: true,
        data: {
          user: testUser,
          token,
          accessToken: token,
          refreshToken: token
        },
        message: 'Test login successful'
      });
      return;
    }

    // Admin credentials for immediate access
    if (email === 'admin@silverfin.com' && password === 'admin123!') {
      const adminUser = {
        id: 'admin-user-id',
        email: 'admin@silverfin.com',
        fullName: 'Admin User',
        role: 'admin' as const,
        subscriptionTier: 'enterprise' as const,
        subscriptionStatus: 'active' as const,
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

      const token = generateToken(adminUser);

      res.json({
        success: true,
        data: {
          user: adminUser,
          token,
          accessToken: token,
          refreshToken: token
        },
        message: 'Admin login successful'
      });
      return;
    }

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email and password are required'
        }
      } as AuthResponse);
      return;
    }

    try {
      const result = await authService.login({
        email: email.toLowerCase(),
        password
      });

      authLogger.info('Login successful', { 
        userId: result.user.id, 
        email: result.user.email,
        tier: result.user.subscriptionTier
      });

      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
          accessToken: result.token,
          refreshToken: result.refreshToken
        },
        message: 'Login successful'
      });
    } catch (error) {
      authLogger.warn('Login failed', { email, error: error.message });
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      } as AuthResponse);
    }
  });

  // Refresh token endpoint
  refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      } as TokenRefreshResponse);
      return;
    }

    try {
      const result = await authService.refreshToken(refreshToken);

      authLogger.info('Token refreshed successfully');

      res.json({
        success: true,
        token: result.token,
        refreshToken: result.refreshToken
      } as TokenRefreshResponse);
    } catch (error) {
      authLogger.warn('Token refresh failed', error);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      } as TokenRefreshResponse);
    }
  });

  // Get current user info with subscription details
  getCurrentUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated'
        }
      } as AuthResponse);
      return;
    }

    // For demo/admin users, return static data
    if (req.user.id === 'demo-user-id' || req.user.id === 'admin-user-id') {
      res.json({
        success: true,
        data: {
          user: req.user
        }
      });
      return;
    }

    // Get fresh user data from database for real users
    const user = await authService.getUserById(req.user.id);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      } as AuthResponse);
      return;
    }

    res.json({
      success: true,
      user
    } as AuthResponse);
  });

  // Update user profile
  updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated'
        }
      } as AuthResponse);
      return;
    }

    if (req.user.id === 'demo-user-id' || req.user.id === 'admin-user-id') {
      res.status(400).json({
        success: false,
        error: {
          code: 'DEMO_ACCOUNT',
          message: 'Cannot modify demo/admin account'
        }
      } as AuthResponse);
      return;
    }

    const updates: UpdateUserData = req.body;

    try {
      const user = await authService.updateUserProfile(req.user.id, updates);

      authLogger.info('Profile updated', { userId: user.id });

      res.json({
        success: true,
        user,
        message: 'Profile updated successfully'
      } as AuthResponse);
    } catch (error) {
      authLogger.error('Profile update failed', error);
      res.status(400).json({
        success: false,
        message: error.message
      } as AuthResponse);
    }
  });

  // Change password
  changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_USER',
          message: 'User not authenticated'
        }
      } as AuthResponse);
      return;
    }

    if (req.user.id === 'demo-user-id' || req.user.id === 'admin-user-id') {
      res.status(400).json({
        success: false,
        error: {
          code: 'DEMO_ACCOUNT',
          message: 'Cannot change demo/admin account password'
        }
      } as AuthResponse);
      return;
    }

    const { newPassword }: { newPassword: string } = req.body;

    if (!validatePassword(newPassword)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password must be at least 8 characters with numbers and special characters'
        }
      } as AuthResponse);
      return;
    }

    try {
      await authService.changePassword(req.user.id, newPassword);

      authLogger.info('Password changed', { userId: req.user.id });

      res.json({
        success: true,
        message: 'Password changed successfully'
      } as AuthResponse);
    } catch (error) {
      authLogger.error('Password change failed', error);
      res.status(400).json({
        success: false,
        message: error.message
      } as AuthResponse);
    }
  });

  // Request password reset
  requestPasswordReset = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Valid email address is required'
        }
      } as AuthResponse);
      return;
    }

    try {
      await authService.requestPasswordReset(email.toLowerCase());

      authLogger.info('Password reset requested', { email });

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account with this email exists, password reset instructions have been sent'
      } as AuthResponse);
    } catch (error) {
      authLogger.error('Password reset request failed', error);
      // Still return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account with this email exists, password reset instructions have been sent'
      } as AuthResponse);
    }
  });

  // Logout (client-side token invalidation)
  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    authLogger.info('User logged out', { userId: req.user?.id });

    res.json({
      success: true,
      message: 'Logged out successfully'
    } as AuthResponse);
  });
}

export const authController = new AuthController();