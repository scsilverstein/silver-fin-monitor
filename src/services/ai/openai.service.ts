import OpenAI from 'openai';
import { DatabaseService } from '../database/db.service';
import { CacheService } from '../cache/cache.service';
import winston from 'winston';
import config from '../../config';

// Import types from the main types file
import { DailyAnalysis as CoreDailyAnalysis, Prediction as CorePrediction, ProcessedContent as CoreProcessedContent } from '../../types';

// Create type aliases for snake_case field mapping
type DailyAnalysis = CoreDailyAnalysis & {
  analysis_date?: Date;
  market_sentiment?: 'bullish' | 'bearish' | 'neutral' | 'cautiously_optimistic' | 'cautiously_pessimistic';
  key_themes?: string[];
  overall_summary?: string;
  ai_analysis?: {
    key_drivers: string[];
    risk_factors: string[];
    opportunities: string[];
    outlook: string;
    [key: string]: any;
  };
  confidence_score?: number;
  sources_analyzed?: number;
};

type Prediction = CorePrediction & {
  daily_analysis_id?: string;
  prediction_type?: 'market_direction' | 'sector_performance' | 'economic_indicator' | 'geopolitical_event';
  prediction_text?: string;
  confidence_level?: number;
  time_horizon?: '1_week' | '2_weeks' | '1_month' | '3_months' | '6_months' | '1_year';
  prediction_data?: Record<string, any>;
};

type ProcessedContent = CoreProcessedContent & {
  processed_text?: string;
  key_topics?: string[];
  sentiment_score?: number;
  summary?: string;
};

export class OpenAIService {
  private openai: OpenAI;
  private fallbackModels = ['gpt-4', 'gpt-3.5-turbo'];
  
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
    private logger: winston.Logger
  ) {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  // Generate daily market analysis
  async generateDailyAnalysis(date: Date): Promise<DailyAnalysis> {
    try {
      this.logger.info(`Generating daily analysis for ${date.toISOString()}`);
      
      // Check cache first
      const cacheKey = `daily_analysis:${date.toISOString().split('T')[0]}`;
      const cached = await this.cache.get<DailyAnalysis>(cacheKey);
      if (cached) {
        this.logger.info('Using cached daily analysis');
        return cached;
      }
      
      // Fetch processed content for the day
      const content = await this.fetchDailyContent(date);
      if (content.length === 0) {
        throw new Error('No content available for analysis');
      }
      
      this.logger.info(`Analyzing ${content.length} content items`);
      
      // Prepare content for analysis
      const analysisPrompt = this.buildAnalysisPrompt(content, date);
      
      // Call OpenAI with retry logic
      const response = await this.callOpenAIWithFallback(analysisPrompt, 'analysis');
      
      // Parse response
      const analysis = this.parseAnalysisResponse(response);
      
      // Save to database
      const savedAnalysis = await this.saveDailyAnalysis({
        ...analysis,
        analysis_date: date,
        sources_analyzed: content.length
      });
      
      // Cache the result
      await this.cache.set(cacheKey, savedAnalysis, { ttl: 86400 }); // 24 hours
      
      return savedAnalysis;
    } catch (error) {
      this.logger.error('Failed to generate daily analysis:', error);
      throw error;
    }
  }

  // Generate predictions based on analysis
  async generatePredictions(analysis: DailyAnalysis): Promise<Prediction[]> {
    try {
      this.logger.info(`Generating predictions for analysis ${analysis.id}`);
      
      const predictionPrompt = this.buildPredictionPrompt(analysis);
      const response = await this.callOpenAIWithFallback(predictionPrompt, 'predictions');
      
      const predictions = this.parsePredictionResponse(response, analysis.id);
      
      // Save predictions
      const savedPredictions = await this.savePredictions(predictions);
      
      return savedPredictions;
    } catch (error) {
      this.logger.error('Failed to generate predictions:', error);
      throw error;
    }
  }

  // Compare predictions with actual outcomes
  async comparePredictions(predictionId: string, currentAnalysis: DailyAnalysis): Promise<any> {
    try {
      // Fetch the prediction
      const prediction = await this.db.tables.predictions.findOne({ id: predictionId });
      if (!prediction) {
        throw new Error('Prediction not found');
      }
      
      const comparisonPrompt = this.buildComparisonPrompt(prediction, currentAnalysis);
      const response = await this.callOpenAIWithFallback(comparisonPrompt, 'comparison');
      
      const comparison = this.parseComparisonResponse(response);
      
      // Save comparison
      await this.db.tables.predictions.create({
        prediction_id: predictionId,
        comparison_date: new Date(),
        actual_outcome: comparison.actual_outcome,
        accuracy_score: comparison.accuracy_score,
        analysis: comparison.analysis
      });
      
      return comparison;
    } catch (error) {
      this.logger.error('Failed to compare predictions:', error);
      throw error;
    }
  }

  // Enhanced content processing with AI
  async enhanceContent(content: string): Promise<{
    summary: string;
    key_topics: string[];
    sentiment: number;
    entities: Record<string, any>;
  }> {
    try {
      const enhancementPrompt = `
Analyze the following financial content and provide:
1. A concise summary (max 200 words)
2. Key topics (5-10 most important)
3. Sentiment score (-1 to 1)
4. Extracted entities (companies, people, tickers)

Content:
${content.substring(0, 2000)}

Respond in JSON format.
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: enhancementPrompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        summary: result.summary || '',
        key_topics: result.key_topics || [],
        sentiment: result.sentiment || 0,
        entities: result.entities || {}
      };
    } catch (error) {
      this.logger.error('Content enhancement failed:', error);
      // Return basic results on failure
      return {
        summary: content.substring(0, 200) + '...',
        key_topics: [],
        sentiment: 0,
        entities: {}
      };
    }
  }

  // Private helper methods
  private async fetchDailyContent(date: Date): Promise<ProcessedContent[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const content = await this.db.query<ProcessedContent>(
      `SELECT pc.* 
       FROM processed_content pc
       JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
       WHERE rf.published_at >= $1 AND rf.published_at <= $2
       ORDER BY rf.published_at DESC`,
      [startOfDay, endOfDay]
    );
    
    return content;
  }

  private buildAnalysisPrompt(content: ProcessedContent[], date: Date): string {
    const contentSummaries = content
      .map(c => `- ${c.summary} (Sentiment: ${c.sentiment_score})`)
      .join('\n');
    
    return `
You are a world-class market analyst synthesizing information from multiple sources.

Today's date: ${date.toISOString().split('T')[0]}

Source content summaries:
${contentSummaries}

Please analyze the current market and world state based on this information and provide:

1. **Overall Market Sentiment**: Bullish/Bearish/Neutral/Cautiously Optimistic/Cautiously Pessimistic
2. **Key Themes**: Top 5 themes emerging from the content
3. **Market Drivers**: Primary factors affecting markets
4. **Risk Factors**: Potential risks to monitor
5. **Opportunities**: Investment opportunities identified
6. **Outlook**: Brief outlook statement
7. **Confidence Score**: Your confidence in this analysis (0-1)

Format your response as JSON with the following structure:
{
  "market_sentiment": "bullish|bearish|neutral|cautiously_optimistic|cautiously_pessimistic",
  "confidence_score": 0.85,
  "key_themes": ["theme1", "theme2", ...],
  "ai_analysis": {
    "key_drivers": ["driver1", "driver2", ...],
    "risk_factors": ["risk1", "risk2", ...],
    "opportunities": ["opportunity1", "opportunity2", ...],
    "outlook": "outlook statement"
  },
  "overall_summary": "comprehensive summary paragraph"
}
`;
  }

  private buildPredictionPrompt(analysis: DailyAnalysis): string {
    return `
Based on the following market analysis, generate specific predictions for different time horizons.

Market Analysis:
- Sentiment: ${analysis.market_sentiment}
- Key Themes: ${analysis.key_themes.join(', ')}
- Drivers: ${analysis.ai_analysis.key_drivers.join(', ')}
- Risks: ${analysis.ai_analysis.risk_factors.join(', ')}
- Outlook: ${analysis.ai_analysis.outlook}

Generate predictions for:
1. 1-week outlook
2. 1-month outlook
3. 3-month outlook
6. 6-month outlook
7. 1-year outlook

For each prediction, include:
- Specific prediction statement
- Confidence level (0-1)
- Type (market_direction, sector_performance, economic_indicator, geopolitical_event)
- Key data points

Format as JSON array of prediction objects:
[
  {
    "time_horizon": "1_week",
    "prediction_type": "market_direction",
    "prediction_text": "specific prediction",
    "confidence_level": 0.75,
    "prediction_data": {
      "target_level": 2150,
      "probability": 0.75,
      "key_factors": ["factor1", "factor2"]
    }
  }
]
`;
  }

  private buildComparisonPrompt(prediction: any, currentAnalysis: DailyAnalysis): string {
    return `
Compare the following prediction with current market state and evaluate accuracy.

Previous Prediction:
- Text: ${prediction.prediction_text}
- Type: ${prediction.prediction_type}
- Time Horizon: ${prediction.time_horizon}
- Made on: ${prediction.created_at}
- Confidence: ${prediction.confidence_level}

Current Market State:
- Sentiment: ${currentAnalysis.market_sentiment}
- Key Themes: ${currentAnalysis.key_themes.join(', ')}
- Summary: ${currentAnalysis.overall_summary}

Provide:
1. Actual outcome description
2. Accuracy score (0-1)
3. What was correct/incorrect
4. Key factors that influenced the outcome
5. Lessons learned

Format as JSON object.
`;
  }

  private async callOpenAIWithFallback(prompt: string, type: string): Promise<string> {
    let lastError: any;
    
    for (const model of this.fallbackModels) {
      try {
        this.logger.info(`Calling OpenAI ${model} for ${type}`);
        
        const response = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a financial market analyst providing data-driven insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        });
        
        return response.choices[0].message.content || '{}';
      } catch (error) {
        lastError = error;
        this.logger.error(`OpenAI ${model} failed:`, error);
        
        if (model !== this.fallbackModels[this.fallbackModels.length - 1]) {
          this.logger.info(`Falling back to next model...`);
        }
      }
    }
    
    throw lastError;
  }

  private parseAnalysisResponse(response: string): Partial<DailyAnalysis> {
    try {
      const parsed = JSON.parse(response);
      return {
        market_sentiment: parsed.market_sentiment || 'neutral',
        key_themes: parsed.key_themes || [],
        overall_summary: parsed.overall_summary || '',
        ai_analysis: parsed.ai_analysis || {},
        confidence_score: parsed.confidence_score || 0.5
      };
    } catch (error) {
      this.logger.error('Failed to parse analysis response:', error);
      throw new Error('Invalid AI response format');
    }
  }

  private parsePredictionResponse(response: string, analysisId: string): Partial<Prediction>[] {
    try {
      const parsed = JSON.parse(response);
      if (!Array.isArray(parsed)) {
        throw new Error('Expected array of predictions');
      }
      
      return parsed.map(p => ({
        daily_analysis_id: analysisId,
        prediction_type: p.prediction_type,
        prediction_text: p.prediction_text,
        confidence_level: p.confidence_level,
        time_horizon: p.time_horizon,
        prediction_data: p.prediction_data || {}
      }));
    } catch (error) {
      this.logger.error('Failed to parse prediction response:', error);
      throw new Error('Invalid prediction response format');
    }
  }

  private parseComparisonResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      this.logger.error('Failed to parse comparison response:', error);
      throw new Error('Invalid comparison response format');
    }
  }

  private async saveDailyAnalysis(analysis: Partial<DailyAnalysis>): Promise<DailyAnalysis> {
    const saved = await this.db.tables.dailyAnalysis.create(analysis);
    return saved as DailyAnalysis;
  }

  private async savePredictions(predictions: Partial<Prediction>[]): Promise<Prediction[]> {
    const saved = await this.db.tables.predictions.createMany(predictions);
    return saved as Prediction[];
  }
}

export default OpenAIService;