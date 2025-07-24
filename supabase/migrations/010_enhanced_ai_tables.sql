-- Enhanced AI Analysis Tables for Meta-Learning and Advanced Analytics
-- Migration 010: Enhanced AI Tables

-- Reasoning Chains Storage for Meta-Learning
CREATE TABLE IF NOT EXISTS reasoning_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    reasoning_steps JSONB NOT NULL DEFAULT '[]',
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    conviction_level VARCHAR(20) CHECK (conviction_level IN ('high', 'medium', 'low')),
    content_count INTEGER DEFAULT 0,
    timeframe VARCHAR(50),
    market_conditions VARCHAR(20) CHECK (market_conditions IN ('bullish', 'bearish', 'neutral', 'volatile')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Methodology Performance Weights for Ensemble Learning
CREATE TABLE IF NOT EXISTS methodology_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    weights JSONB NOT NULL DEFAULT '{}',
    confidence_adjustment TEXT,
    uncertainty_factors TEXT[] DEFAULT '{}',
    framework_updates TEXT[] DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prediction Evaluation Storage
CREATE TABLE IF NOT EXISTS prediction_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_data JSONB NOT NULL,
    analysis_context JSONB NOT NULL,
    evaluation_date DATE NOT NULL,
    methodology_weights JSONB DEFAULT '{}',
    actual_outcome JSONB DEFAULT NULL,
    accuracy_scores JSONB DEFAULT NULL,
    evaluation_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Meta-Learning Insights Storage
CREATE TABLE IF NOT EXISTS meta_learning_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accuracy_scores JSONB NOT NULL DEFAULT '{}',
    methodology_performance JSONB NOT NULL DEFAULT '{}',
    error_analysis JSONB NOT NULL DEFAULT '{}',
    lessons_learned JSONB NOT NULL DEFAULT '{}',
    calibration_adjustments JSONB NOT NULL DEFAULT '{}',
    meta_insights JSONB NOT NULL DEFAULT '{}',
    pattern_analysis JSONB DEFAULT '{}',
    improvement_recommendations TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced Predictions Table (extends existing predictions)
ALTER TABLE IF EXISTS predictions 
ADD COLUMN IF NOT EXISTS ensemble_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS methodology_breakdown JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS uncertainty_factors TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS measurable_outcomes JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS confidence_calibration JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS evaluation_metrics JSONB DEFAULT '{}';

-- SWOT Analysis Results Storage
CREATE TABLE IF NOT EXISTS swot_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    entity_context JSONB NOT NULL DEFAULT '{}',
    market_context JSONB NOT NULL DEFAULT '{}',
    swot_results JSONB NOT NULL DEFAULT '{}',
    strategic_implications JSONB DEFAULT '{}',
    cross_factor_analysis JSONB DEFAULT '{}',
    entities_analyzed INTEGER DEFAULT 0,
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scenario Analysis Storage
CREATE TABLE IF NOT EXISTS scenario_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    time_horizon VARCHAR(50) NOT NULL,
    base_analysis_id UUID REFERENCES daily_analysis(id),
    scenarios JSONB NOT NULL DEFAULT '[]',
    scenario_weights JSONB NOT NULL DEFAULT '{}',
    cross_scenario_analysis JSONB DEFAULT '{}',
    probability_sum_check FLOAT,
    key_uncertainties TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model Performance Tracking
CREATE TABLE IF NOT EXISTS model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL, -- 'analysis', 'prediction', 'evaluation'
    performance_metrics JSONB NOT NULL DEFAULT '{}',
    success_rate FLOAT CHECK (success_rate BETWEEN 0 AND 1),
    average_confidence FLOAT CHECK (average_confidence BETWEEN 0 AND 1),
    error_patterns JSONB DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced Daily Analysis (extends existing table)
ALTER TABLE IF EXISTS daily_analysis
ADD COLUMN IF NOT EXISTS reasoning_chain JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS alternative_scenarios JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS assumptions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS uncertainties TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS conviction_level VARCHAR(20) CHECK (conviction_level IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS time_sensitivity VARCHAR(20) CHECK (time_sensitivity IN ('immediate', 'short_term', 'medium_term', 'long_term')),
ADD COLUMN IF NOT EXISTS methodology_used VARCHAR(100) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS source_credibility_weighted BOOLEAN DEFAULT FALSE;

-- Prediction Accuracy Tracking
CREATE TABLE IF NOT EXISTS prediction_accuracy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    evaluation_date DATE NOT NULL,
    accuracy_type VARCHAR(50) NOT NULL, -- 'binary', 'directional', 'magnitude', 'timing'
    accuracy_score FLOAT CHECK (accuracy_score BETWEEN 0 AND 1),
    actual_outcome TEXT,
    prediction_text TEXT,
    error_analysis JSONB DEFAULT '{}',
    contributing_factors TEXT[] DEFAULT '{}',
    lessons_learned TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Confidence Calibration Tracking
CREATE TABLE IF NOT EXISTS confidence_calibration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    predicted_confidence FLOAT CHECK (predicted_confidence BETWEEN 0 AND 1),
    actual_accuracy FLOAT CHECK (actual_accuracy BETWEEN 0 AND 1),
    confidence_bucket VARCHAR(20), -- 'very_low', 'low', 'medium', 'high', 'very_high'
    calibration_error FLOAT,
    overconfidence_indicator BOOLEAN DEFAULT FALSE,
    methodology_used VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market Regime Detection
CREATE TABLE IF NOT EXISTS market_regimes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_date DATE NOT NULL,
    regime_type VARCHAR(50) NOT NULL, -- 'bull', 'bear', 'sideways', 'volatile', 'crisis'
    confidence_level FLOAT CHECK (confidence_level BETWEEN 0 AND 1),
    key_indicators JSONB DEFAULT '{}',
    regime_characteristics JSONB DEFAULT '{}',
    transition_signals TEXT[] DEFAULT '{}',
    duration_estimate VARCHAR(50),
    previous_regime VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_reasoning_chains_date ON reasoning_chains(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_reasoning_chains_confidence ON reasoning_chains(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_methodology_weights_updated ON methodology_weights(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_evaluations_date ON prediction_evaluations(evaluation_date);
CREATE INDEX IF NOT EXISTS idx_prediction_evaluations_completed ON prediction_evaluations(evaluation_completed, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_meta_learning_date ON meta_learning_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swot_analyses_date ON swot_analyses(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_date ON scenario_analyses(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_horizon ON scenario_analyses(time_horizon);
CREATE INDEX IF NOT EXISTS idx_model_performance_task ON model_performance(task_type, model_name);
CREATE INDEX IF NOT EXISTS idx_model_performance_success ON model_performance(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_type ON prediction_accuracy(accuracy_type, accuracy_score DESC);
CREATE INDEX IF NOT EXISTS idx_confidence_calibration_bucket ON confidence_calibration(confidence_bucket);
CREATE INDEX IF NOT EXISTS idx_market_regimes_date ON market_regimes(detection_date DESC);

-- Functions for Enhanced Analytics

-- Function to calculate prediction accuracy
CREATE OR REPLACE FUNCTION calculate_prediction_accuracy(
    prediction_id UUID,
    actual_outcome TEXT,
    evaluation_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    pred_record RECORD;
    accuracy_score FLOAT;
    error_type VARCHAR(50);
BEGIN
    -- Get prediction details
    SELECT * INTO pred_record FROM predictions WHERE id = prediction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prediction not found';
    END IF;
    
    -- Simple accuracy calculation (can be enhanced)
    -- This is a placeholder - implement domain-specific accuracy logic
    accuracy_score := CASE 
        WHEN actual_outcome ILIKE '%' || split_part(pred_record.prediction_text, ' ', 1) || '%' THEN 0.8
        WHEN actual_outcome ILIKE '%positive%' AND pred_record.prediction_text ILIKE '%positive%' THEN 0.7
        WHEN actual_outcome ILIKE '%negative%' AND pred_record.prediction_text ILIKE '%negative%' THEN 0.7
        ELSE 0.3
    END;
    
    -- Insert accuracy record
    INSERT INTO prediction_accuracy (
        prediction_id,
        evaluation_date,
        accuracy_type,
        accuracy_score,
        actual_outcome,
        prediction_text,
        error_analysis
    ) VALUES (
        prediction_id,
        CURRENT_DATE,
        'binary',
        accuracy_score,
        actual_outcome,
        pred_record.prediction_text,
        jsonb_build_object('evaluation_notes', evaluation_notes)
    );
    
    -- Update confidence calibration
    INSERT INTO confidence_calibration (
        prediction_id,
        predicted_confidence,
        actual_accuracy,
        confidence_bucket,
        calibration_error,
        overconfidence_indicator
    ) VALUES (
        prediction_id,
        pred_record.confidence_level,
        accuracy_score,
        CASE 
            WHEN pred_record.confidence_level >= 0.8 THEN 'very_high'
            WHEN pred_record.confidence_level >= 0.6 THEN 'high'
            WHEN pred_record.confidence_level >= 0.4 THEN 'medium'
            WHEN pred_record.confidence_level >= 0.2 THEN 'low'
            ELSE 'very_low'
        END,
        ABS(pred_record.confidence_level - accuracy_score),
        pred_record.confidence_level > accuracy_score + 0.2
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get methodology performance summary
CREATE OR REPLACE FUNCTION get_methodology_performance() RETURNS TABLE (
    methodology VARCHAR(100),
    avg_accuracy FLOAT,
    prediction_count BIGINT,
    confidence_calibration FLOAT,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(p.prediction_data->>'methodology', 'unknown')::VARCHAR(100) as methodology,
        AVG(pa.accuracy_score) as avg_accuracy,
        COUNT(pa.prediction_id) as prediction_count,
        AVG(cc.calibration_error) as confidence_calibration,
        MAX(pa.created_at) as last_updated
    FROM prediction_accuracy pa
    JOIN predictions p ON pa.prediction_id = p.id
    LEFT JOIN confidence_calibration cc ON pa.prediction_id = cc.prediction_id
    WHERE pa.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY COALESCE(p.prediction_data->>'methodology', 'unknown')
    ORDER BY avg_accuracy DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to detect market regime changes
CREATE OR REPLACE FUNCTION detect_market_regime() RETURNS VARCHAR(50) AS $$
DECLARE
    recent_sentiment FLOAT;
    sentiment_volatility FLOAT;
    content_volume INTEGER;
    regime VARCHAR(50);
BEGIN
    -- Get recent market indicators
    SELECT 
        AVG(CASE 
            WHEN market_sentiment = 'bullish' THEN 1
            WHEN market_sentiment = 'bearish' THEN -1
            ELSE 0
        END),
        STDDEV(confidence_score),
        COUNT(*)
    INTO recent_sentiment, sentiment_volatility, content_volume
    FROM daily_analysis
    WHERE analysis_date >= CURRENT_DATE - INTERVAL '7 days';
    
    -- Simple regime detection logic
    regime := CASE
        WHEN recent_sentiment > 0.3 AND sentiment_volatility < 0.2 THEN 'bull'
        WHEN recent_sentiment < -0.3 AND sentiment_volatility < 0.2 THEN 'bear'
        WHEN sentiment_volatility > 0.4 THEN 'volatile'
        WHEN ABS(recent_sentiment) < 0.1 THEN 'sideways'
        ELSE 'mixed'
    END;
    
    -- Store regime detection
    INSERT INTO market_regimes (
        detection_date,
        regime_type,
        confidence_level,
        key_indicators
    ) VALUES (
        CURRENT_DATE,
        regime,
        LEAST(1.0, ABS(recent_sentiment) + (1.0 - sentiment_volatility)),
        jsonb_build_object(
            'avg_sentiment', recent_sentiment,
            'volatility', sentiment_volatility,
            'volume', content_volume
        )
    ) ON CONFLICT (detection_date) DO UPDATE SET
        regime_type = EXCLUDED.regime_type,
        confidence_level = EXCLUDED.confidence_level,
        key_indicators = EXCLUDED.key_indicators;
    
    RETURN regime;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update model performance
CREATE OR REPLACE FUNCTION update_model_performance_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- Update usage count and performance metrics for models
    INSERT INTO model_performance (
        model_name,
        task_type,
        performance_metrics,
        usage_count,
        last_used_at
    ) VALUES (
        COALESCE(NEW.processing_metadata->>'ai_model', 'unknown'),
        'analysis',
        jsonb_build_object('confidence', NEW.confidence_score),
        1,
        NOW()
    ) ON CONFLICT (model_name, task_type) DO UPDATE SET
        usage_count = model_performance.usage_count + 1,
        last_used_at = NOW(),
        performance_metrics = jsonb_set(
            model_performance.performance_metrics,
            '{recent_confidence}',
            to_jsonb(NEW.confidence_score)
        );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for daily analysis
DROP TRIGGER IF EXISTS trigger_update_model_performance ON daily_analysis;
CREATE TRIGGER trigger_update_model_performance
    AFTER INSERT ON daily_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_model_performance_trigger();

-- Create views for analytics

-- View for prediction performance dashboard
CREATE OR REPLACE VIEW prediction_performance_summary AS
SELECT 
    DATE_TRUNC('month', pa.created_at) as month,
    pa.accuracy_type,
    AVG(pa.accuracy_score) as avg_accuracy,
    COUNT(*) as prediction_count,
    AVG(cc.calibration_error) as avg_calibration_error,
    SUM(CASE WHEN cc.overconfidence_indicator THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as overconfidence_rate
FROM prediction_accuracy pa
LEFT JOIN confidence_calibration cc ON pa.prediction_id = cc.prediction_id
WHERE pa.created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', pa.created_at), pa.accuracy_type
ORDER BY month DESC, accuracy_type;

-- View for market regime analysis
CREATE OR REPLACE VIEW market_regime_analysis AS
SELECT 
    mr.detection_date,
    mr.regime_type,
    mr.confidence_level,
    LAG(mr.regime_type) OVER (ORDER BY mr.detection_date) as previous_regime,
    CASE 
        WHEN LAG(mr.regime_type) OVER (ORDER BY mr.detection_date) != mr.regime_type 
        THEN TRUE ELSE FALSE 
    END as regime_change,
    da.market_sentiment,
    da.confidence_score as analysis_confidence
FROM market_regimes mr
LEFT JOIN daily_analysis da ON mr.detection_date = da.analysis_date
WHERE mr.detection_date >= CURRENT_DATE - INTERVAL '6 months'
ORDER BY mr.detection_date DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;