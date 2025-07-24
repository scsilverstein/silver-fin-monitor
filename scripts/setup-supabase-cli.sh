#!/bin/bash

# Install Supabase CLI if not already installed
echo "Installing Supabase CLI..."
brew install supabase/tap/supabase

# Login to Supabase (you'll need to authenticate)
echo "Logging in to Supabase..."
supabase login

# Link to your project
echo "Linking to your project..."
supabase link --project-ref pnjtzwqieqcrchhjouaz

# Create the user using Supabase CLI
echo "Creating user..."
supabase db execute --sql "
INSERT INTO users (email, role, preferences, created_at)
VALUES (
    'admin@silverfin.com',
    'admin',
    '{}',
    NOW()
)
ON CONFLICT (email) DO NOTHING;"

echo "User created successfully!"