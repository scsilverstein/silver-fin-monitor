// Debug prediction generation with actual service logic
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function debugPredictionGeneration() {
  try {
    console.log('Debugging prediction generation...');
    
    // Get the analysis
    const { data: analysis, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .eq('analysis_date', '2025-07-22')
      .single();

    if (error || !analysis) {
      console.error('❌ Analysis not found:', error);
      return;
    }

    console.log('✅ Found analysis:', analysis.id);

    // Test a single prediction generation (matching the service logic)
    const horizon = '1_week';
    const type = 'market_direction';
    const horizonText = horizon.replace('_', ' ');

    console.log(`Testing prediction: ${type} for ${horizonText}...`);

    try {
      const completion = await openai.chat.completions.create({
        model: 'o4-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional financial analyst. Generate a ${horizonText} ${type} prediction.

Format as JSON:
{
  "prediction": "Brief prediction text",
  "confidence": 0.75,
  "price_targets": {"primary": "Target level"},
  "financial_metrics": {"expected_return": "Return expectation"},
  "probability_scenarios": {"bullish": {"probability": 0.4, "outcome": "Outcome"}},
  "investment_strategy": {"recommended_allocation": "Allocation"},
  "key_catalysts": ["Catalyst 1"],
  "warning_signs": ["Warning 1"],
  "metrics_to_monitor": ["Metric 1"],
  "reasoning": "Brief reasoning",
  "risk_assessment": "Risk analysis",
  "time_sensitivity": "Timeline",
  "alternative_scenarios": "Alternative view"
}`
          },
          {
            role: 'user',
            content: JSON.stringify({
              analysis_date: analysis.analysis_date,
              market_sentiment: analysis.market_sentiment,
              confidence_score: analysis.confidence_score,
              key_themes: analysis.key_themes,
              summary: analysis.overall_summary
            })
          }
        ],
        response_format: { type: 'json_object' }
      });

      const messageContent = completion.choices[0]?.message.content;
      console.log('✅ OpenAI response received, length:', messageContent?.length || 0);
      
      const response = JSON.parse(messageContent);
      console.log('✅ JSON parsed successfully');
      console.log('Prediction confidence:', response.confidence);
      console.log('Prediction preview:', response.prediction?.substring(0, 100) + '...');

      // Test database insertion
      const predictionData = {
        daily_analysis_id: analysis.id,
        prediction_type: type,
        prediction_text: response.prediction,
        confidence_level: response.confidence,
        time_horizon: horizon,
        prediction_data: {
          price_targets: response.price_targets || {},
          financial_metrics: response.financial_metrics || {},
          probability_scenarios: response.probability_scenarios || {},
          investment_strategy: response.investment_strategy || {},
          key_catalysts: response.key_catalysts || [],
          warning_signs: response.warning_signs || [],
          metrics_to_monitor: response.metrics_to_monitor || [],
          reasoning: response.reasoning || '',
          risk_assessment: response.risk_assessment || '',
          time_sensitivity: response.time_sensitivity || '',
          alternative_scenarios: response.alternative_scenarios || '',
          prediction_type: type,
          time_horizon: horizon,
          generated_at: new Date().toISOString()
        }
      };

      console.log('Attempting database insert...');
      const { data: insertResult, error: insertError } = await supabase
        .from('predictions')
        .insert(predictionData)
        .select();

      if (insertError) {
        console.error('❌ Database insert failed:', insertError);
        return;
      }

      console.log('✅ Prediction saved successfully:', insertResult[0].id);

    } catch (aiError) {
      console.error('❌ AI prediction failed:', aiError.message);
      console.error('Error details:', aiError);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugPredictionGeneration();