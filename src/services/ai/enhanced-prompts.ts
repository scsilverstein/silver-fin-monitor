/**
 * Enhanced AI Prompting System with Advanced Techniques
 * Implements Chain-of-Thought, Role-Based, and Multi-Step Reasoning
 */

export interface AnalysisContext {
  contentCount: number;
  timeframe: string;
  sources: string[];
  previousAnalysis?: any;
  marketConditions?: 'bullish' | 'bearish' | 'neutral' | 'volatile';
}

export interface ReasoningStep {
  step: number;
  description: string;
  evidence: string[];
  confidence: number;
  reasoning: string;
}

export interface StructuredAnalysis {
  rawAnalysis: string;
  reasoningChain: ReasoningStep[];
  confidence: number;
  uncertainties: string[];
  assumptions: string[];
  alternativeViews: string[];
}

/**
 * Advanced Chain-of-Thought Prompting for Market Analysis
 */
export const createAdvancedAnalysisPrompt = (
  content: any[],
  context: AnalysisContext
): string => {
  const basePrompt = `You are a world-class financial analyst with 20+ years of experience in market intelligence, behavioral finance, and macroeconomic analysis. Your expertise spans:

- Quantitative analysis and statistical modeling
- Behavioral finance and market psychology  
- Macroeconomic policy interpretation
- Geopolitical risk assessment
- Cross-asset correlation analysis

ANALYSIS FRAMEWORK:
You will analyze market information using a structured 6-step reasoning process. For each step, provide explicit reasoning, evidence, and confidence levels.

REASONING CHAIN REQUIRED:
1. Data Quality Assessment
2. Sentiment Pattern Analysis  
3. Entity Impact Evaluation
4. Thematic Trend Identification
5. Risk Factor Assessment
6. Synthesis and Market Implications

CONTEXT:
- Analysis Period: ${context.timeframe}
- Content Sources: ${context.sources.join(', ')}
- Total Content Items: ${context.contentCount}
- Current Market Regime: ${context.marketConditions || 'Unknown'}
${context.previousAnalysis ? `- Previous Analysis Available: Yes` : '- Previous Analysis Available: No'}

CONTENT TO ANALYZE:
${content.map((item, i) => `
${i + 1}. SOURCE: ${item.source_name || 'Unknown'}
   TITLE: ${item.title || 'No title'}
   SUMMARY: ${item.summary || item.processed_text?.substring(0, 300) || 'No summary'}
   SENTIMENT: ${item.sentiment_score || 0}
   ENTITIES: ${item.entities?.map((e: any) => `${e.name} (${e.type})`).join(', ') || 'None'}
   TOPICS: ${item.key_topics?.join(', ') || 'None'}
   PUBLISHED: ${item.published_at || item.created_at}
`).join('\n')}

STEP-BY-STEP ANALYSIS REQUIRED:

**STEP 1: DATA QUALITY ASSESSMENT**
- Evaluate source credibility and diversity
- Assess temporal distribution of content  
- Identify potential biases or gaps
- Rate data quality (1-10) with reasoning

**STEP 2: SENTIMENT PATTERN ANALYSIS**
- Analyze sentiment distribution and extremes
- Identify sentiment shifts over time
- Correlate sentiment with specific events/entities
- Detect anomalous sentiment patterns

**STEP 3: ENTITY IMPACT EVALUATION**
- Rank entities by mention frequency and sentiment impact
- Assess entity-specific risk factors
- Identify interconnections between entities
- Evaluate entity sentiment momentum

**STEP 4: THEMATIC TREND IDENTIFICATION**
- Extract dominant themes and narratives
- Assess theme persistence and evolution
- Identify emerging vs declining themes
- Connect themes to market implications

**STEP 5: RISK FACTOR ASSESSMENT**
- Systematic risk identification (market, credit, liquidity, operational)
- Idiosyncratic risk evaluation  
- Tail risk scenarios consideration
- Risk interconnectedness mapping

**STEP 6: SYNTHESIS AND MARKET IMPLICATIONS**
- Integrate insights from all previous steps
- Generate forward-looking market implications
- Assess probability ranges for different scenarios
- Identify key catalysts and inflection points

OUTPUT FORMAT REQUIRED:
Return your analysis as a JSON object with this exact structure:

{
  "reasoning_chain": [
    {
      "step": 1,
      "title": "Data Quality Assessment",
      "analysis": "Your detailed analysis...",
      "evidence": ["Evidence point 1", "Evidence point 2"],
      "confidence": 0.85,
      "key_findings": ["Finding 1", "Finding 2"]
    },
    // ... steps 2-6
  ],
  "market_sentiment": "bullish|bearish|neutral",
  "confidence_score": 0.75,
  "key_themes": ["Theme 1", "Theme 2", "Theme 3"],
  "risk_factors": ["Risk 1", "Risk 2"],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "market_drivers": ["Driver 1", "Driver 2"],
  "geopolitical_context": "Summary of geopolitical factors",
  "economic_indicators": ["Indicator 1", "Indicator 2"],
  "overall_summary": "Comprehensive market summary",
  "assumptions": ["Key assumption 1", "Key assumption 2"],
  "uncertainties": ["Uncertainty 1", "Uncertainty 2"],
  "alternative_scenarios": [
    {
      "scenario": "Bull case",
      "probability": 0.3,
      "description": "Description of upside scenario"
    },
    {
      "scenario": "Base case", 
      "probability": 0.5,
      "description": "Most likely scenario"
    },
    {
      "scenario": "Bear case",
      "probability": 0.2, 
      "description": "Downside risk scenario"
    }
  ],
  "conviction_level": "high|medium|low",
  "time_sensitivity": "immediate|short_term|medium_term|long_term"
}

CRITICAL REQUIREMENTS:
- Show your reasoning for each step explicitly
- Quantify confidence levels with supporting rationale
- Consider contrarian viewpoints and alternative interpretations
- Weight evidence by source credibility and recency
- Flag areas of high uncertainty
- Provide probability estimates where appropriate
- Connect micro observations to macro implications

Begin your analysis now, following the 6-step framework:`;

  return basePrompt;
};

