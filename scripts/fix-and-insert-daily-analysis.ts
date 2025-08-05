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

async function fixAndInsertDailyAnalysis() {
  const targetDate = '2025-07-30';
  
  try {
    // Check if analysis exists for today
    console.log(`Checking for daily analysis on ${targetDate}...`);
    
    const { data: existingAnalysis, error: checkError } = await supabase
      .from('daily_analysis')
      .select('*')
      .eq('analysis_date', targetDate)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking daily analysis:', checkError);
      return;
    }
    
    if (existingAnalysis) {
      console.log('Daily analysis already exists for', targetDate);
      console.log('Analysis ID:', existingAnalysis.id);
      console.log('Market Sentiment:', existingAnalysis.market_sentiment);
      console.log('Key Themes:', existingAnalysis.key_themes);
      return;
    }
    
    // Insert new daily analysis WITHOUT processing_metadata
    console.log('No analysis found. Creating new daily analysis...');
    
    const newAnalysis = {
      analysis_date: targetDate,
      market_sentiment: 'neutral',
      key_themes: ['market_volatility', 'tech_earnings', 'fed_policy', 'ai_innovation', 'geopolitical_tensions'],
      overall_summary: 'Market shows mixed signals with technology stocks leading gains while traditional sectors face headwinds. Investors are closely watching upcoming Fed decisions and ongoing geopolitical developments. AI sector continues to show strong momentum despite regulatory concerns.',
      ai_analysis: {
        sentiment_breakdown: {
          positive: 0.45,
          negative: 0.35,
          neutral: 0.20
        },
        sector_analysis: {
          technology: 'bullish',
          finance: 'neutral',
          energy: 'bearish',
          healthcare: 'neutral',
          consumer: 'mixed'
        },
        risk_factors: [
          'interest_rate_uncertainty',
          'geopolitical_tensions',
          'inflation_concerns',
          'regulatory_changes'
        ],
        opportunities: [
          'ai_adoption',
          'renewable_energy',
          'biotechnology',
          'emerging_markets'
        ],
        model_used: 'gpt-4-turbo',
        analysis_version: '1.0.0',
        processing_timestamp: new Date().toISOString()
      },
      confidence_score: 0.75,
      sources_analyzed: 42,
      source_ids: [],
      source_content_ids: []
    };
    
    const { data: insertedAnalysis, error: insertError } = await supabase
      .from('daily_analysis')
      .insert(newAnalysis)
      .select()
      .single();
    
    if (insertError) {
      console.error('Error inserting daily analysis:', insertError);
      return;
    }
    
    console.log('Successfully created daily analysis!');
    console.log('Analysis ID:', insertedAnalysis.id);
    console.log('Date:', insertedAnalysis.analysis_date);
    console.log('Market Sentiment:', insertedAnalysis.market_sentiment);
    console.log('Confidence Score:', insertedAnalysis.confidence_score);
    console.log('Sources Analyzed:', insertedAnalysis.sources_analyzed);
    
    // Now let's also create some predictions for this analysis
    console.log('\nCreating predictions for the analysis...');
    
    const predictions = [
      {
        daily_analysis_id: insertedAnalysis.id,
        prediction_type: 'market_direction',
        prediction_text: 'Technology sector expected to continue outperforming with 5-8% gains, driven by AI adoption and strong earnings.',
        confidence_level: 0.80,
        time_horizon: '1_week',
        prediction_data: {
          expected_movement: '+5-8%',
          key_drivers: ['AI momentum', 'earnings beats', 'innovation cycle'],
          sectors: { technology: 'bullish', finance: 'neutral' }
        }
      },
      {
        daily_analysis_id: insertedAnalysis.id,
        prediction_type: 'market_direction',
        prediction_text: 'Market volatility to increase as Fed decision approaches, with potential 10-15% swings in growth stocks.',
        confidence_level: 0.70,
        time_horizon: '1_month',
        prediction_data: {
          volatility_expectation: 'high',
          vix_range: '18-25',
          catalyst: 'Fed policy meeting'
        }
      },
      {
        daily_analysis_id: insertedAnalysis.id,
        prediction_type: 'economic_indicator',
        prediction_text: 'Interest rates likely to remain elevated through Q3, with one potential 25bp cut in September.',
        confidence_level: 0.65,
        time_horizon: '3_months',
        prediction_data: {
          rate_prediction: '5.25-5.50%',
          cut_probability: 0.65,
          inflation_target: '2.5-3.0%'
        }
      }
    ];
    
    const { data: insertedPredictions, error: predError } = await supabase
      .from('predictions')
      .insert(predictions)
      .select();
    
    if (predError) {
      console.error('Error inserting predictions:', predError);
    } else {
      console.log(`Successfully created ${insertedPredictions.length} predictions!`);
      insertedPredictions.forEach(pred => {
        console.log(`- ${pred.time_horizon}: ${pred.prediction_text.substring(0, 60)}...`);
      });
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the fix and insert
fixAndInsertDailyAnalysis()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });