#!/usr/bin/env -S npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { format, subDays } from 'date-fns';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateDailyAnalysisForDate(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  console.log(`\nGenerating analysis for ${dateStr}...`);

  try {
    // Check if analysis already exists
    const { data: existingAnalysis } = await supabase
      .from('daily_analysis')
      .select('id')
      .eq('analysis_date', dateStr)
      .single();

    if (existingAnalysis) {
      console.log(`Analysis already exists for ${dateStr}, skipping...`);
      return;
    }

    // Fetch processed content for this date
    const { data: content, error } = await supabase
      .from('processed_content')
      .select(`
        id,
        summary,
        key_topics,
        sentiment_score,
        entities,
        raw_feed_id,
        raw_feeds!inner(
          title,
          published_at,
          source_id,
          feed_sources!inner(
            name,
            type
          )
        )
      `)
      .gte('raw_feeds.published_at', `${dateStr}T00:00:00`)
      .lt('raw_feeds.published_at', `${dateStr}T23:59:59`);

    if (error) {
      console.error(`Error fetching content for ${dateStr}:`, error);
      return;
    }

    if (!content || content.length === 0) {
      console.log(`No content found for ${dateStr}, skipping...`);
      return;
    }

    console.log(`Found ${content.length} content items for ${dateStr}`);

    // Prepare content for AI analysis
    const contentSummary = content.map(item => ({
      title: item.raw_feeds?.title,
      source: item.raw_feeds?.feed_sources?.name,
      summary: item.summary,
      sentiment: item.sentiment_score,
      topics: item.key_topics,
      entities: item.entities
    }));

    // Generate AI analysis
    const prompt = `You are a world-class market analyst synthesizing information from multiple sources.

Today's date: ${dateStr}

Source content:
${JSON.stringify(contentSummary, null, 2)}

Please analyze the current market and world state based on this information and provide:

1. **Overall Market Sentiment**: Bullish/Bearish/Neutral with confidence level
2. **Key Themes**: Top 5 themes emerging from the content
3. **Market Drivers**: Primary factors affecting markets
4. **Geopolitical Context**: Key geopolitical developments
5. **Economic Indicators**: Relevant economic signals
6. **Risk Factors**: Potential risks to monitor

Format your response as JSON with the following structure:
{
  "market_sentiment": "bullish|bearish|neutral",
  "confidence_score": 0.85,
  "key_themes": ["theme1", "theme2", ...],
  "market_drivers": ["driver1", "driver2", ...],
  "geopolitical_context": "summary",
  "economic_indicators": ["indicator1", "indicator2", ...],
  "risk_factors": ["risk1", "risk2", ...],
  "overall_summary": "comprehensive summary"
}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial market analyst. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const aiAnalysis = JSON.parse(completion.choices[0].message.content || '{}');

    // Store the analysis
    const { error: insertError } = await supabase
      .from('daily_analysis')
      .insert({
        analysis_date: dateStr,
        market_sentiment: aiAnalysis.market_sentiment,
        key_themes: aiAnalysis.key_themes || [],
        overall_summary: aiAnalysis.overall_summary,
        ai_analysis: aiAnalysis,
        confidence_score: aiAnalysis.confidence_score || 0.7,
        sources_analyzed: content.length,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error(`Error inserting analysis for ${dateStr}:`, insertError);
      return;
    }

    console.log(`✅ Successfully generated analysis for ${dateStr}`);
    
    // Generate predictions for this analysis
    await generatePredictionsForDate(dateStr, aiAnalysis);
    
  } catch (error) {
    console.error(`Failed to generate analysis for ${dateStr}:`, error);
  }
}

async function generatePredictionsForDate(dateStr: string, analysis: any) {
  console.log(`Generating predictions for ${dateStr}...`);
  
  try {
    // Get the daily analysis ID
    const { data: dailyAnalysis } = await supabase
      .from('daily_analysis')
      .select('id')
      .eq('analysis_date', dateStr)
      .single();

    if (!dailyAnalysis) {
      console.error(`No daily analysis found for ${dateStr}`);
      return;
    }

    const prompt = `Based on the market analysis provided, generate specific predictions for different time horizons.

Market Analysis:
${JSON.stringify(analysis, null, 2)}

Generate predictions for:
1. 1-week outlook
2. 1-month outlook
3. 3-month outlook
4. 6-month outlook
5. 1-year outlook

For each prediction, include:
- Specific prediction statement
- Confidence level (0-1)
- Key assumptions
- Measurable outcomes

Format as JSON array of prediction objects with this structure:
[
  {
    "prediction_type": "market_direction|economic_indicator|geopolitical_event",
    "prediction_text": "specific prediction",
    "confidence_level": 0.75,
    "time_horizon": "1_week|1_month|3_months|6_months|1_year",
    "prediction_data": {
      "assumptions": ["assumption1", "assumption2"],
      "measurable_outcomes": ["outcome1", "outcome2"],
      "key_risks": ["risk1", "risk2"]
    }
  }
]`;

    const completion = await openai.chat.completions.create({
      model: process.env.PREDICTION_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial market analyst making specific, measurable predictions. Always respond with valid JSON array only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' }
    });

    const predictionsResponse = JSON.parse(completion.choices[0].message.content || '{"predictions": []}');
    const predictions = predictionsResponse.predictions || [];

    // Insert predictions
    for (const prediction of predictions) {
      await supabase
        .from('predictions')
        .insert({
          daily_analysis_id: dailyAnalysis.id,
          prediction_type: prediction.prediction_type,
          prediction_text: prediction.prediction_text,
          confidence_level: prediction.confidence_level,
          time_horizon: prediction.time_horizon,
          prediction_data: prediction.prediction_data,
          created_at: new Date().toISOString()
        });
    }

    console.log(`✅ Generated ${predictions.length} predictions for ${dateStr}`);
  } catch (error) {
    console.error(`Failed to generate predictions for ${dateStr}:`, error);
  }
}

async function backfillHistoricalAnalyses() {
  console.log('Starting historical analysis backfill...');
  
  // Get the date range that needs backfilling
  const endDate = new Date();
  const startDate = new Date('2025-07-14'); // Based on your oldest feed data
  
  // Process each date
  let currentDate = startDate;
  while (currentDate <= endDate) {
    await generateDailyAnalysisForDate(currentDate);
    
    // Add delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Move to next date
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log('\n✅ Historical analysis backfill complete!');
}

// Run the backfill
backfillHistoricalAnalyses().catch(console.error);