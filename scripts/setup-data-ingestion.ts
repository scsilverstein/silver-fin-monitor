#!/usr/bin/env node
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Load environment variables
config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials. Please check your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Initial feed sources based on CLAUDE.md specification
const INITIAL_FEED_SOURCES = [
  {
    name: 'CNBC Squawk Box',
    type: 'podcast',
    url: 'https://feeds.nbcuni.com/cnbc/podcast/squawk-box',
    is_active: true,
    config: {
      categories: ['finance', 'markets', 'economy'],
      priority: 'high',
      update_frequency: 'hourly',
      process_transcript: true
    }
  },
  {
    name: 'Bloomberg Surveillance',
    type: 'podcast',
    url: 'https://feeds.bloomberg.fm/surveillance',
    is_active: true,
    config: {
      categories: ['finance', 'markets', 'global_economy'],
      priority: 'high',
      update_frequency: 'hourly',
      extract_guests: true
    }
  },
  {
    name: 'Financial Times - Markets',
    type: 'rss',
    url: 'https://www.ft.com/markets?format=rss',
    is_active: true,
    config: {
      categories: ['finance', 'markets', 'analysis'],
      priority: 'high',
      update_frequency: '15min'
    }
  },
  {
    name: 'All-In Podcast',
    type: 'podcast',
    url: 'https://feeds.megaphone.fm/all-in-with-chamath-jason-sacks-friedberg',
    is_active: true,
    config: {
      categories: ['technology', 'venture_capital', 'politics'],
      priority: 'medium',
      update_frequency: 'weekly',
      extract_guests: true
    }
  },
  {
    name: 'This Week in Startups',
    type: 'podcast',
    url: 'https://feeds.megaphone.fm/thisweekin',
    is_active: true,
    config: {
      categories: ['startups', 'venture_capital', 'technology'],
      priority: 'medium',
      update_frequency: 'daily'
    }
  },
  {
    name: 'Peter Zeihan RSS',
    type: 'rss',
    url: 'https://zeihan.com/feed/',
    is_active: true,
    config: {
      categories: ['geopolitics', 'economics', 'demographics'],
      priority: 'high',
      update_frequency: 'daily'
    }
  },
  {
    name: 'The Economist - World News',
    type: 'rss',
    url: 'https://www.economist.com/the-world-this-week/rss.xml',
    is_active: true,
    config: {
      categories: ['geopolitics', 'economics', 'analysis'],
      priority: 'medium',
      update_frequency: 'daily'
    }
  },
  {
    name: 'Chat with Traders',
    type: 'podcast',
    url: 'https://chatwithtraders.com/feed/',
    is_active: true,
    config: {
      categories: ['trading', 'markets', 'strategy'],
      priority: 'medium',
      update_frequency: 'weekly',
      extract_guests: true
    }
  },
  {
    name: 'MacroVoices',
    type: 'podcast',
    url: 'https://feeds.feedburner.com/MacroVoices',
    is_active: true,
    config: {
      categories: ['macro', 'commodities', 'global_markets'],
      priority: 'medium',
      update_frequency: 'weekly'
    }
  },
  {
    name: 'Real Vision Daily',
    type: 'podcast',
    url: 'https://feeds.megaphone.fm/realvision',
    is_active: true,
    config: {
      categories: ['finance', 'crypto', 'macro'],
      priority: 'medium',
      update_frequency: 'daily'
    }
  }
];

async function checkDatabaseConnection() {
  console.log('🔍 Checking database connection...');
  try {
    const { data, error } = await supabase
      .from('feed_sources')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err);
    return false;
  }
}

async function setupFeedSources() {
  console.log('\n📡 Setting up feed sources...');
  
  try {
    // First, check existing sources
    const { data: existingSources, error: fetchError } = await supabase
      .from('feed_sources')
      .select('*');
    
    if (fetchError) {
      console.error('❌ Error fetching existing sources:', fetchError);
      return false;
    }
    
    console.log(`Found ${existingSources?.length || 0} existing feed sources`);
    
    // Insert new sources
    for (const source of INITIAL_FEED_SOURCES) {
      const exists = existingSources?.some(s => s.url === source.url);
      
      if (!exists) {
        const { error } = await supabase
          .from('feed_sources')
          .insert(source);
        
        if (error) {
          console.error(`❌ Error inserting ${source.name}:`, error.message);
        } else {
          console.log(`✅ Added feed source: ${source.name}`);
        }
      } else {
        console.log(`⏭️  Skipping existing source: ${source.name}`);
      }
    }
    
    return true;
  } catch (err) {
    console.error('❌ Error setting up feed sources:', err);
    return false;
  }
}

