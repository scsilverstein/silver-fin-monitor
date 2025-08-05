#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createDailyAnalysis() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`Creating daily analysis for ${today}...`);

    // Check if analysis already exists
    const { data: existing, error: checkError } = await supabase
      .from('daily_analysis')
      .select('*')
      .eq('analysis_date', today)
      .single();

    if (existing) {
      console.log('Daily analysis already exists for today');
      return existing;
    }

    // Create new daily analysis
    const { data, error } = await supabase
      .from('daily_analysis')
      .insert({
        analysis_date: today,
        market_sentiment: 'neutral',
        key_themes: ['market_stability', 'economic_outlook', 'tech_sector'],
        overall_summary: 'Initial daily analysis created. This is a placeholder that will be updated by the AI analysis service.',
        ai_analysis: {
          sentiment_score: 0,
          confidence: 0.5,
          sources_analyzed: 0,
          generated_at: new Date().toISOString()
        },
        confidence_score: 0.5,
        sources_analyzed: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating daily analysis:', error);
      throw error;
    }

    console.log('Daily analysis created successfully:', data);
    
    // Also create some initial predictions for this analysis
    const predictions = [
      {
        daily_analysis_id: data.id,
        prediction_type: 'market_direction',
        prediction_text: 'Market expected to remain stable with minor fluctuations',
        confidence_level: 0.5,
        time_horizon: '1_week',
        prediction_data: { direction: 'neutral', volatility: 'low' }
      },
      {
        daily_analysis_id: data.id,
        prediction_type: 'economic_indicator',
        prediction_text: 'Economic indicators suggest continued moderate growth',
        confidence_level: 0.5,
        time_horizon: '1_month',
        prediction_data: { growth_rate: 'moderate', inflation: 'stable' }
      }
    ];

    const { data: predictionData, error: predError } = await supabase
      .from('predictions')
      .insert(predictions)
      .select();

    if (predError) {
      console.error('Error creating predictions:', predError);
    } else {
      console.log(`Created ${predictionData.length} predictions`);
    }

    return data;
  } catch (error) {
    console.error('Failed to create daily analysis:', error);
    throw error;
  }
}

// Run the script
createDailyAnalysis()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });