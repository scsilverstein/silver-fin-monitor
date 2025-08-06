// Check if the latest predictions were saved
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnjtzwqieqcrchhjouaz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestPredictions() {
  try {
    console.log('Checking for predictions from latest analysis (2025-07-22)...');
    
    // Get predictions for the latest analysis
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('daily_analysis_id', '26a1abfa-d86b-428a-b183-4272890406f0')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching latest predictions:', error);
      return;
    }
    
    console.log(`Found ${predictions.length} predictions for analysis 26a1abfa-d86b-428a-b183-4272890406f0:`);
    
    if (predictions.length === 0) {
      console.log('❌ No predictions found for the latest analysis');
      return;
    }
    
    predictions.forEach((prediction, index) => {
      console.log(`\n${index + 1}. ${prediction.prediction_type} - ${prediction.time_horizon}`);
      console.log(`   Confidence: ${Math.round(prediction.confidence_level * 100)}%`);
      console.log(`   Text: ${prediction.prediction_text.substring(0, 150)}...`);
      console.log(`   Created: ${prediction.created_at}`);
      
      // Show some prediction data details
      if (prediction.prediction_data) {
        const data = prediction.prediction_data;
        if (data.price_targets) {
          console.log(`   Price Target: ${data.price_targets.primary || 'Not specified'}`);
        }
        if (data.financial_metrics) {
          console.log(`   Expected Return: ${data.financial_metrics.expected_return || 'Not specified'}`);
        }
      }
    });
    
    console.log(`\n✅ Successfully found ${predictions.length} predictions from the latest analysis!`);
    
  } catch (error) {
    console.error('❌ Error checking latest predictions:', error);
  }
}

checkLatestPredictions();