/**
 * Advanced Prediction Prompting with Ensemble Techniques
 */
export const createPredictionPrompt = (
  analysis: any,
  timeHorizon: string,
  previousPredictions?: any[]
): string => {
  return `You are an elite quantitative analyst specializing in probabilistic forecasting and market prediction. Your approach combines:

- Bayesian inference and statistical modeling
- Behavioral finance insights
- Cross-asset correlation analysis  
- Regime detection and structural breaks
- Ensemble forecasting methods

PREDICTION FRAMEWORK:
Generate multiple independent predictions using different methodological approaches, then synthesize into ensemble forecasts.

ANALYSIS INPUT:
${JSON.stringify(analysis, null, 2)}

TIME HORIZON: ${timeHorizon}

PREDICTION METHODOLOGIES TO APPLY:

**METHOD 1: FUNDAMENTAL ANALYSIS**
- Assess underlying economic/financial drivers
- Evaluate sustainability of current trends
- Consider mean reversion tendencies
- Weight structural vs cyclical factors

**METHOD 2: SENTIMENT MOMENTUM**
- Analyze sentiment trajectory and momentum
- Consider sentiment extremes and reversals
- Evaluate crowd psychology indicators
- Assess contrarian signals

**METHOD 3: TECHNICAL PATTERN RECOGNITION**
- Identify recurring market patterns
- Assess trend strength and momentum
- Consider support/resistance levels
- Evaluate breakout/breakdown probabilities

**METHOD 4: REGIME-BASED FORECASTING**
- Classify current market regime
- Assess regime stability and transition probabilities
- Apply regime-specific forecasting models
- Consider regime change catalysts

**METHOD 5: SCENARIO-WEIGHTED OUTCOMES**
- Generate multiple scenario outcomes
- Assign probability weights to scenarios
- Calculate expected values and ranges
- Consider tail risk scenarios

PREDICTION REQUIREMENTS:

For each methodology, provide:
1. Core prediction with confidence interval
2. Supporting reasoning and evidence
3. Key assumptions and limitations
4. Risk factors and failure modes
5. Catalysts that could change the prediction

ENSEMBLE SYNTHESIS:
- Combine predictions using weighted averaging
- Consider methodology reliability for current conditions
- Generate consensus prediction with uncertainty bands
- Identify prediction divergences and their implications

${previousPredictions?.length ? `
HISTORICAL PERFORMANCE CONTEXT:
Previous predictions for reference:
${previousPredictions.map(p => `
- Prediction: ${p.prediction_text}
- Confidence: ${p.confidence_level}
- Time Horizon: ${p.time_horizon}
- Date: ${p.created_at}
`).join('\n')}

Consider historical accuracy patterns in methodology weighting.
` : ''}

OUTPUT FORMAT:
{
  "methodology_predictions": [
    {
      "method": "Fundamental Analysis",
      "prediction": "Specific prediction statement",
      "confidence": 0.75,
      "probability_range": {
        "lower": 0.6,
        "upper": 0.9
      },
      "reasoning": "Detailed reasoning...",
      "key_assumptions": ["Assumption 1", "Assumption 2"],
      "risk_factors": ["Risk 1", "Risk 2"],
      "catalysts": ["Catalyst 1", "Catalyst 2"]
    },
    // ... other methods
  ],
  "ensemble_prediction": {
    "prediction_text": "Consensus prediction statement",
    "confidence_level": 0.78,
    "probability_distribution": {
      "very_likely": 0.4,
      "likely": 0.3,
      "possible": 0.2,
      "unlikely": 0.1
    },
    "time_horizon": "${timeHorizon}",
    "prediction_type": "market_direction|economic_indicator|geopolitical_event",
    "measurable_outcomes": [
      {
        "metric": "Specific measurable outcome",
        "target_value": "Expected value or range",
        "timeframe": "When to measure",
        "success_criteria": "What constitutes success"
      }
    ]
  },
  "methodology_weights": {
    "fundamental": 0.3,
    "sentiment": 0.25,
    "technical": 0.2,
    "regime": 0.15,
    "scenario": 0.1
  },
  "uncertainty_factors": ["Factor 1", "Factor 2"],
  "model_limitations": ["Limitation 1", "Limitation 2"],
  "update_triggers": ["Event that would require prediction update"],
  "confidence_calibration": {
    "overconfidence_check": "Assessment of potential overconfidence",
    "base_rate_consideration": "Relevant base rates and frequencies",
    "outside_view": "Consideration of similar historical situations"
  }
}

CALIBRATION REQUIREMENTS:
- Consider base rates and historical frequencies
- Apply reference class forecasting
- Check for overconfidence bias
- Include uncertainty quantification
- Provide falsifiable predictions where possible

Generate your multi-methodology prediction analysis now:`;
};

