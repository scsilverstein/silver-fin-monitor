// Test the actual prediction service
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testRealPredictionService() {
  try {
    console.log('Testing real prediction service...');
    
    // Import the service (dynamic import to handle ES modules)
    const { aiAnalysisService } = await import('./src/services/ai/analysis.ts');
    
    // Test prediction generation for 2025-07-22
    await aiAnalysisService.generatePredictions('2025-07-22');
    
    console.log('✅ Prediction generation completed');
    
    // Check results
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('daily_analysis_id', '26a1abfa-d86b-428a-b183-4272890406f0')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('❌ Error checking predictions:', error);
      return;
    }
    
    console.log(`✅ Found ${predictions.length} predictions after service call`);
    predictions.slice(0, 3).forEach((p, i) => {
      console.log(`  ${i+1}. ${p.prediction_type} - ${p.time_horizon} (${Math.round(p.confidence_level * 100)}%)`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealPredictionService();