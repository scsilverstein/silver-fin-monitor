// Authentication Types for Silver Fin Monitor

export interface User {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  subscriptionTier: 'free' | 'professional' | 'enterprise';
  subscriptionStatus: 'active' | 'cancelled' | 'past_due' | 'trialing';
  stripeCustomerId?: string;
  apiKey?: string;
  preferences: Record<string, any>;
  usageLimits: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  emailVerified: boolean;
  trialEndsAt?: Date;
  subscription?: UserSubscription;
  pendingUsage?: {
    type: UsageType;
    count: number;
  };
}

export interface UserSubscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodEnd: Date;
  plan?: SubscriptionPlan;
}

export interface SubscriptionPlan {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  priceMonthly: number; // in cents
  priceYearly?: number; // in cents
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  limits: Record<string, number>; // -1 means unlimited
  features: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateUserData {
  email: string;
  password?: string; // Optional - will generate temporary password if not provided
  fullName?: string;
  role?: 'user' | 'admin';
  subscriptionTier?: 'free' | 'professional' | 'enterprise';
  preferences?: Record<string, any>;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateUserData {
  fullName?: string;
  avatarUrl?: string;
  preferences?: Record<string, any>;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

export interface UserUsage {
  id: string;
  userId: string;
  usageType: string;
  count: number;
  periodStart: Date;
  periodEnd: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  keyName: string;
  keyHash: string;
  keyPreview: string;
  permissions: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: string;
  cardBrand?: string;
  cardLast4?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  subscriptionId?: string;
  stripeInvoiceId: string;
  amountPaid: number; // in cents
  amountDue: number;
  currency: string;
  status: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  createdAt: Date;
  dueDate?: Date;
  paidAt?: Date;
}

// JWT Token Payload
export interface JWTPayload {
  sub: string; // User ID
  email: string;
  role: 'user' | 'admin';
  subscriptionTier: 'free' | 'professional' | 'enterprise';
  iat: number;
  exp: number;
}

// Authentication Response Types
export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  temporaryPassword?: string;
  message?: string;
}

export interface TokenRefreshResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  message?: string;
}

// Subscription Management Types
export interface SubscriptionCheckout {
  planSlug: string;
  billing: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
  couponCode?: string;
}

export interface UsageLimits {
  feeds: number;
  apiCalls: number;
  analysis: number;
  predictions: number;
  dataRetention: number; // days
}

export interface SubscriptionTierInfo {
  tier: 'free' | 'professional' | 'enterprise';
  limits: UsageLimits;
  features: string[];
  price: {
    monthly: number;
    yearly?: number;
  };
}

// Webhook Types for Stripe
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

// API Request Types
export interface AuthenticatedRequest {
  user?: User;
  userId?: string;
}

// Usage Tracking Types
export type UsageType = 
  | 'api_calls' 
  | 'feeds_processed' 
  | 'analysis_generated' 
  | 'predictions_made'
  | 'data_exports'
  | 'custom_alerts'
  | 'daily_analysis'
  | 'prediction_generation'
  | 'content_searches'
  | 'api_requests';

export interface UsageIncrement {
  type: UsageType;
  count: number;
  metadata?: Record<string, any>;
}

// Permission Types
export type Permission = 
  | 'read' 
  | 'write' 
  | 'admin' 
  | 'feeds:read' 
  | 'feeds:write' 
  | 'analysis:read' 
  | 'predictions:read' 
  | 'users:admin';

// Feature Flags
export interface FeatureFlags {
  apiAccess: boolean;
  customFeeds: boolean;
  advancedAnalytics: boolean;
  exportData: boolean;
  teamManagement: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
  customIntegrations: boolean;
}

// Admin Types
export interface AdminUserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'user' | 'admin';
  subscriptionTier?: 'free' | 'professional' | 'enterprise';
  subscriptionStatus?: 'active' | 'cancelled' | 'past_due' | 'trialing';
  sortBy?: 'createdAt' | 'lastLoginAt' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  churnRate: number;
  newUsersThisMonth: number;
  apiCallsThisMonth: number;
  topPlans: Array<{
    planName: string;
    userCount: number;
    revenue: number;
  }>;
}

// Error Types
export class AuthenticationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class SubscriptionError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export class UsageLimitError extends Error {
  constructor(message: string, public usageType?: UsageType, public limit?: number) {
    super(message);
    this.name = 'UsageLimitError';
  }
}