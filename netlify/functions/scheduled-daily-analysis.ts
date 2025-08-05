import { Handler, schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

class DailyAnalysisGenerator {
  
  async generateDailyAnalysis(date: string, force: boolean = false): Promise<void> {
    try {
      console.log(`🧠 Generating daily analysis for ${date}`);
      
      // Check if analysis already exists
      if (!force) {
        const { data: existing } = await supabase
          .from('daily_analysis')
          .select('id')
          .eq('analysis_date', date)
          .single();
          
        if (existing) {
          console.log(`✅ Daily analysis for ${date} already exists`);
          return;
        }
      }
      
      // Get processed content from the last 24 hours
      const { data: processedContent } = await supabase
        .from('processed_content')
        .select(`
          *,
          raw_feeds!inner(
            title,
            published_at,
            feed_sources!inner(name, type)
          )
        `)
        .gte('raw_feeds.published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!processedContent || processedContent.length === 0) {
        console.log('❌ No processed content found for analysis');
        return;
      }
      
      console.log(`📊 Analyzing ${processedContent.length} content items`);
      
      // Generate analysis using OpenAI (simplified for this implementation)
      const analysis = await this.generateAnalysisWithAI(processedContent);
      
      // Store the analysis
      const { error } = await supabase
        .from('daily_analysis')
        .upsert({
          analysis_date: date,
          market_sentiment: analysis.market_sentiment,
          key_themes: analysis.key_themes,
          overall_summary: analysis.overall_summary,
          ai_analysis: analysis.ai_analysis,
          confidence_score: analysis.confidence_score,
          sources_analyzed: processedContent.length,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'analysis_date',
          ignoreDuplicates: false
        });
      
      if (error) {
        throw new Error(`Failed to store analysis: ${error.message}`);
      }
      
      console.log(`✅ Daily analysis generated and stored for ${date}`);
      
      // Generate predictions based on this analysis
      await this.generatePredictions(date);
      
    } catch (error) {
      console.error(`❌ Error generating daily analysis:`, error);
      throw error;
    }
  }
  
  private async generateAnalysisWithAI(content: any[]): Promise<any> {
    try {
      // Prepare content for AI analysis
      const contentSummary = content.map(item => ({
        title: item.raw_feeds?.title || 'Unknown',
        summary: item.summary || item.processed_text?.substring(0, 200),
        sentiment: item.sentiment_score,
        topics: item.key_topics,
        source: item.raw_feeds?.feed_sources?.name
      }));
      
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        console.warn('OpenAI API key not configured, using mock analysis');
        return this.generateMockAnalysis(content);
      }
      
      const prompt = `
You are a world-class market analyst. Analyze the following market-related content and provide a comprehensive daily market analysis.

Content to analyze:
${JSON.stringify(contentSummary, null, 2)}

Please provide your analysis in the following JSON format:
{
  "market_sentiment": "bullish|bearish|neutral",
  "confidence_score": 0.85, 
  "key_themes": ["theme1", "theme2", "theme3"],
  "overall_summary": "Comprehensive summary of market conditions",
  "ai_analysis": {
    "market_drivers": ["driver1", "driver2"],
    "risk_factors": ["risk1", "risk2"],
    "opportunities": ["opportunity1", "opportunity2"],
    "geopolitical_context": "Key geopolitical developments",
    "economic_indicators": "Relevant economic signals"
  }
}
      `;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert financial analyst providing daily market analysis based on multiple information sources.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        })
      });
      
      if (!response.ok) {
        console.warn('OpenAI API call failed, using mock analysis');
        return this.generateMockAnalysis(content);
      }
      
      const result = await response.json();
      const analysisText = result.choices?.[0]?.message?.content;
      
      if (!analysisText) {
        return this.generateMockAnalysis(content);
      }
      
      // Parse the JSON response
      try {
        const analysis = JSON.parse(analysisText);
        return analysis;
      } catch (parseError) {
        console.warn('Failed to parse AI response, using mock analysis');
        return this.generateMockAnalysis(content);
      }
      
    } catch (error) {
      console.warn('AI analysis failed, using mock analysis:', error);
      return this.generateMockAnalysis(content);
    }
  }
  
  private generateMockAnalysis(content: any[]): any {
    // Calculate aggregate sentiment
    const sentiments = content
      .map(item => item.sentiment_score)
      .filter(score => score !== null && score !== undefined);
    
    const avgSentiment = sentiments.length > 0 
      ? sentiments.reduce((sum, score) => sum + score, 0) / sentiments.length 
      : 0;
    
    let market_sentiment = 'neutral';
    if (avgSentiment > 0.1) market_sentiment = 'bullish';
    else if (avgSentiment < -0.1) market_sentiment = 'bearish';
    
    // Extract common themes
    const allTopics = content.flatMap(item => item.key_topics || []);
    const topicCounts = allTopics.reduce((acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const key_themes = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);
    
    return {
      market_sentiment,
      confidence_score: 0.75,
      key_themes,
      overall_summary: `Market analysis based on ${content.length} sources shows ${market_sentiment} sentiment. Key themes include ${key_themes.slice(0, 3).join(', ')}.`,
      ai_analysis: {
        market_drivers: ['Economic data', 'Corporate earnings', 'Geopolitical events'],
        risk_factors: ['Market volatility', 'Inflation concerns'],
        opportunities: ['Technology sector growth', 'Infrastructure investments'],
        geopolitical_context: 'Monitoring global trade and policy developments',
        economic_indicators: 'Mixed signals from recent economic data'
      }
    };
  }
  
  private async generatePredictions(analysisDate: string): Promise<void> {
    try {
      console.log(`🔮 Generating predictions for ${analysisDate}`);
      
      // Get the analysis we just created
      const { data: analysis } = await supabase
        .from('daily_analysis')
        .select('*')
        .eq('analysis_date', analysisDate)
        .single();
        
      if (!analysis) {
        console.warn('No analysis found for prediction generation');
        return;
      }
      
      const predictions = [
        {
          prediction_type: 'market_direction',
          prediction_text: `Based on current ${analysis.market_sentiment} sentiment, expect markets to ${analysis.market_sentiment === 'bullish' ? 'continue upward momentum' : analysis.market_sentiment === 'bearish' ? 'face continued pressure' : 'trade sideways'}`,
          confidence_level: analysis.confidence_score,
          time_horizon: '1_week',
          prediction_data: {
            basis: analysis.key_themes.slice(0, 3),
            market_sentiment: analysis.market_sentiment
          },
          daily_analysis_id: analysis.id,
          created_at: new Date().toISOString()
        },
        {
          prediction_type: 'sector_performance', 
          prediction_text: `Technology and growth sectors likely to ${analysis.market_sentiment === 'bullish' ? 'outperform' : 'underperform'} broader market`,
          confidence_level: analysis.confidence_score * 0.8,
          time_horizon: '1_month',
          prediction_data: {
            sectors: ['technology', 'growth'],
            direction: analysis.market_sentiment
          },
          daily_analysis_id: analysis.id,
          created_at: new Date().toISOString()
        }
      ];
      
      // Store predictions
      for (const prediction of predictions) {
        const { error } = await supabase
          .from('predictions')
          .insert(prediction);
          
        if (error) {
          console.error('Error storing prediction:', error);
        }
      }
      
      console.log(`✅ Generated ${predictions.length} predictions`);
      
    } catch (error) {
      console.error('Error generating predictions:', error);
    }
  }
}

// Netlify Scheduled Function Handler
// This runs daily at 6 AM UTC
export const handler: Handler = schedule('0 6 * * *', async (event) => {
  try {
    console.log('🕕 Running scheduled daily analysis generation');
    
    const generator = new DailyAnalysisGenerator();
    const today = new Date().toISOString().split('T')[0];
    
    await generator.generateDailyAnalysis(today, false);
    
    console.log('✅ Scheduled daily analysis completed');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Daily analysis generation completed',
        date: today,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ Scheduled daily analysis failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
});