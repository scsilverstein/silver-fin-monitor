#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function deployDatabaseFunctions() {
  try {
    console.log('🔧 Deploying essential database functions...');
    
    // Read the queue functions SQL file
    const functionsPath = path.join(__dirname, '../supabase/migrations/005_queue_cache_functions.sql');
    
    if (!fs.existsSync(functionsPath)) {
      console.error('❌ Queue functions SQL file not found:', functionsPath);
      process.exit(1);
    }
    
    const functionsSQL = fs.readFileSync(functionsPath, 'utf8');
    
    // Execute the SQL to create/update functions
    const { error } = await supabase.rpc('exec_sql', { sql: functionsSQL });
    
    if (error) {
      console.error('❌ Error deploying functions:', error);
      
      // Try alternative approach - execute functions one by one
      console.log('🔄 Trying alternative deployment method...');
      
      // Split by function definitions and execute individually
      const functions = functionsSQL.split('CREATE OR REPLACE FUNCTION');
      
      for (let i = 1; i < functions.length; i++) {
        const functionSQL = 'CREATE OR REPLACE FUNCTION' + functions[i];
        console.log(`Deploying function ${i}/${functions.length - 1}...`);
        
        try {
          // Since we can't use exec_sql, let's check if functions exist manually
          console.log('⚠️  Cannot directly execute SQL via RPC. Please run this SQL manually in Supabase dashboard:');
          console.log('---');
          console.log(functionSQL.substring(0, 200) + '...');
          console.log('---');
        } catch (funcError) {
          console.error(`❌ Error deploying function ${i}:`, funcError);
        }
      }
    } else {
      console.log('✅ Database functions deployed successfully!');
    }
    
    // Test if functions are available
    console.log('\n🧪 Testing database functions...');
    
    // Test enqueue_job function
    try {
      const { data: testJobId, error: enqueueError } = await supabase.rpc('enqueue_job', {
        job_type: 'test_function',
        payload: { test: true },
        priority: 10
      });
      
      if (enqueueError) {
        console.error('❌ enqueue_job function not available:', enqueueError.message);
      } else {
        console.log('✅ enqueue_job function working');
        
        // Test dequeue_job function
        const { data: jobs, error: dequeueError } = await supabase.rpc('dequeue_job');
        
        if (dequeueError) {
          console.error('❌ dequeue_job function not available:', dequeueError.message);
        } else {
          console.log('✅ dequeue_job function working');
          
          // If we got a job, test complete_job
          if (jobs && jobs.length > 0) {
            const { error: completeError } = await supabase.rpc('complete_job', { 
              job_id: jobs[0].job_id 
            });
            
            if (completeError) {
              console.error('❌ complete_job function not available:', completeError.message);
            } else {
              console.log('✅ complete_job function working');
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Function test failed:', error);
    }
    
    // Check current queue status
    console.log('\n📊 Current queue status:');
    const { data: queueStatus, error: statusError } = await supabase
      .from('job_queue')
      .select('status, count(*)')
      .group('status');
    
    if (statusError) {
      console.error('❌ Error getting queue status:', statusError);
    } else {
      queueStatus?.forEach(status => {
        console.log(`  ${status.status}: ${status.count} jobs`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to deploy database functions:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deployDatabaseFunctions()
    .then(() => {
      console.log('\n✨ Database function deployment completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database function deployment failed:', error);
      process.exit(1);
    });
}

export { deployDatabaseFunctions };