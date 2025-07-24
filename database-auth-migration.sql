-- Silver Fin Monitor Authentication and Subscription System
-- Database Migration for User Management and Subscriptions

-- Users table with Supabase Auth integration
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'professional', 'enterprise')),
  subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
  stripe_customer_id VARCHAR(255) UNIQUE,
  api_key VARCHAR(255) UNIQUE,
  preferences JSONB DEFAULT '{}',
  usage_limits JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  email_verified BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMP WITH TIME ZONE
);

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL, -- in cents
  price_yearly INTEGER, -- in cents (optional)
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_yearly VARCHAR(255),
  limits JSONB DEFAULT '{}', -- e.g., {"feeds": 20, "apiCalls": 10000}
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'incomplete', 'incomplete_expired', 'past_due', 'cancelled', 'unpaid')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_type VARCHAR(50) NOT NULL, -- 'api_calls', 'feeds_processed', 'analysis_generated'
  count INTEGER DEFAULT 1,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, usage_type, period_start)
);

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'card', 'bank_account', etc.
  card_brand VARCHAR(50),
  card_last4 VARCHAR(4),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id),
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  amount_paid INTEGER NOT NULL, -- in cents
  amount_due INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL, -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_preview VARCHAR(20) NOT NULL, -- First few characters for display
  permissions TEXT[] DEFAULT '{}', -- e.g., ['read', 'write', 'admin']
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_period ON user_usage(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, limits, features) VALUES 
(
  'Free',
  'free',
  'Perfect for trying out Silver Fin Monitor',
  0,
  0,
  '{"feeds": 3, "apiCalls": 100, "analysis": 1, "predictions": 5, "dataRetention": 7}',
  ARRAY['Basic dashboard', 'Limited feeds', 'Email alerts']
),
(
  'Professional',
  'professional', 
  'Ideal for individual traders and small teams',
  2900, -- $29.00
  29000, -- $290.00 (save ~17%)
  '{"feeds": 20, "apiCalls": 10000, "analysis": 30, "predictions": 100, "dataRetention": 90}',
  ARRAY['Advanced analytics', 'All feed sources', 'API access', 'Custom alerts', 'Export data']
),
(
  'Enterprise',
  'enterprise',
  'For financial institutions and large teams',
  19900, -- $199.00
  199000, -- $1990.00 (save ~17%)
  '{"feeds": -1, "apiCalls": 100000, "analysis": -1, "predictions": -1, "dataRetention": 365}',
  ARRAY['White-label option', 'Custom integrations', 'Priority support', 'SLA guarantee', 'Team management', 'Advanced reporting']
);

-- Functions for user management

-- Function to check user limits
CREATE OR REPLACE FUNCTION check_user_limit(
  p_user_id UUID,
  p_limit_type VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
  user_plan RECORD;
  current_usage INTEGER;
  limit_value INTEGER;
BEGIN
  -- Get user's current plan limits
  SELECT sp.limits INTO user_plan
  FROM users u
  JOIN subscription_plans sp ON u.subscription_tier = sp.slug
  WHERE u.id = p_user_id;
  
  -- Extract the specific limit
  limit_value := (user_plan.limits ->> p_limit_type)::INTEGER;
  
  -- If limit is -1, it means unlimited
  IF limit_value = -1 THEN
    RETURN TRUE;
  END IF;
  
  -- Get current usage for this month
  SELECT COALESCE(SUM(count), 0) INTO current_usage
  FROM user_usage
  WHERE user_id = p_user_id 
    AND usage_type = p_limit_type
    AND period_start >= DATE_TRUNC('month', CURRENT_DATE);
  
  RETURN current_usage < limit_value;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_user_usage(
  p_user_id UUID,
  p_usage_type VARCHAR(50),
  p_count INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
DECLARE
  period_start DATE := DATE_TRUNC('month', CURRENT_DATE);
  period_end DATE := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
BEGIN
  INSERT INTO user_usage (user_id, usage_type, count, period_start, period_end, metadata)
  VALUES (p_user_id, p_usage_type, p_count, period_start, period_end, p_metadata)
  ON CONFLICT (user_id, usage_type, period_start)
  DO UPDATE SET 
    count = user_usage.count + EXCLUDED.count,
    metadata = EXCLUDED.metadata;
END;
$$ LANGUAGE plpgsql;

-- Function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key(
  p_user_id UUID,
  p_key_name VARCHAR(255),
  p_permissions TEXT[] DEFAULT ARRAY['read']
) RETURNS VARCHAR(64) AS $$
DECLARE
  api_key VARCHAR(64);
  key_hash VARCHAR(255);
  key_preview VARCHAR(20);
BEGIN
  -- Generate random API key (in production, use proper crypto functions)
  api_key := 'sfm_' || encode(gen_random_bytes(32), 'hex');
  key_hash := encode(digest(api_key, 'sha256'), 'hex');
  key_preview := LEFT(api_key, 16) || '...';
  
  -- Insert the API key
  INSERT INTO api_keys (user_id, key_name, key_hash, key_preview, permissions)
  VALUES (p_user_id, p_key_name, key_hash, key_preview, p_permissions);
  
  RETURN api_key;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Subscription policies
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own usage" ON user_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own payment methods" ON payment_methods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own API keys" ON api_keys FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (for admin dashboard)
CREATE POLICY "Admins can view all users" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);