async function createInitialJobs() {
  console.log('\n🔄 Creating initial processing jobs...');
  
  try {
    // Get all active feed sources
    const { data: sources, error } = await supabase
      .from('feed_sources')
      .select('*')
      .eq('is_active', true);
    
    if (error || !sources) {
      console.error('❌ Error fetching feed sources:', error);
      return false;
    }
    
    console.log(`Creating jobs for ${sources.length} active sources`);
    
    // Create a job for each source
    for (const source of sources) {
      const { error: jobError } = await supabase
        .from('job_queue')
        .insert({
          job_type: 'feed_fetch',
          priority: source.config?.priority === 'high' ? 1 : 5,
          payload: { sourceId: source.id, sourceName: source.name },
          status: 'pending',
          scheduled_at: new Date().toISOString()
        });
      
      if (jobError) {
        console.error(`❌ Error creating job for ${source.name}:`, jobError.message);
      } else {
        console.log(`✅ Created job for: ${source.name}`);
      }
    }
    
    // Create a daily analysis job
    const { error: analysisError } = await supabase
      .from('job_queue')
      .insert({
        job_type: 'daily_analysis',
        priority: 2,
        payload: { date: new Date().toISOString().split('T')[0] },
        status: 'pending',
        scheduled_at: new Date().toISOString()
      });
    
    if (analysisError) {
      console.error('❌ Error creating daily analysis job:', analysisError.message);
    } else {
      console.log('✅ Created daily analysis job');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Error creating jobs:', err);
    return false;
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying data ingestion setup...');
  
  try {
    // Check feed sources
    const { data: sources, error: sourcesError } = await supabase
      .from('feed_sources')
      .select('count');
    
    // Check jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('job_queue')
      .select('count')
      .eq('status', 'pending');
    
    // Check for any processed content
    const { data: content, error: contentError } = await supabase
      .from('processed_content')
      .select('count');
    
    console.log('\n📊 Setup Summary:');
    console.log(`- Feed Sources: ${sources?.[0]?.count || 0}`);
    console.log(`- Pending Jobs: ${jobs?.[0]?.count || 0}`);
    console.log(`- Processed Content: ${content?.[0]?.count || 0}`);
    
    return true;
  } catch (err) {
    console.error('❌ Error verifying setup:', err);
    return false;
  }
}

async function triggerProcessing() {
  console.log('\n🚀 Triggering feed processing...');
  
  // Check if backend server is running
  try {
    const response = await axios.get('http://localhost:3001/api/v1/health');
    console.log('✅ Backend server is running');
    
    // Trigger feed processing
    const processResponse = await axios.post('http://localhost:3001/api/v1/queue/process-next');
    console.log('✅ Feed processing triggered');
    
    return true;
  } catch (err) {
    console.log('⚠️  Backend server not running. Start it with: npm run dev');
    console.log('   Jobs are queued and will be processed when the server starts.');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Silver Fin Monitor - Data Ingestion Setup\n');
  
  // Step 1: Check database connection
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    console.error('\n❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  // Step 2: Setup feed sources
  const sourcesSetup = await setupFeedSources();
  if (!sourcesSetup) {
    console.error('\n❌ Failed to setup feed sources');
    process.exit(1);
  }
  
  // Step 3: Create initial jobs
  const jobsCreated = await createInitialJobs();
  if (!jobsCreated) {
    console.error('\n❌ Failed to create processing jobs');
    process.exit(1);
  }
  
  // Step 4: Verify setup
  await verifySetup();
  
  // Step 5: Try to trigger processing
  await triggerProcessing();
  
  console.log('\n✅ Data ingestion setup complete!');
  console.log('\nNext steps:');
  console.log('1. Start the backend server: npm run dev');
  console.log('2. Monitor processing: tail -f logs/feed-processor.log');
  console.log('3. Check the dashboard: http://localhost:9999');
}

// Run the setup
main().catch(console.error);