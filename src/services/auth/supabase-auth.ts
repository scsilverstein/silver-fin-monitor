// Supabase Authentication Service for Silver Fin Monitor
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import config from '@/config';
import { User, CreateUserData, LoginData } from '@/types/auth';
import { logger } from '@/utils/logger';
import bcrypt from 'bcrypt';

export class SupabaseAuthService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      config.database.url,
      config.database.serviceKey, // Use service key for admin operations
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        }
      }
    );
  }

  // Register new user
  async register(data: CreateUserData): Promise<{ user: User; temporaryPassword?: string }> {
    try {
      logger.info('Starting user registration', { email: data.email });

      // Check if user already exists
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('id, email')
        .eq('email', data.email.toLowerCase())
        .single();

      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Generate temporary password if not provided
      const password = data.password || this.generateTemporaryPassword();
      
      // Create auth user in Supabase Auth
      const { data: authUser, error: authError } = await this.supabase.auth.admin
        .createUser({
          email: data.email.toLowerCase(),
          password: password,
          email_confirm: false, // We'll handle email verification
          user_metadata: {
            full_name: data.fullName,
            role: data.role || 'user'
          }
        });

      if (authError) {
        logger.error('Supabase Auth user creation failed', authError);
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      if (!authUser.user) {
        throw new Error('No user returned from Supabase Auth');
      }

      // Generate API key for the user
      const apiKey = await this.generateUserApiKey(authUser.user.id);

      // Create user record in our users table
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: data.email.toLowerCase(),
          full_name: data.fullName,
          role: data.role || 'user',
          subscription_tier: 'free',
          api_key: apiKey,
          email_verified: false,
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          preferences: data.preferences || {},
          usage_limits: this.getDefaultUsageLimits('free')
        })
        .select()
        .single();

      if (userError) {
        logger.error('User record creation failed', userError);
        // Clean up auth user if database insert fails
        await this.supabase.auth.admin.deleteUser(authUser.user.id);
        throw new Error(`Failed to create user record: ${userError.message}`);
      }

      // Send welcome email with temporary password if generated
      if (!data.password) {
        await this.sendWelcomeEmail(user.email, user.full_name, password);
      }

      logger.info('User registered successfully', { userId: user.id, email: user.email });

      return {
        user: this.mapSupabaseUserToUser(user),
        temporaryPassword: data.password ? undefined : password
      };
    } catch (error) {
      logger.error('User registration failed', error);
      throw error;
    }
  }

  // Login user
  async login(data: LoginData): Promise<{ user: User; token: string; refreshToken: string }> {
    try {
      logger.info('User login attempt', { email: data.email });

      // Authenticate with Supabase Auth
      const { data: authData, error: authError } = await this.supabase.auth
        .signInWithPassword({
          email: data.email.toLowerCase(),
          password: data.password
        });

      if (authError) {
        logger.error('Authentication failed', authError);
        throw new Error('Invalid email or password');
      }

      if (!authData.user || !authData.session) {
        throw new Error('No user or session returned');
      }

      // Get user details from our users table
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select(`
          *,
          user_subscriptions (
            id,
            plan_id,
            status,
            current_period_end,
            subscription_plans (
              name,
              slug,
              limits,
              features
            )
          )
        `)
        .eq('id', authData.user.id)
        .single();

      if (userError || !user) {
        logger.error('User lookup failed', userError);
        throw new Error('User not found');
      }

      // Update last login
      await this.supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return {
        user: this.mapSupabaseUserToUser(user),
        token: authData.session.access_token,
        refreshToken: authData.session.refresh_token
      };
    } catch (error) {
      logger.error('Login failed', error);
      throw error;
    }
  }

  // Refresh token
  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const { data, error } = await this.supabase.auth
        .refreshSession({ refresh_token: refreshToken });

      if (error || !data.session) {
        throw new Error('Token refresh failed');
      }

      return {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token
      };
    } catch (error) {
      logger.error('Token refresh failed', error);
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select(`
          *,
          user_subscriptions (
            id,
            plan_id,
            status,
            current_period_end,
            subscription_plans (
              name,
              slug,
              limits,
              features
            )
          )
        `)
        .eq('id', userId)
        .single();

      if (error || !user) {
        return null;
      }

      return this.mapSupabaseUserToUser(user);
    } catch (error) {
      logger.error('Get user by ID failed', error);
      return null;
    }
  }

  // Get user by API key
  async getUserByApiKey(apiKey: string): Promise<User | null> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select(`
          *,
          user_subscriptions (
            id,
            plan_id,
            status,
            current_period_end,
            subscription_plans (
              name,
              slug,
              limits,
              features
            )
          )
        `)
        .eq('api_key', apiKey)
        .single();

      if (error || !user) {
        return null;
      }

      return this.mapSupabaseUserToUser(user);
    } catch (error) {
      logger.error('Get user by API key failed', error);
      return null;
    }
  }

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .update({
          full_name: updates.fullName,
          preferences: updates.preferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error || !user) {
        throw new Error('Failed to update user profile');
      }

      return this.mapSupabaseUserToUser(user);
    } catch (error) {
      logger.error('Update user profile failed', error);
      throw error;
    }
  }

  // Change password
  async changePassword(userId: string, newPassword: string): Promise<void> {
    try {
      const { error } = await this.supabase.auth.admin
        .updateUserById(userId, {
          password: newPassword
        });

      if (error) {
        throw new Error(`Failed to change password: ${error.message}`);
      }

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Change password failed', error);
      throw error;
    }
  }

  // Reset password
  async requestPasswordReset(email: string): Promise<void> {
    try {
      const { error } = await this.supabase.auth
        .resetPasswordForEmail(email, {
          redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`
        });

      if (error) {
        throw new Error(`Failed to send reset email: ${error.message}`);
      }

      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Password reset failed', error);
      throw error;
    }
  }

  // Verify email
  async verifyEmail(token: string): Promise<void> {
    try {
      const { error } = await this.supabase.auth
        .verifyOtp({ token_hash: token, type: 'email' });

      if (error) {
        throw new Error(`Email verification failed: ${error.message}`);
      }

      logger.info('Email verified successfully');
    } catch (error) {
      logger.error('Email verification failed', error);
      throw error;
    }
  }

  // Delete user
  async deleteUser(userId: string): Promise<void> {
    try {
      // Delete from auth
      const { error: authError } = await this.supabase.auth.admin
        .deleteUser(userId);

      if (authError) {
        throw new Error(`Failed to delete auth user: ${authError.message}`);
      }

      // The user record will be deleted via CASCADE

      logger.info('User deleted successfully', { userId });
    } catch (error) {
      logger.error('Delete user failed', error);
      throw error;
    }
  }

  // Check user limits
  async checkUserLimit(userId: string, limitType: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_user_limit', {
          p_user_id: userId,
          p_limit_type: limitType
        });

      if (error) {
        logger.error('Check user limit failed', error);
        return false;
      }

      return data;
    } catch (error) {
      logger.error('Check user limit error', error);
      return false;
    }
  }

  // Increment user usage
  async incrementUsage(userId: string, usageType: string, count: number = 1, metadata: any = {}): Promise<void> {
    try {
      const { error } = await this.supabase
        .rpc('increment_user_usage', {
          p_user_id: userId,
          p_usage_type: usageType,
          p_count: count,
          p_metadata: metadata
        });

      if (error) {
        logger.error('Increment usage failed', error);
      }
    } catch (error) {
      logger.error('Increment usage error', error);
    }
  }

  // Generate API key for user (public method for subscription controller)
  async generateApiKey(userId: string): Promise<string> {
    const apiKey = `sfm_${this.generateRandomString(32)}`;
    
    // Store the API key in the database
    const { error } = await this.supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        key_hash: apiKey, // In production, this should be hashed
        key_prefix: apiKey.substring(0, 8),
        key_name: 'Generated API Key',
        is_active: true,
        last_used_at: null
      });
    
    if (error) {
      logger.error('Failed to store API key', error);
      throw new Error('Failed to generate API key');
    }
    
    return apiKey;
  }

  // Get user's subscription details
  async getUserSubscription(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            name,
            price,
            interval
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        logger.error('Failed to get user subscription', error);
        throw error;
      }
      
      return data || null;
    } catch (error) {
      logger.error('Get user subscription error', error);
      return null;
    }
  }

  // Get user's usage statistics
  async getUserUsage(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .order('created_at', { ascending: false });
      
      if (error) {
        logger.error('Failed to get user usage', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      logger.error('Get user usage error', error);
      return [];
    }
  }

  // Get user's API keys (without showing the actual key)
  async getUserApiKeys(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('id, key_name, key_prefix, created_at, last_used_at, is_active')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        logger.error('Failed to get user API keys', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      logger.error('Get user API keys error', error);
      return [];
    }
  }

  // Revoke API key
  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('api_keys')
        .update({ 
          is_active: false, 
          revoked_at: new Date().toISOString() 
        })
        .eq('user_id', userId)
        .eq('id', keyId);
      
      if (error) {
        logger.error('Failed to revoke API key', error);
        throw error;
      }
      
      logger.info('API key revoked', { userId, keyId });
    } catch (error) {
      logger.error('Revoke API key error', error);
      throw error;
    }
  }

  // Generate API key for user (private method for internal use)
  private async generateUserApiKey(userId: string): Promise<string> {
    const apiKey = `sfm_${this.generateRandomString(32)}`;
    return apiKey;
  }

  // Generate random string
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Generate temporary password
  private generateTemporaryPassword(): string {
    return this.generateRandomString(12) + '!';
  }

  // Get default usage limits for tier
  private getDefaultUsageLimits(tier: string): any {
    const limits = {
      free: { feeds: 3, apiCalls: 100, analysis: 1, predictions: 5, dataRetention: 7 },
      professional: { feeds: 20, apiCalls: 10000, analysis: 30, predictions: 100, dataRetention: 90 },
      enterprise: { feeds: -1, apiCalls: 100000, analysis: -1, predictions: -1, dataRetention: 365 }
    };
    return limits[tier as keyof typeof limits] || limits.free;
  }

  // Map Supabase user to our User interface
  private mapSupabaseUserToUser(supabaseUser: any): User {
    const subscription = supabaseUser.user_subscriptions?.[0];
    
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      fullName: supabaseUser.full_name,
      role: supabaseUser.role,
      subscriptionTier: supabaseUser.subscription_tier,
      subscriptionStatus: supabaseUser.subscription_status,
      stripeCustomerId: supabaseUser.stripe_customer_id,
      apiKey: supabaseUser.api_key,
      preferences: supabaseUser.preferences || {},
      usageLimits: supabaseUser.usage_limits || {},
      createdAt: new Date(supabaseUser.created_at),
      updatedAt: new Date(supabaseUser.updated_at),
      lastLoginAt: supabaseUser.last_login_at ? new Date(supabaseUser.last_login_at) : undefined,
      emailVerified: supabaseUser.email_verified,
      trialEndsAt: supabaseUser.trial_ends_at ? new Date(supabaseUser.trial_ends_at) : undefined,
      subscription: subscription ? {
        id: subscription.id,
        planId: subscription.plan_id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end),
        plan: subscription.subscription_plans ? {
          name: subscription.subscription_plans.name,
          slug: subscription.subscription_plans.slug,
          limits: subscription.subscription_plans.limits,
          features: subscription.subscription_plans.features,
          priceMonthly: subscription.subscription_plans.price_monthly || 0
        } : undefined
      } : undefined
    };
  }

  // Send welcome email (placeholder - implement with your email service)
  private async sendWelcomeEmail(email: string, fullName: string, temporaryPassword: string): Promise<void> {
    logger.info('Sending welcome email', { email, fullName });
    // TODO: Implement email service integration
    // Could use SendGrid, AWS SES, or Resend
  }
}

export const authService = new SupabaseAuthService();