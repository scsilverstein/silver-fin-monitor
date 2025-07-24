-- Create admin user directly in the database
-- Run this in Supabase SQL editor

-- First, create the user in auth.users (if using Supabase Auth)
-- Note: You'll need to use Supabase dashboard or API to create auth user
-- Email: admin@silverfin.com
-- Password: admin123!

-- For now, let's create a simple users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    subscription_tier VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create usage_limits table if it doesn't exist
CREATE TABLE IF NOT EXISTS usage_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    usage_type VARCHAR(50) NOT NULL,
    limit_value INTEGER DEFAULT 0,
    used_value INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, usage_type)
);

-- Insert admin user (use a fixed UUID for consistency)
INSERT INTO users (id, email, full_name, role)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin@silverfin.com',
    'Admin User',
    'admin'
) ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();

-- Insert subscription for admin user
INSERT INTO subscriptions (user_id, subscription_tier, status, current_period_start, current_period_end)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'enterprise',
    'active',
    NOW(),
    NOW() + INTERVAL '1 year'
) ON CONFLICT DO NOTHING;

-- Insert usage limits for admin user (-1 means unlimited)
INSERT INTO usage_limits (user_id, usage_type, limit_value, used_value)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'feeds', -1, 0),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'api_calls', -1, 0),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'analysis', -1, 0),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'predictions', -1, 0)
ON CONFLICT (user_id, usage_type) DO UPDATE SET
    limit_value = EXCLUDED.limit_value;

-- Verify the user was created
SELECT * FROM users WHERE email = 'admin@silverfin.com';