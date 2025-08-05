import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDailyAnalysis() {
  console.log('🔍 Checking Daily Analysis Data...\n');
  
  // 1. Check recent daily analyses
  console.log('1. Recent Daily Analyses:');
  const { data: analyses, error } = await supabase
    .from('daily_analysis')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error fetching analyses:', error);
    return;
  }
  
  if (!analyses || analyses.length === 0) {
    console.log('  ❌ No daily analyses found!');
  } else {
    console.log(`  Found ${analyses.length} analyses:`);
    analyses.forEach(analysis => {
      console.log(`\n  📊 Analysis ${analysis.id.substring(0, 8)}...`);
      console.log(`     Date: ${analysis.analysis_date}`);
      console.log(`     Sentiment: ${analysis.market_sentiment}`);
      console.log(`     Confidence: ${analysis.confidence_score}`);
      console.log(`     Sources: ${analysis.sources_analyzed}`);
      console.log(`     Key Themes: ${JSON.stringify(analysis.key_themes || [])}`);
      console.log(`     Created: ${new Date(analysis.created_at).toLocaleString()}`);
    });
  }
  
  // 2. Check today's analysis
  console.log('\n2. Today\'s Analysis:');
  const today = new Date().toISOString().split('T')[0];
  const { data: todayAnalysis } = await supabase
    .from('daily_analysis')
    .select('*')
    .eq('analysis_date', today)
    .single();
  
  if (todayAnalysis) {
    console.log('  ✅ Today\'s analysis exists!');
    console.log(`     ID: ${todayAnalysis.id}`);
    console.log(`     Summary: ${todayAnalysis.overall_summary?.substring(0, 100)}...`);
  } else {
    console.log(`  ❌ No analysis found for today (${today})`);
  }
  
  // 3. Check predictions
  console.log('\n3. Recent Predictions:');
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (predictions && predictions.length > 0) {
    console.log(`  Found ${predictions.length} predictions`);
    predictions.forEach(pred => {
      console.log(`\n  🎯 Prediction ${pred.id.substring(0, 8)}...`);
      console.log(`     Type: ${pred.prediction_type}`);
      console.log(`     Horizon: ${pred.time_horizon}`);
      console.log(`     Confidence: ${pred.confidence_level}`);
      console.log(`     Text: ${pred.prediction_text?.substring(0, 80)}...`);
    });
  } else {
    console.log('  ❌ No predictions found');
  }
  
  // 4. Test API endpoints
  console.log('\n4. Testing API Endpoints:');
  
  const endpoints = [
    'http://localhost:3001/api/analysis',
    'http://localhost:3001/api/analysis/latest',
    `http://localhost:3001/api/analysis/${today}`,
    'http://localhost:3001/api/dashboard/overview'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${process.env.JWT_SECRET || 'test-token'}`
        }
      });
      const data = await response.json();
      console.log(`\n  ${endpoint}:`);
      console.log(`     Status: ${response.status}`);
      console.log(`     Success: ${data.success}`);
      if (data.error) {
        console.log(`     Error: ${data.error.message || data.error}`);
      }
      if (data.data) {
        console.log(`     Has Data: Yes`);
      }
    } catch (error) {
      console.log(`\n  ${endpoint}:`);
      console.log(`     Error: ${error.message}`);
    }
  }
}

// Run check
checkDailyAnalysis().then(() => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});