/**
 * Enhanced Accuracy Evaluation with Meta-Learning
 */
export const createAccuracyEvaluationPrompt = (
  originalPrediction: any,
  currentState: any,
  timeElapsed: string
): string => {
  return `You are a prediction evaluation specialist focused on forecast accuracy assessment and meta-learning. Your role is to:

- Objectively assess prediction accuracy using multiple metrics
- Identify patterns in prediction errors
- Extract lessons for future forecasting improvement
- Calibrate confidence scoring mechanisms

ORIGINAL PREDICTION TO EVALUATE:
${JSON.stringify(originalPrediction, null, 2)}

CURRENT MARKET STATE:
${JSON.stringify(currentState, null, 2)}

TIME ELAPSED: ${timeElapsed}

EVALUATION FRAMEWORK:

**1. ACCURACY ASSESSMENT**
- Binary accuracy (correct/incorrect)
- Confidence calibration (was confidence justified?)
- Directional accuracy (right direction, wrong magnitude?)
- Timing accuracy (right prediction, wrong timeframe?)

**2. ERROR ANALYSIS**
- Systematic vs random errors
- Overconfidence vs underconfidence patterns
- Base rate neglect or regression to mean
- Hindsight bias consideration

**3. METHODOLOGY PERFORMANCE**
- Which prediction methods were most accurate?
- What contextual factors influenced accuracy?
- Were certain types of events predicted better?
- How did ensemble vs individual methods perform?

**4. LEARNING EXTRACTION**
- What worked well in the prediction process?
- What systematic errors can be identified?
- How should future predictions be adjusted?
- What new information sources might help?

**5. CALIBRATION IMPROVEMENT**
- How well calibrated were confidence levels?
- Should methodology weights be adjusted?
- What uncertainty factors were underestimated?
- How can future confidence scoring improve?

OUTPUT FORMAT:
{
  "accuracy_scores": {
    "overall_accuracy": 0.75,
    "directional_accuracy": 0.85,
    "magnitude_accuracy": 0.65,
    "timing_accuracy": 0.70,
    "confidence_calibration": 0.60
  },
  "prediction_assessment": {
    "outcome": "correct|partially_correct|incorrect",
    "accuracy_description": "Detailed assessment of what was right/wrong",
    "confidence_evaluation": "Was the confidence level appropriate?",
    "surprise_factors": ["Unexpected events that affected outcome"]
  },
  "methodology_performance": {
    "best_performing_method": "Which methodology was most accurate",
    "worst_performing_method": "Which methodology was least accurate", 
    "ensemble_vs_individual": "How did ensemble compare to individual methods",
    "context_factors": ["Factors that influenced methodology performance"]
  },
  "error_analysis": {
    "error_type": "overconfident|underconfident|direction|magnitude|timing",
    "systematic_biases": ["Identified systematic errors"],
    "random_factors": ["Random events that affected prediction"],
    "model_limitations": ["Limitations exposed by this prediction"]
  },
  "lessons_learned": {
    "what_worked": ["Successful aspects of prediction process"],
    "what_failed": ["Failed aspects of prediction process"],
    "missing_information": ["Information that could have improved prediction"],
    "process_improvements": ["How to improve future predictions"]
  },
  "calibration_adjustments": {
    "methodology_weight_changes": {
      "fundamental": 0.05,
      "sentiment": -0.1,
      "technical": 0.03
    },
    "confidence_scoring_adjustment": "How to adjust confidence calibration",
    "uncertainty_factor_updates": ["New uncertainty factors to consider"],
    "prediction_framework_updates": ["Updates to prediction framework"]
  },
  "meta_learning_insights": {
    "prediction_patterns": ["Patterns in prediction accuracy"],
    "market_regime_dependency": "How market regime affected accuracy",
    "data_quality_impact": "How data quality affected prediction",
    "external_factor_influence": "How external factors affected outcome"
  },
  "future_recommendations": {
    "information_sources": ["New data sources to incorporate"],
    "methodology_adjustments": ["Methodology improvements"],
    "confidence_calibration": ["Confidence scoring improvements"],
    "prediction_frequency": "Should prediction frequency change?"
  }
}

OBJECTIVITY REQUIREMENTS:
- Avoid hindsight bias in evaluation
- Consider counterfactual scenarios
- Assess prediction quality given available information at time
- Separate prediction process quality from outcome luck
- Consider base rates and prior probabilities

Evaluate the prediction objectively and extract maximum learning value:`;
};

