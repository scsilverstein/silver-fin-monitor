import { createClient } from '@supabase/supabase-js';
import config from '@/config';

// Create Supabase client
export const supabase = createClient(
  config.database.url,
  config.database.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-timezone': 'UTC'
      }
    }
  }
);

// Export types
export type { Database } from '@/types/database';