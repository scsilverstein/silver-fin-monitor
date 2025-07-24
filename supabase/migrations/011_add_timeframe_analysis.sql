-- Migration to add timeframe-based analysis support
-- This enables weekly and monthly analysis generation in addition to daily

-- Create timeframe_analysis table for storing weekly/monthly analyses
CREATE TABLE timeframe_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timeframe_type VARCHAR(20) NOT NULL CHECK (timeframe_type IN ('daily', 'weekly', 'monthly')),
    timeframe_start DATE NOT NULL,
    timeframe_end DATE NOT NULL,
    analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Core analysis data (similar to daily_analysis)
    market_sentiment VARCHAR(50) NOT NULL,
    key_themes TEXT[] DEFAULT '{}',
    overall_summary TEXT NOT NULL,
    ai_analysis JSONB DEFAULT '{}',
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    sources_analyzed INTEGER DEFAULT 0,
    
    -- Timeframe-specific data
    content_distribution JSONB DEFAULT '{}', -- Distribution of content across the timeframe
    trend_analysis JSONB DEFAULT '{}', -- Trend analysis specific to the timeframe
    comparison_data JSONB DEFAULT '{}', -- Comparison with previous periods
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique analysis per timeframe period
    UNIQUE(timeframe_type, timeframe_start, timeframe_end)
);

-- Create indexes for efficient querying
CREATE INDEX idx_timeframe_analysis_type_date ON timeframe_analysis(timeframe_type, analysis_date DESC);
CREATE INDEX idx_timeframe_analysis_timeframe ON timeframe_analysis(timeframe_start, timeframe_end);
CREATE INDEX idx_timeframe_analysis_created ON timeframe_analysis(created_at DESC);

-- Create predictions table for timeframe analyses (extending existing predictions)
CREATE TABLE timeframe_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timeframe_analysis_id UUID NOT NULL REFERENCES timeframe_analysis(id) ON DELETE CASCADE,
    prediction_type VARCHAR(100) NOT NULL,
    prediction_text TEXT NOT NULL,
    confidence_level FLOAT CHECK (confidence_level BETWEEN 0 AND 1),
    time_horizon VARCHAR(50) NOT NULL,
    prediction_data JSONB DEFAULT '{}',
    
    -- Timeframe context
    based_on_timeframe VARCHAR(20) NOT NULL,
    timeframe_start DATE NOT NULL,
    timeframe_end DATE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for timeframe predictions
CREATE INDEX idx_timeframe_predictions_analysis ON timeframe_predictions(timeframe_analysis_id, created_at DESC);
CREATE INDEX idx_timeframe_predictions_type ON timeframe_predictions(prediction_type, based_on_timeframe);

-- Function to get content count for a timeframe
CREATE OR REPLACE FUNCTION get_timeframe_content_stats(
    start_date DATE,
    end_date DATE
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_content', COUNT(*),
        'by_sentiment', jsonb_object_agg(
            CASE 
                WHEN sentiment_score > 0.1 THEN 'positive'
                WHEN sentiment_score < -0.1 THEN 'negative'
                ELSE 'neutral'
            END,
            sentiment_count
        ),
        'by_source', jsonb_object_agg(source_name, source_count),
        'date_range', jsonb_build_object(
            'start', start_date,
            'end', end_date
        )
    ) INTO result
    FROM (
        SELECT 
            sentiment_score,
            COALESCE(fs.name, 'Unknown') as source_name,
            COUNT(*) as sentiment_count,
            COUNT(*) as source_count
        FROM processed_content pc
        LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
        LEFT JOIN feed_sources fs ON rf.source_id = fs.id
        WHERE DATE(pc.created_at) BETWEEN start_date AND end_date
        GROUP BY sentiment_score, fs.name
    ) subq;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate timeframe boundaries
CREATE OR REPLACE FUNCTION calculate_timeframe_bounds(
    timeframe_type VARCHAR(20),
    reference_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(start_date DATE, end_date DATE) AS $$
BEGIN
    IF timeframe_type = 'weekly' THEN
        -- Get the Monday of the week containing reference_date
        start_date := reference_date - (EXTRACT(DOW FROM reference_date) - 1)::INTEGER;
        end_date := start_date + 6; -- Sunday
    ELSIF timeframe_type = 'monthly' THEN
        -- First and last day of the month
        start_date := DATE_TRUNC('month', reference_date)::DATE;
        end_date := (DATE_TRUNC('month', reference_date) + INTERVAL '1 month - 1 day')::DATE;
    ELSE
        -- Daily (fallback)
        start_date := reference_date;
        end_date := reference_date;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the migration
COMMENT ON TABLE timeframe_analysis IS 'Stores weekly and monthly market analysis data generated from processed content';
COMMENT ON TABLE timeframe_predictions IS 'Predictions based on timeframe analysis (weekly/monthly)';
COMMENT ON FUNCTION get_timeframe_content_stats IS 'Calculates content statistics for a given timeframe';
COMMENT ON FUNCTION calculate_timeframe_bounds IS 'Calculates start and end dates for different timeframe types';