import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFeedSource() {
  try {
    // Get the retry job details
    console.log('Checking retry job details...\n');
    
    const { data: retryJobs, error: jobError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'retry')
      .eq('job_type', 'feed_fetch');
    
    if (jobError) {
      console.error('Error fetching retry jobs:', jobError);
      return;
    }
    
    if (!retryJobs || retryJobs.length === 0) {
      console.log('No retry jobs found');
      return;
    }
    
    console.log(`Found ${retryJobs.length} retry job(s):`);
    
    for (const job of retryJobs) {
      console.log(`\nJob ID: ${job.id}`);
      console.log(`Payload: ${JSON.stringify(job.payload)}`);
      console.log(`Error: ${job.error_message}`);
      console.log(`Attempts: ${job.attempts}/${job.max_attempts}`);
      
      // Extract sourceId from payload
      const sourceId = job.payload?.sourceId;
      
      if (sourceId) {
        console.log(`\nChecking feed source: ${sourceId}`);
        
        const { data: feedSource, error: sourceError } = await supabase
          .from('feed_sources')
          .select('*')
          .eq('id', sourceId)
          .single();
        
        if (sourceError) {
          console.error('Error fetching feed source:', sourceError);
          
          // Create a default feed source if it doesn't exist
          console.log('\nCreating default feed source...');
          const { data: newSource, error: createError } = await supabase
            .from('feed_sources')
            .insert({
              id: sourceId,
              name: 'Test Feed Source',
              type: 'rss',
              url: 'https://feeds.feedburner.com/TechCrunch/',
              is_active: true,
              config: {
                categories: ['technology', 'news'],
                priority: 'medium',
                update_frequency: 'hourly'
              }
            })
            .select()
            .single();
          
          if (createError) {
            console.error('Failed to create feed source:', createError);
          } else {
            console.log('✓ Created feed source:', newSource.name);
          }
        } else if (feedSource) {
          console.log('✓ Feed source exists:');
          console.log(`  - Name: ${feedSource.name}`);
          console.log(`  - Type: ${feedSource.type}`);
          console.log(`  - URL: ${feedSource.url}`);
          console.log(`  - Active: ${feedSource.is_active}`);
          console.log(`  - Last processed: ${feedSource.last_processed_at || 'Never'}`);
        }
      }
    }
    
    // Check all feed sources
    console.log('\n\nAll Feed Sources:');
    const { data: allSources, error: allError } = await supabase
      .from('feed_sources')
      .select('id, name, type, is_active, last_processed_at')
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.error('Error fetching all sources:', allError);
    } else if (allSources && allSources.length > 0) {
      allSources.forEach((source: any) => {
        console.log(`- ${source.name} (${source.id})`);
        console.log(`  Type: ${source.type}, Active: ${source.is_active}`);
      });
    } else {
      console.log('No feed sources found in database');
    }
    
  } catch (error) {
    console.error('Error checking feed source:', error);
  }
}

// Run the check
checkFeedSource().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});