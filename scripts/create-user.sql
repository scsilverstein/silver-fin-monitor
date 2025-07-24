-- Create a new user in the database
-- Replace the values below with your desired user information

-- If you have a users table, use this:
INSERT INTO users (email, role, preferences, created_at)
VALUES (
    'admin@silverfin.com',  -- Replace with desired email
    'admin',              -- Role: 'viewer', 'analyst', or 'admin'
    '{}',                 -- Default empty preferences
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- If you need to create a user with authentication (using Supabase Auth):
-- This would need to be done through the Supabase Dashboard or Auth API
-- as it requires creating both an auth.users entry and a public.users entry