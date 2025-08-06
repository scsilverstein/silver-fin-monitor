// Simple test script to create a test analysis for prediction testing
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnjtzwqieqcrchhjouaz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestAnalysis() {
  try {
    console.log('Creating test daily analysis...');
    
    const analysisDate = '2025-07-21';
    
    // Create a test daily analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('daily_analysis')
      .insert({
        analysis_date: analysisDate,
        market_sentiment: 'bullish',
        key_themes: ['technology', 'economic_growth', 'market_optimism'],
        overall_summary: 'Market shows strong bullish sentiment with technology leading gains. Economic indicators point to continued growth.',
        ai_analysis: {
          market_drivers: ['Tech earnings', 'Economic growth', 'Fed policy'],
          risk_factors: ['Inflation concerns', 'Geopolitical tensions'],
          opportunities: ['AI investments', 'Cloud computing', 'Clean energy'],
          geopolitical_context: 'Stable political environment supporting market growth',
          economic_indicators: ['GDP growth', 'Low unemployment', 'Stable inflation']
        },
        confidence_score: 0.85,
        sources_analyzed: 4
      })
      .select()
      .single();
    
    if (analysisError) {
      console.error('Error creating analysis:', analysisError);
      return;
    }
    
    console.log('✅ Test analysis created successfully!');
    console.log('Analysis ID:', analysis.id);
    console.log('Analysis Date:', analysis.analysis_date);
    
    return analysis;
    
  } catch (error) {
    console.error('❌ Error creating test analysis:', error);
  }
}

createTestAnalysis();