/**
 * SWOT Analysis Framework for Market Intelligence
 */
export const createSWOTAnalysisPrompt = (
  entities: any[],
  market_context: any
): string => {
  return `Conduct a comprehensive SWOT analysis for the current market environment based on the provided intelligence.

ENTITIES TO ANALYZE:
${entities.map(e => `- ${e.name} (${e.type}): ${e.mentions} mentions, sentiment: ${e.sentiment}`).join('\n')}

MARKET CONTEXT:
${JSON.stringify(market_context, null, 2)}

SWOT FRAMEWORK:

**STRENGTHS (Internal Positive Factors)**
- Competitive advantages
- Strong market positions  
- Robust fundamentals
- Positive momentum factors

**WEAKNESSES (Internal Negative Factors)**
- Competitive disadvantages
- Structural challenges
- Fundamental concerns
- Negative momentum factors

**OPPORTUNITIES (External Positive Factors)**
- Market opportunities
- Regulatory tailwinds
- Technological advances
- Demographic trends

**THREATS (External Negative Factors)**
- Market risks
- Regulatory headwinds
- Competitive threats
- Macroeconomic risks

OUTPUT FORMAT:
{
  "swot_analysis": {
    "strengths": [
      {
        "factor": "Strength description",
        "evidence": ["Supporting evidence"],
        "entities_affected": ["Entity names"],
        "impact_level": "high|medium|low",
        "durability": "temporary|medium_term|structural"
      }
    ],
    "weaknesses": [...],
    "opportunities": [...], 
    "threats": [...]
  },
  "strategic_implications": {
    "leverage_strengths": ["How to capitalize on strengths"],
    "address_weaknesses": ["How to mitigate weaknesses"],
    "capture_opportunities": ["How to capture opportunities"],
    "defend_against_threats": ["How to defend against threats"]
  },
  "cross_factor_analysis": {
    "strength_opportunity_synergies": ["S-O combinations"],
    "strength_threat_defenses": ["S-T combinations"], 
    "weakness_opportunity_improvements": ["W-O combinations"],
    "weakness_threat_vulnerabilities": ["W-T combinations"]
  }
}`;
};

