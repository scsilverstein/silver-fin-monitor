#!/usr/bin/env tsx
/**
 * Populate prediction accuracy data for testing the Enhanced Insights charts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 Populating prediction accuracy data...');

  try {
    // Step 1: Get or create a daily analysis
    let { data: analyses, error: analysisError } = await supabase
      .from('daily_analysis')
      .select('*')
      .order('analysis_date', { ascending: false })
      .limit(1);

    if (analysisError) throw analysisError;

    let analysisId: string;
    if (!analyses || analyses.length === 0) {
      // Create a test daily analysis
      const { data: newAnalysis, error: createError } = await supabase
        .from('daily_analysis')
        .insert({
          analysis_date: new Date().toISOString().split('T')[0],
          market_sentiment: 'bullish',
          key_themes: ['technology', 'artificial_intelligence', 'market_growth'],
          overall_summary: 'Market shows positive sentiment driven by AI developments',
          ai_analysis: {
            market_drivers: ['AI adoption', 'Tech earnings', 'Economic indicators'],
            risk_factors: ['Geopolitical tensions', 'Inflation concerns'],
            confidence_score: 0.85
          },
          confidence_score: 0.85,
          sources_analyzed: 25
        })
        .select()
        .single();

      if (createError) throw createError;
      analysisId = newAnalysis.id;
      console.log('✅ Created test daily analysis');
    } else {
      analysisId = analyses[0].id;
      console.log('✅ Using existing daily analysis');
    }

    // Step 2: Create diverse predictions with different types and horizons
    const predictionData = [
      // Market Direction Predictions
      {
        daily_analysis_id: analysisId,
        prediction_type: 'market_direction',
        prediction_text: 'S&P 500 will continue upward trend driven by tech sector strength',
        confidence_level: 0.85,
        time_horizon: '1_week',
        prediction_data: {
          market_target: 'SPY +3-5%',
          key_drivers: ['AI adoption', 'Earnings momentum'],
          risk_factors: ['Geopolitical tensions']
        }
      },
      {
        daily_analysis_id: analysisId,
        prediction_type: 'market_direction',
        prediction_text: 'Technology sector rotation expected as valuations normalize',
        confidence_level: 0.72,
        time_horizon: '1_month',
        prediction_data: {
          sector_rotation: 'Tech to Value',
          expected_timeline: '2-4 weeks'
        }
      },
      {
        daily_analysis_id: analysisId,
        prediction_type: 'market_direction',
        prediction_text: 'Broader market consolidation likely as Fed policy uncertainty increases',
        confidence_level: 0.65,
        time_horizon: '3_months',
        prediction_data: {
          consolidation_range: '10-15%',
          key_catalyst: 'Fed policy clarity'
        }
      },

      // Economic Indicator Predictions  
      {
        daily_analysis_id: analysisId,
        prediction_type: 'economic_indicator',
        prediction_text: 'Inflation data will show continued moderation supporting Fed pause',
        confidence_level: 0.78,
        time_horizon: '1_month',
        prediction_data: {
          cpi_target: '2.8-3.2%',
          fed_impact: 'Dovish pivot likely'
        }
      },
      {
        daily_analysis_id: analysisId,
        prediction_type: 'economic_indicator',
        prediction_text: 'Labor market strength will persist with unemployment remaining stable',
        confidence_level: 0.82,
        time_horizon: '6_months',
        prediction_data: {
          unemployment_range: '3.5-4.0%',
          wage_growth: 'Moderate increases'
        }
      },

      // Geopolitical Event Predictions
      {
        daily_analysis_id: analysisId,
        prediction_type: 'geopolitical_event',
        prediction_text: 'US-China trade relations will see gradual improvement benefiting tech sector',
        confidence_level: 0.58,
        time_horizon: '6_months',
        prediction_data: {
          trade_impact: 'Positive for semiconductors',
          timeline: 'Q2-Q3 2025'
        }
      },
      {
        daily_analysis_id: analysisId,
        prediction_type: 'geopolitical_event',
        prediction_text: 'Energy markets will remain volatile due to ongoing regional tensions',
        confidence_level: 0.75,
        time_horizon: '3_months',
        prediction_data: {
          oil_range: '$70-90/barrel',
          volatility: 'Above average'
        }
      },

      // Sector-Specific Predictions
      {
        daily_analysis_id: analysisId,
        prediction_type: 'sector_performance',
        prediction_text: 'AI-focused companies will outperform broader tech by 15-20%',
        confidence_level: 0.89,
        time_horizon: '1_year',
        prediction_data: {
          outperformance: '15-20%',
          key_beneficiaries: ['NVDA', 'MSFT', 'GOOGL']
        }
      },
      {
        daily_analysis_id: analysisId,
        prediction_type: 'sector_performance',
        prediction_text: 'Healthcare sector poised for recovery as regulatory overhang clears',
        confidence_level: 0.68,
        time_horizon: '6_months',
        prediction_data: {
          sector_rotation: 'Defensive to growth',
          key_catalysts: ['Drug approvals', 'Policy clarity']
        }
      },

      // Cryptocurrency Predictions
      {
        daily_analysis_id: analysisId,
        prediction_type: 'cryptocurrency',
        prediction_text: 'Bitcoin will test new highs driven by institutional adoption',
        confidence_level: 0.71,
        time_horizon: '3_months',
        prediction_data: {
          price_target: '$75,000-85,000',
          key_driver: 'ETF inflows'
        }
      }
    ];

    // Insert predictions
    const { data: insertedPredictions, error: predictionError } = await supabase
      .from('predictions')
      .insert(predictionData)
      .select();

    if (predictionError) throw predictionError;
    console.log(`✅ Created ${insertedPredictions.length} test predictions`);

    // Step 3: Create prediction accuracy data
    const accuracyData = [];
    const predictionTypes = ['market_direction', 'economic_indicator', 'geopolitical_event', 'sector_performance', 'cryptocurrency'];
    const timeHorizons = ['1_week', '1_month', '3_months', '6_months', '1_year'];

    // Generate realistic accuracy scores for different types and horizons
    const baseAccuracies = {
      'market_direction': { '1_week': 0.75, '1_month': 0.68, '3_months': 0.62, '6_months': 0.55, '1_year': 0.48 },
      'economic_indicator': { '1_week': 0.82, '1_month': 0.78, '3_months': 0.71, '6_months': 0.65, '1_year': 0.58 },
      'geopolitical_event': { '1_week': 0.45, '1_month': 0.52, '3_months': 0.48, '6_months': 0.42, '1_year': 0.38 },
      'sector_performance': { '1_week': 0.73, '1_month': 0.69, '3_months': 0.64, '6_months': 0.59, '1_year': 0.52 },
      'cryptocurrency': { '1_week': 0.41, '1_month': 0.38, '3_months': 0.35, '6_months': 0.32, '1_year': 0.28 }
    };

    for (const prediction of insertedPredictions) {
      const baseAccuracy = baseAccuracies[prediction.prediction_type]?.[prediction.time_horizon] || 0.5;
      
      // Add some randomness while keeping it realistic
      const variance = 0.15;
      const accuracy = Math.max(0.1, Math.min(0.95, 
        baseAccuracy + (Math.random() - 0.5) * variance
      ));

      const accuracyEntry = {
        prediction_id: prediction.id,
        evaluation_date: new Date().toISOString().split('T')[0],
        accuracy_type: 'comprehensive',
        accuracy_score: accuracy,
        actual_outcome: `Evaluated against market performance and actual events`,
        prediction_text: prediction.prediction_text,
        error_analysis: {
          factors_correct: accuracy > 0.6 ? ['Market direction', 'Timing accuracy'] : ['Partial timing'],
          factors_incorrect: accuracy < 0.6 ? ['Market volatility', 'External events'] : [],
          confidence_calibration: Math.abs(prediction.confidence_level - accuracy) < 0.2 ? 'well_calibrated' : 'needs_adjustment'
        },
        contributing_factors: [
          { factor: 'Market conditions', weight: 0.4, accuracy: accuracy + (Math.random() - 0.5) * 0.1 },
          { factor: 'External events', weight: 0.3, accuracy: accuracy + (Math.random() - 0.5) * 0.15 },
          { factor: 'Model performance', weight: 0.3, accuracy: accuracy + (Math.random() - 0.5) * 0.1 }
        ],
        lessons_learned: [
          accuracy > 0.7 ? 'Strong signal identification' : 'Need better risk assessment',
          accuracy > 0.6 ? 'Good timing accuracy' : 'Improve timing models',
          'Continue monitoring external factors'
        ]
      };

      accuracyData.push(accuracyEntry);
    }

    // Insert accuracy data
    const { error: accuracyError } = await supabase
      .from('prediction_accuracy')
      .insert(accuracyData);

    if (accuracyError) throw accuracyError;
    console.log(`✅ Created ${accuracyData.length} prediction accuracy records`);

    // Step 4: Calculate and display summary statistics
    const overallAccuracy = accuracyData.reduce((sum, item) => sum + item.accuracy_score, 0) / accuracyData.length;
    
    const byType = predictionTypes.reduce((acc, type) => {
      const typeAccuracies = accuracyData.filter(item => 
        insertedPredictions.find(p => p.id === item.prediction_id)?.prediction_type === type
      );
      
      if (typeAccuracies.length > 0) {
        acc[type] = typeAccuracies.reduce((sum, item) => sum + item.accuracy_score, 0) / typeAccuracies.length;
      }
      
      return acc;
    }, {} as Record<string, number>);

    const byHorizon = timeHorizons.reduce((acc, horizon) => {
      const horizonAccuracies = accuracyData.filter(item => 
        insertedPredictions.find(p => p.id === item.prediction_id)?.time_horizon === horizon
      );
      
      if (horizonAccuracies.length > 0) {
        acc[horizon] = horizonAccuracies.reduce((sum, item) => sum + item.accuracy_score, 0) / horizonAccuracies.length;
      }
      
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📊 Prediction Accuracy Summary:');
    console.log(`Overall Accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);
    console.log('\nBy Type:');
    Object.entries(byType).forEach(([type, accuracy]) => {
      console.log(`  ${type}: ${(accuracy * 100).toFixed(1)}%`);
    });
    console.log('\nBy Time Horizon:');
    Object.entries(byHorizon).forEach(([horizon, accuracy]) => {
      console.log(`  ${horizon}: ${(accuracy * 100).toFixed(1)}%`);
    });

    console.log('\n🎉 Successfully populated prediction accuracy data!');
    console.log('The Enhanced Insights charts should now display data.');

  } catch (error) {
    console.error('❌ Error populating prediction accuracy data:', error);
    process.exit(1);
  }
}

// Run main function
main();