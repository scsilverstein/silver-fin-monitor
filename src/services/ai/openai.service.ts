// OpenAI service implementation following CLAUDE.md specification
import OpenAI from 'openai';
import { 
  AIAnalysisService, 
  DailyAnalysis, 
  Prediction, 
  ProcessedContent,
  PredictionComparison,
  Result 
} from '@/types';
import config from '@/config';
import { createContextLogger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const aiLogger = createContextLogger('OpenAI');

interface MarketAnalysisResponse {
  market_sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence_score: number;
  key_themes: string[];
  market_drivers: string[];
  geopolitical_context: string;
  economic_indicators: string[];
  risk_factors: string[];
  overall_summary: string;
}

interface PredictionResponse {
  time_horizon: string;
  prediction_text: string;
  confidence_level: number;
  key_assumptions: string[];
  measurable_outcomes: string[];
}

interface ComparisonResponse {
  accuracy_score: number;
  correct_aspects: string[];
  incorrect_aspects: string[];
  influencing_factors: string[];
  lessons_learned: string[];
}

export class OpenAIService implements AIAnalysisService {
  private openai: OpenAI;
  private primaryModel: string;
  private fallbackModel: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    this.primaryModel = config.openai.model;
    this.fallbackModel = config.openai.fallbackModel;
  }

  async generateDailyAnalysis(content: ProcessedContent[]): Promise<Result<DailyAnalysis>> {
    try {
      aiLogger.info('Generating daily analysis', { 
        contentCount: content.length 
      });

      // Prepare content for analysis
      const processedText = this.prepareContentForAnalysis(content);
      
      // Create analysis prompt
      const prompt = this.createAnalysisPrompt(processedText);

      // Call OpenAI with retry logic
      const response = await this.callOpenAIWithRetry<MarketAnalysisResponse>(
        prompt,
        'analysis'
      );

      // Create daily analysis record
      const analysis: DailyAnalysis = {
        id: uuidv4(),
        analysisDate: new Date(),
        marketSentiment: response.market_sentiment,
        keyThemes: response.key_themes,
        overallSummary: response.overall_summary,
        aiAnalysis: {
          marketDrivers: response.market_drivers,
          geopoliticalContext: response.geopolitical_context,
          economicIndicators: response.economic_indicators,
          riskFactors: response.risk_factors,
          rawResponse: response
        },
        confidenceScore: response.confidence_score,
        sourcesAnalyzed: content.length,
        createdAt: new Date()
      };

      aiLogger.info('Daily analysis generated', { 
        analysisId: analysis.id,
        sentiment: analysis.marketSentiment 
      });

      return { success: true, data: analysis };
    } catch (error) {
      aiLogger.error('Failed to generate daily analysis', error);
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async generatePredictions(analysis: DailyAnalysis): Promise<Result<Prediction[]>> {
    try {
      aiLogger.info('Generating predictions', { 
        analysisId: analysis.id 
      });

      // Create prediction prompt
      const prompt = this.createPredictionPrompt(analysis);

      // Call OpenAI
      const response = await this.callOpenAIWithRetry<PredictionResponse[]>(
        prompt,
        'predictions'
      );

      // Create prediction records
      const predictions: Prediction[] = response.map(pred => ({
        id: uuidv4(),
        dailyAnalysisId: analysis.id,
        predictionType: this.determinePredictionType(pred.prediction_text),
        predictionText: pred.prediction_text,
        confidenceLevel: pred.confidence_level,
        timeHorizon: this.parseTimeHorizon(pred.time_horizon),
        predictionData: {
          keyAssumptions: pred.key_assumptions,
          measurableOutcomes: pred.measurable_outcomes,
          generatedFrom: analysis.analysisDate
        },
        createdAt: new Date()
      }));

      aiLogger.info('Predictions generated', { 
        analysisId: analysis.id,
        count: predictions.length 
      });

      return { success: true, data: predictions };
    } catch (error) {
      aiLogger.error('Failed to generate predictions', error);
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async comparePredictions(
    previousPrediction: Prediction, 
    currentAnalysis: DailyAnalysis
  ): Promise<Result<PredictionComparison>> {
    try {
      aiLogger.info('Comparing prediction with outcome', { 
        predictionId: previousPrediction.id,
        analysisId: currentAnalysis.id 
      });

      // Calculate time elapsed
      const timeElapsed = this.calculateTimeElapsed(
        previousPrediction.createdAt,
        currentAnalysis.analysisDate
      );

      // Create comparison prompt
      const prompt = this.createComparisonPrompt(
        previousPrediction,
        currentAnalysis,
        timeElapsed
      );

      // Call OpenAI
      const response = await this.callOpenAIWithRetry<ComparisonResponse>(
        prompt,
        'comparison'
      );

      // Create comparison record
      const comparison: PredictionComparison = {
        id: uuidv4(),
        comparisonDate: new Date(),
        previousPredictionId: previousPrediction.id,
        currentAnalysisId: currentAnalysis.id,
        accuracyScore: response.accuracy_score,
        outcomeDescription: this.formatOutcomeDescription(response),
        comparisonAnalysis: {
          correctAspects: response.correct_aspects,
          incorrectAspects: response.incorrect_aspects,
          influencingFactors: response.influencing_factors,
          lessonsLearned: response.lessons_learned,
          timeElapsed,
          rawResponse: response
        },
        createdAt: new Date()
      };

      aiLogger.info('Prediction comparison completed', { 
        comparisonId: comparison.id,
        accuracy: comparison.accuracyScore 
      });

      return { success: true, data: comparison };
    } catch (error) {
      aiLogger.error('Failed to compare predictions', error);
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  private prepareContentForAnalysis(content: ProcessedContent[]): string {
    // Group content by source type
    const grouped = content.reduce((acc, item) => {
      const sourceType = item.processingMetadata.sourceType || 'unknown';
      if (!acc[sourceType]) acc[sourceType] = [];
      acc[sourceType].push(item);
      return acc;
    }, {} as Record<string, ProcessedContent[]>);

    // Build structured content summary
    const sections: string[] = [];

    Object.entries(grouped).forEach(([sourceType, items]) => {
      sections.push(`\n=== ${sourceType.toUpperCase()} SOURCES (${items.length} items) ===\n`);
      
      items.slice(0, 100).forEach(item => { // Limit to top 10 per type
        sections.push(`Title: ${(item as any).title || 'N/A'}`);
        sections.push(`Summary: ${item.summary}`);
        sections.push(`Sentiment: ${item.sentimentScore || 'N/A'}`);
        sections.push(`Topics: ${item.keyTopics.join(', ')}`);
        sections.push('---');
      });
    });

    return sections.join('\n');
  }

  private createAnalysisPrompt(content: string): string {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `You are a world-class market analyst synthesizing information from multiple sources.

Today's date: ${currentDate}

Source content:
${content}

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
  }

  private createPredictionPrompt(analysis: DailyAnalysis): string {
    return `Based on the market analysis provided, generate specific predictions for different time horizons.

Market Analysis:
- Sentiment: ${analysis.marketSentiment} (confidence: ${analysis.confidenceScore})
- Key Themes: ${analysis.keyThemes.join(', ')}
- Summary: ${analysis.overallSummary}
- Market Drivers: ${analysis.aiAnalysis.marketDrivers?.join(', ')}
- Risk Factors: ${analysis.aiAnalysis.riskFactors?.join(', ')}

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

Format as JSON array of prediction objects:
[
  {
    "time_horizon": "1 week",
    "prediction_text": "specific prediction",
    "confidence_level": 0.75,
    "key_assumptions": ["assumption1", "assumption2"],
    "measurable_outcomes": ["outcome1", "outcome2"]
  },
  ...
]`;
  }

  private createComparisonPrompt(
    prediction: Prediction,
    analysis: DailyAnalysis,
    timeElapsed: string
  ): string {
    return `Compare the previous prediction with current market state and evaluate accuracy.

Previous Prediction:
- Text: ${prediction.predictionText}
- Confidence: ${prediction.confidenceLevel}
- Time Horizon: ${prediction.timeHorizon}
- Key Assumptions: ${prediction.predictionData.keyAssumptions?.join(', ')}

Current Market State:
- Sentiment: ${analysis.marketSentiment}
- Key Themes: ${analysis.keyThemes.join(', ')}
- Summary: ${analysis.overallSummary}

Time Elapsed: ${timeElapsed}

Provide:
1. Accuracy score (0-1)
2. What was correct/incorrect
3. Factors that influenced the outcome
4. Lessons learned

Format as JSON:
{
  "accuracy_score": 0.75,
  "correct_aspects": ["aspect1", "aspect2"],
  "incorrect_aspects": ["aspect1", "aspect2"],
  "influencing_factors": ["factor1", "factor2"],
  "lessons_learned": ["lesson1", "lesson2"]
}`;
  }

  private async callOpenAIWithRetry<T>(
    prompt: string,
    operation: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    let model = this.primaryModel;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        aiLogger.debug(`Calling OpenAI for ${operation}`, { 
          model, 
          attempt 
        });

        const completion = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a financial market analyst AI. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
          throw new Error('Empty response from OpenAI');
        }

        const parsed = JSON.parse(responseText);
        
        aiLogger.debug(`OpenAI ${operation} successful`, { 
          model,
          tokensUsed: completion.usage?.total_tokens 
        });

        return parsed as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        aiLogger.warn(`OpenAI ${operation} attempt failed`, { 
          attempt, 
          error: lastError.message 
        });

        // Try fallback model on last attempt
        if (attempt === maxRetries - 1 && model === this.primaryModel) {
          model = this.fallbackModel;
          aiLogger.info('Switching to fallback model', { model });
        }

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError || new Error(`Failed to complete ${operation} after ${maxRetries} attempts`);
  }

  private determinePredictionType(predictionText: string): string {
    const text = predictionText.toLowerCase();
    
    if (text.includes('market') || text.includes('stock') || text.includes('index')) {
      return 'market_direction';
    } else if (text.includes('economic') || text.includes('gdp') || text.includes('inflation')) {
      return 'economic_indicator';
    } else if (text.includes('geopolitical') || text.includes('war') || text.includes('conflict')) {
      return 'geopolitical_event';
    } else if (text.includes('tech') || text.includes('innovation')) {
      return 'technology_trend';
    } else if (text.includes('crypto') || text.includes('bitcoin')) {
      return 'crypto_market';
    }
    
    return 'general';
  }

  private parseTimeHorizon(horizon: string): Prediction['timeHorizon'] {
    const normalized = horizon.toLowerCase().replace(/\s+/g, '_');
    
    switch (normalized) {
      case '1_week':
      case 'one_week':
      case '7_days':
        return '1_week';
      
      case '1_month':
      case 'one_month':
      case '30_days':
        return '1_month';
      
      case '3_months':
      case 'three_months':
      case '90_days':
        return '3_months';
      
      case '6_months':
      case 'six_months':
      case '180_days':
        return '6_months';
      
      case '1_year':
      case 'one_year':
      case '365_days':
        return '1_year';
      
      default:
        return '1_month'; // Default
    }
  }

  private calculateTimeElapsed(start: Date, end: Date): string {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'less than a day';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    
    return `${Math.floor(days / 365)} years`;
  }

  private formatOutcomeDescription(response: ComparisonResponse): string {
    const parts: string[] = [];
    
    if (response.correct_aspects.length > 0) {
      parts.push(`Correct: ${response.correct_aspects.join(', ')}`);
    }
    
    if (response.incorrect_aspects.length > 0) {
      parts.push(`Incorrect: ${response.incorrect_aspects.join(', ')}`);
    }
    
    parts.push(`Accuracy: ${(response.accuracy_score * 100).toFixed(1)}%`);
    
    return parts.join('. ');
  }
}

// Export singleton instance
export const aiService = new OpenAIService();