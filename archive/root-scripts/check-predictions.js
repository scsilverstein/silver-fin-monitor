// Check if predictions were saved to the database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnjtzwqieqcrchhjouaz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPredictions() {
  try {
    console.log('Checking for predictions...');
    
    // Get all predictions
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching predictions:', error);
      return;
    }
    
    console.log(`Found ${predictions.length} predictions:`);
    
    if (predictions.length === 0) {
      console.log('❌ No predictions found in database');
      return;
    }
    
    predictions.forEach((prediction, index) => {
      console.log(`\n${index + 1}. Prediction ID: ${prediction.id}`);
      console.log(`   Type: ${prediction.prediction_type}`);
      console.log(`   Time Horizon: ${prediction.time_horizon}`);
      console.log(`   Confidence: ${Math.round(prediction.confidence_level * 100)}%`);
      console.log(`   Text: ${prediction.prediction_text.substring(0, 100)}...`);
      console.log(`   Analysis ID: ${prediction.daily_analysis_id}`);
      console.log(`   Created: ${prediction.created_at}`);
    });
    
    console.log(`\n✅ Successfully found ${predictions.length} predictions!`);
    
    // Group by type and horizon
    const byType = predictions.reduce((acc, p) => {
      acc[p.prediction_type] = (acc[p.prediction_type] || 0) + 1;
      return acc;
    }, {});
    
    const byHorizon = predictions.reduce((acc, p) => {
      acc[p.time_horizon] = (acc[p.time_horizon] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nBreakdown by type:', byType);
    console.log('Breakdown by horizon:', byHorizon);
    
  } catch (error) {
    console.error('❌ Error checking predictions:', error);
  }
}

checkPredictions();