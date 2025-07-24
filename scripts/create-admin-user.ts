#!/usr/bin/env tsx
// Script to create an admin user in the database

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  console.log('🔧 Creating admin user...\n');

  const email = 'admin@silverfin.com';
  const password = 'admin123!'; // Change this in production!
  const fullName = 'Admin User';

  try {
    // Check if admin already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .single();

    if (existingUser) {
      console.log('⚠️  Admin user already exists:', email);
      
      // Update to ensure admin role
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role: 'admin',
          subscription_tier: 'enterprise',
          subscription_status: 'active',
          email_verified: true
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('❌ Failed to update existing user:', updateError.message);
        return;
      }

      console.log('✅ Updated existing user to admin role');
      console.log('\n📧 Email:', email);
      console.log('🔑 Password:', password);
      console.log('👤 Role: admin');
      console.log('💎 Tier: enterprise');
      return;
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'admin'
      }
    });

    if (authError) {
      console.error('❌ Failed to create auth user:', authError.message);
      return;
    }

    console.log('✅ Created auth user:', authUser.user?.id);

    // Generate API key
    const apiKey = `sfm_${generateRandomString(32)}`;

    // Create user record
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.user!.id,
        email,
        full_name: fullName,
        role: 'admin',
        subscription_tier: 'enterprise',
        subscription_status: 'active',
        api_key: apiKey,
        email_verified: true,
        usage_limits: {
          feeds: -1,
          apiCalls: -1,
          analysis: -1,
          predictions: -1,
          dataRetention: 365
        }
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ Failed to create user record:', userError.message);
      // Try to clean up auth user
      await supabase.auth.admin.deleteUser(authUser.user!.id);
      return;
    }

    console.log('✅ Created user record');

    // Create active subscription
    const { error: subError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: 'enterprise',
        status: 'active',
        current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        metadata: { created_by: 'admin_script' }
      });

    if (subError) {
      console.warn('⚠️  Warning: Failed to create subscription record:', subError.message);
    } else {
      console.log('✅ Created enterprise subscription');
    }

    console.log('\n🎉 Admin user created successfully!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Role: admin');
    console.log('💎 Tier: enterprise');
    console.log('🔐 API Key:', apiKey);
    console.log('\n⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Run the script
createAdminUser().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});