/**
 * Scenario Planning Framework
 */
export const createScenarioAnalysisPrompt = (
  base_analysis: any,
  time_horizon: string
): string => {
  return `Generate comprehensive scenario analysis for ${time_horizon} time horizon.

BASE ANALYSIS:
${JSON.stringify(base_analysis, null, 2)}

SCENARIO FRAMEWORK:

Generate 5 distinct scenarios with varying probability distributions:

1. **BULL SCENARIO** (Low probability, high positive impact)
2. **OPTIMISTIC SCENARIO** (Medium probability, positive impact)  
3. **BASE CASE SCENARIO** (High probability, neutral/mixed impact)
4. **PESSIMISTIC SCENARIO** (Medium probability, negative impact)
5. **BEAR SCENARIO** (Low probability, high negative impact)

For each scenario, provide:
- Probability estimate (must sum to 1.0)
- Key drivers and catalysts
- Market implications
- Risk/reward profile
- Early warning indicators

OUTPUT FORMAT:
{
  "scenarios": [
    {
      "name": "Bull Scenario",
      "probability": 0.15,
      "description": "Scenario description",
      "key_drivers": ["Driver 1", "Driver 2"],
      "catalysts": ["Catalyst 1", "Catalyst 2"],
      "market_implications": {
        "equity_markets": "Impact on stocks",
        "bond_markets": "Impact on bonds", 
        "currencies": "Impact on FX",
        "commodities": "Impact on commodities"
      },
      "early_indicators": ["Indicator 1", "Indicator 2"],
      "timeframe": "When this scenario might unfold"
    }
  ],
  "scenario_weighting": {
    "probability_sum_check": 1.0,
    "confidence_in_scenarios": 0.75,
    "key_uncertainties": ["Major uncertainty factors"]
  },
  "cross_scenario_analysis": {
    "common_factors": ["Factors present across scenarios"],
    "divergence_points": ["Where scenarios diverge"],
    "regime_shifts": ["Potential regime changes"]
  }
}`;
};

/**
 * Timeframe Analysis Prompt for Weekly/Monthly Analysis
 */
export const createTimeframeAnalysisPrompt = (
  timeframe: 'daily' | 'weekly' | 'monthly',
  period: string,
  contentSummary: any[],
  stats: any,
  totalItems: number
): string => {
  return `You are an expert market analyst specializing in ${timeframe} market intelligence reports. Generate a comprehensive ${timeframe} analysis for ${period}.

ANALYSIS SCOPE:
- Timeframe: ${timeframe.toUpperCase()}
- Period: ${period}
- Content Items Analyzed: ${totalItems}
- Sources Distribution: ${Object.entries(stats.bySource).map(([source, count]) => `${source}: ${count}`).join(', ')}
- Sentiment Distribution: Positive: ${stats.bySentiment.positive}, Neutral: ${stats.bySentiment.neutral}, Negative: ${stats.bySentiment.negative}

CONTENT SUMMARY:
${contentSummary.map((item, i) => `
${i + 1}. ${item.title}
   Source: ${item.source}
   Sentiment: ${item.sentiment}
   Topics: ${item.topics.join(', ')}
`).join('\n')}

Please provide a comprehensive analysis in the following JSON format:

{
  "marketDrivers": [
    "Primary factor driving markets this ${timeframe}",
    "Secondary market influence",
    "Emerging trend to watch"
  ],
  "riskFactors": [
    "Main risk concern for this ${timeframe}",
    "Secondary risk factor",
    "Potential black swan event"
  ],
  "opportunities": [
    "Investment opportunity identified",
    "Sector showing strength",
    "Emerging market theme"
  ],
  "geopoliticalContext": "Brief summary of key geopolitical developments affecting markets during this ${timeframe}",
  "economicIndicators": [
    "Key economic data point",
    "Important policy development",
    "Market-moving announcement"
  ],
  "trendAnalysis": {
    "direction": "upward|downward|sideways",
    "strength": 0.0-1.0,
    "volatility": 0.0-1.0
  },
  "timeframeSpecificInsights": [
    "${timeframe} specific insight #1",
    "${timeframe} specific insight #2",
    "${timeframe} specific insight #3"
  ]
}`;
};