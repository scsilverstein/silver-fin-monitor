// Subscription management controller following CLAUDE.md specification
import { Request, Response } from 'express';
import { authService } from '@/services/auth/supabase-auth';
import { asyncHandler } from '@/middleware/error';
import { createContextLogger } from '@/utils/logger';

const subscriptionLogger = createContextLogger('SubscriptionController');

export class SubscriptionController {
  // Get current user's subscription details
  getSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
      const subscription = await authService.getUserSubscription(req.user.id);
      
      res.json({
        success: true,
        data: {
          tier: req.user.subscriptionTier,
          status: req.user.subscriptionStatus,
          limits: req.user.usageLimits,
          subscription
        }
      });
    } catch (error) {
      subscriptionLogger.error('Failed to get subscription', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_ERROR',
          message: 'Unable to retrieve subscription details'
        }
      });
    }
  });

  // Get usage statistics for current user
  getUsage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
      const usage = await authService.getUserUsage(req.user.id);
      
      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      subscriptionLogger.error('Failed to get usage', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'USAGE_ERROR',
          message: 'Unable to retrieve usage statistics'
        }
      });
    }
  });

  // Get available subscription plans
  getPlans = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        interval: null,
        features: [
          'Access to daily market analysis',
          'Basic predictions (1 week, 1 month)',
          'Limited content search',
          '5 API requests per day'
        ],
        limits: {
          daily_analysis: 1,
          prediction_generation: 5,
          content_searches: 10,
          api_requests: 5
        },
        isPopular: false
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 29,
        interval: 'month',
        features: [
          'Everything in Free',
          'Advanced predictions (all time horizons)',
          'Entity analytics dashboard',
          'Unlimited content search',
          'Priority processing',
          '1,000 API requests per day',
          'Email support'
        ],
        limits: {
          daily_analysis: 10,
          prediction_generation: 50,
          content_searches: -1, // unlimited
          api_requests: 1000
        },
        isPopular: true
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 99,
        interval: 'month',
        features: [
          'Everything in Professional',
          'Custom feed sources',
          'Advanced analytics',
          'Bulk data export',
          'Webhook integrations',
          'Unlimited API requests',
          'Priority support',
          'Custom integrations'
        ],
        limits: {
          daily_analysis: -1, // unlimited
          prediction_generation: -1, // unlimited
          content_searches: -1, // unlimited
          api_requests: -1 // unlimited
        },
        isPopular: false
      }
    ];

    res.json({
      success: true,
      data: plans
    });
  });

  // Create Stripe checkout session (placeholder - requires Stripe integration)
  createCheckoutSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const { planId } = req.body;

    if (!planId || !['professional', 'enterprise'].includes(planId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLAN',
          message: 'Valid plan ID required (professional or enterprise)'
        }
      });
      return;
    }

    // TODO: Implement Stripe checkout session creation
    // For now, return a placeholder response
    subscriptionLogger.info('Checkout session requested', { 
      userId: req.user.id, 
      planId 
    });

    res.json({
      success: true,
      data: {
        message: 'Stripe integration not yet implemented',
        planId,
        userId: req.user.id,
        checkoutUrl: `https://checkout.stripe.com/placeholder?plan=${planId}&user=${req.user.id}`
      }
    });
  });

  // Handle Stripe webhook (placeholder)
  handleWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // TODO: Implement Stripe webhook handling
    subscriptionLogger.info('Webhook received', { body: req.body });

    res.json({
      success: true,
      message: 'Webhook received'
    });
  });

  // Cancel subscription (placeholder)
  cancelSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    // TODO: Implement subscription cancellation
    subscriptionLogger.info('Subscription cancellation requested', { 
      userId: req.user.id 
    });

    res.json({
      success: true,
      data: {
        message: 'Subscription cancellation not yet implemented',
        userId: req.user.id
      }
    });
  });

  // Generate API key for user
  generateApiKey = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    // Check if user has subscription that allows API access
    if (req.user.subscriptionTier === 'free') {
      res.status(403).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'API keys require Professional or Enterprise subscription'
        }
      });
      return;
    }

    try {
      const apiKey = await authService.generateApiKey(req.user.id);
      
      subscriptionLogger.info('API key generated', { userId: req.user.id });

      res.json({
        success: true,
        data: {
          apiKey,
          message: 'API key generated successfully. Store this securely - it will not be shown again.'
        }
      });
    } catch (error) {
      subscriptionLogger.error('Failed to generate API key', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'API_KEY_ERROR',
          message: 'Unable to generate API key'
        }
      });
    }
  });

  // List user's API keys
  listApiKeys = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
      const apiKeys = await authService.getUserApiKeys(req.user.id);
      
      res.json({
        success: true,
        data: apiKeys
      });
    } catch (error) {
      subscriptionLogger.error('Failed to list API keys', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'API_KEY_ERROR',
          message: 'Unable to retrieve API keys'
        }
      });
    }
  });

  // Revoke API key
  revokeApiKey = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    const { keyId } = req.params;

    try {
      await authService.revokeApiKey(req.user.id, keyId);
      
      subscriptionLogger.info('API key revoked', { userId: req.user.id, keyId });

      res.json({
        success: true,
        data: {
          message: 'API key revoked successfully'
        }
      });
    } catch (error) {
      subscriptionLogger.error('Failed to revoke API key', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'API_KEY_ERROR',
          message: 'Unable to revoke API key'
        }
      });
    }
  });
}

export const subscriptionController = new SubscriptionController();