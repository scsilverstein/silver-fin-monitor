import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyDailyAnalysis() {
  try {
    // Get the daily analysis for 2025-07-30
    const { data: analysis, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .eq('analysis_date', '2025-07-30')
      .single();
    
    if (error) {
      console.error('Error fetching analysis:', error);
      return;
    }
    
    console.log('Daily Analysis for 2025-07-30:');
    console.log('=====================================');
    console.log('ID:', analysis.id);
    console.log('Date:', analysis.analysis_date);
    console.log('Market Sentiment:', analysis.market_sentiment);
    console.log('Confidence Score:', analysis.confidence_score);
    console.log('Sources Analyzed:', analysis.sources_analyzed);
    console.log('\nKey Themes:', analysis.key_themes);
    console.log('\nOverall Summary:');
    console.log(analysis.overall_summary);
    console.log('\nAI Analysis:', JSON.stringify(analysis.ai_analysis, null, 2));
    console.log('\nProcessing Metadata:', JSON.stringify(analysis.processing_metadata, null, 2));
    console.log('Created At:', analysis.created_at);
    
    // Check if there are any predictions for this analysis
    const { data: predictions, error: predError } = await supabase
      .from('predictions')
      .select('*')
      .eq('daily_analysis_id', analysis.id);
    
    if (!predError && predictions) {
      console.log(`\nPredictions (${predictions.length} found):`);
      console.log('=====================================');
      predictions.forEach((pred, index) => {
        console.log(`\nPrediction ${index + 1}:`);
        console.log('Type:', pred.prediction_type);
        console.log('Time Horizon:', pred.time_horizon);
        console.log('Confidence:', pred.confidence_level);
        console.log('Text:', pred.prediction_text);
      });
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run verification
verifyDailyAnalysis()
  .then(() => {
    console.log('\nVerification completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });