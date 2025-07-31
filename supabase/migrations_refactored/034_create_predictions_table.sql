-- Create predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_analysis_id UUID,
    prediction_type VARCHAR(100),
    prediction_text TEXT,
    confidence_level FLOAT,
    time_horizon VARCHAR(50),
    prediction_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_predictions_daily_analysis 
        FOREIGN KEY (daily_analysis_id) 
        REFERENCES daily_analysis(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_predictions_confidence CHECK (
        confidence_level BETWEEN 0 AND 1
    ),
    
    CONSTRAINT chk_predictions_time_horizon CHECK (
        time_horizon IN ('1_week', '1_month', '3_months', '6_months', '1_year')
    )
);

-- Add table comment
COMMENT ON TABLE predictions IS 'AI-generated market predictions with time horizons';

-- Add column comments
COMMENT ON COLUMN predictions.daily_analysis_id IS 'Reference to the daily analysis that generated this prediction';
COMMENT ON COLUMN predictions.prediction_type IS 'Type of prediction: market_direction, economic_indicator, geopolitical_event';
COMMENT ON COLUMN predictions.prediction_text IS 'Human-readable prediction text';
COMMENT ON COLUMN predictions.confidence_level IS 'Confidence score from 0 to 1';
COMMENT ON COLUMN predictions.time_horizon IS 'Time horizon for the prediction';
COMMENT ON COLUMN predictions.prediction_data IS 'Additional structured data for the prediction';