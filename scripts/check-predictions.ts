import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPredictions() {
  try {
    console.log('Checking predictions in database...\n');
    
    // Count predictions
    const { count: totalPredictions, error: countError } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting predictions:', countError);
      return;
    }
    
    console.log(`Total predictions: ${totalPredictions || 0}`);
    
    // Get sample predictions
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('Error fetching predictions:', error);
      return;
    }
    
    if (predictions && predictions.length > 0) {
      console.log('\nSample predictions:');
      predictions.forEach((pred, index) => {
        console.log(`\n${index + 1}. ${pred.prediction_type} (${pred.time_horizon})`);
        console.log(`   Confidence: ${pred.confidence_level}`);
        console.log(`   Text: ${pred.prediction_text?.substring(0, 100)}...`);
        console.log(`   Created: ${new Date(pred.created_at).toLocaleString()}`);
      });
    } else {
      console.log('\nNo predictions found in database.');
      
      // Check if we have any daily analyses
      const { count: analysisCount } = await supabase
        .from('daily_analysis')
        .select('*', { count: 'exact', head: true });
      
      console.log(`\nDaily analyses count: ${analysisCount || 0}`);
      
      if (analysisCount && analysisCount > 0) {
        console.log('\nYou have analyses but no predictions. Try generating predictions from the UI.');
      } else {
        console.log('\nNo daily analyses found. You need to run daily analysis first before generating predictions.');
      }
    }
    
    // Check prediction_comparisons table
    const { count: comparisonCount, error: compError } = await supabase
      .from('prediction_comparisons')
      .select('*', { count: 'exact', head: true });
    
    if (!compError) {
      console.log(`\nPrediction comparisons: ${comparisonCount || 0}`);
    }
    
  } catch (error) {
    console.error('Error checking predictions:', error);
  }
}

checkPredictions();