#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function forcePendingJob() {
  console.log('⏰ Forcing pending job to run now...');
  
  try {
    // Update the prediction validation job to run now
    const { data, error } = await supabase
      .from('job_queue')
      .update({
        scheduled_at: new Date().toISOString()
      })
      .eq('id', '7c9f9b70-e533-4511-9134-e9b42086b7e5')
      .select()
      .single();
    
    if (error) throw error;
    
    if (data) {
      console.log(`✅ Updated job to run now:`);
      console.log(`  - Type: ${data.job_type}`);
      console.log(`  - Was scheduled for: ${data.scheduled_at}`);
      console.log(`  - Now scheduled for: NOW`);
    }
    
  } catch (error) {
    console.error('❌ Error updating job:', error);
    process.exit(1);
  }
}

// Run it
forcePendingJob().then(() => {
  console.log('\n🎉 Done! Job is now ready to process.');
  process.exit(0);
});