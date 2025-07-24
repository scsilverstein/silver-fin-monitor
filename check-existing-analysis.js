// Check existing analyses in the database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnjtzwqieqcrchhjouaz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnalyses() {
  try {
    console.log('Checking existing analyses...');
    
    // Get all analyses
    const { data: analyses, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .order('analysis_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching analyses:', error);
      return;
    }
    
    console.log(`Found ${analyses.length} analyses:`);
    analyses.forEach(analysis => {
      console.log(`- ID: ${analysis.id}, Date: ${analysis.analysis_date}, Sentiment: ${analysis.market_sentiment}`);
    });
    
    if (analyses.length > 0) {
      const latest = analyses[0];
      console.log('\nLatest analysis details:');
      console.log(JSON.stringify(latest, null, 2));
      
      // Test prediction generation
      console.log(`\nTesting prediction generation for analysis ID: ${latest.id}`);
      return latest.id;
    }
    
  } catch (error) {
    console.error('❌ Error checking analyses:', error);
  }
}

checkAnalyses();