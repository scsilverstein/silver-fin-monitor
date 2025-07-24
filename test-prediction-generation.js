// Test prediction generation manually
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const supabaseUrl = 'https://pnjtzwqieqcrchhjouaz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPredictionGeneration() {
  try {
    console.log('Testing prediction generation for analysis 2025-07-22...');
    
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

    console.log('✅ Found analysis:', {
      id: analysis.id,
      sentiment: analysis.market_sentiment,
      themes: analysis.key_themes?.slice(0, 3)
    });

    // Test a simple prediction insert to database
    console.log('\nTesting direct database insert...');
    
    const testPrediction = {
      daily_analysis_id: analysis.id,
      prediction_type: 'test_prediction',
      prediction_text: 'This is a test prediction to verify database connectivity',
      confidence_level: 0.75,
      time_horizon: '1_week',
      prediction_data: {
        test: true,
        generated_at: new Date().toISOString()
      }
    };

    const { data: insertResult, error: insertError } = await supabase
      .from('predictions')
      .insert(testPrediction)
      .select();

    if (insertError) {
      console.error('❌ Failed to insert test prediction:', insertError);
      return;
    }

    console.log('✅ Successfully inserted test prediction:', insertResult[0].id);

    // Now test with OpenAI (if available)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.log('⚠️  No OpenAI key found, skipping AI prediction test');
      return;
    }

    console.log('\nTesting AI prediction generation...');
    
    const openai = new OpenAI({ apiKey: openaiKey });
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'o4-mini',
        messages: [
          {
            role: 'system',
            content: 'Generate a simple financial prediction for testing. Return JSON with "prediction", "confidence" (0-1), and "data" fields.'
          },
          {
            role: 'user',
            content: JSON.stringify({
              analysis_date: analysis.analysis_date,
              market_sentiment: analysis.market_sentiment,
              summary: analysis.overall_summary
            })
          }
        ],
        max_completion_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const response = JSON.parse(completion.choices[0].message.content);
      console.log('✅ AI prediction generated:', {
        confidence: response.confidence,
        preview: response.prediction?.substring(0, 100) + '...'
      });

      // Insert AI-generated prediction
      const aiPrediction = {
        daily_analysis_id: analysis.id,
        prediction_type: 'ai_test_prediction',
        prediction_text: response.prediction,
        confidence_level: response.confidence,
        time_horizon: '1_month',
        prediction_data: response.data || {}
      };

      const { data: aiInsertResult, error: aiInsertError } = await supabase
        .from('predictions')
        .insert(aiPrediction)
        .select();

      if (aiInsertError) {
        console.error('❌ Failed to insert AI prediction:', aiInsertError);
        return;
      }

      console.log('✅ Successfully inserted AI prediction:', aiInsertResult[0].id);

    } catch (aiError) {
      console.error('❌ AI prediction failed:', aiError.message);
    }

    // Check total predictions now
    const { data: allPredictions, error: countError } = await supabase
      .from('predictions')
      .select('id, prediction_type, confidence_level')
      .eq('daily_analysis_id', analysis.id);

    console.log(`\n✅ Total predictions for this analysis: ${allPredictions?.length || 0}`);
    allPredictions?.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.prediction_type} (confidence: ${Math.round(p.confidence_level * 100)}%)`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPredictionGeneration();