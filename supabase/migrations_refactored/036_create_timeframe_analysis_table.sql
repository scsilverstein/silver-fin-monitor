-- Create timeframe analysis table
CREATE TABLE IF NOT EXISTS timeframe_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timeframe_start DATE NOT NULL,
    timeframe_end DATE NOT NULL,
    period_type VARCHAR(50) NOT NULL,
    
    -- Aggregated sentiment and themes
    avg_sentiment_score FLOAT,
    dominant_sentiment VARCHAR(50),
    sentiment_consistency FLOAT,
    
    -- Key themes and topics
    top_themes TEXT[] DEFAULT '{}',
    theme_persistence_scores JSONB DEFAULT '{}',
    emerging_themes TEXT[] DEFAULT '{}',
    declining_themes TEXT[] DEFAULT '{}',
    
    -- Market analysis
    market_direction VARCHAR(50),
    volatility_score FLOAT,
    key_events JSONB DEFAULT '[]',
    
    -- Summary and insights
    period_summary TEXT,
    ai_insights JSONB DEFAULT '{}',
    
    -- Metadata
    content_count INTEGER DEFAULT 0,
    sources_count INTEGER DEFAULT 0,
    confidence_score FLOAT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_timeframe_analysis_dates CHECK (
        timeframe_end >= timeframe_start
    ),
    
    CONSTRAINT chk_timeframe_analysis_period CHECK (
        period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')
    ),
    
    CONSTRAINT chk_timeframe_analysis_sentiment CHECK (
        avg_sentiment_score BETWEEN -1 AND 1
    ),
    
    CONSTRAINT chk_timeframe_analysis_confidence CHECK (
        confidence_score BETWEEN 0 AND 1
    ),
    
    CONSTRAINT uq_timeframe_analysis_period 
        UNIQUE(timeframe_start, timeframe_end, period_type)
);

-- Add table comment
COMMENT ON TABLE timeframe_analysis IS 'Aggregated analysis over specific time periods';

-- Add column comments
COMMENT ON COLUMN timeframe_analysis.period_type IS 'Type of time period: daily, weekly, monthly, quarterly, yearly, custom';
COMMENT ON COLUMN timeframe_analysis.avg_sentiment_score IS 'Average sentiment score for the period (-1 to 1)';
COMMENT ON COLUMN timeframe_analysis.sentiment_consistency IS 'How consistent sentiment was during period (0-1)';
COMMENT ON COLUMN timeframe_analysis.theme_persistence_scores IS 'How consistently themes appeared {theme: score}';
COMMENT ON COLUMN timeframe_analysis.emerging_themes IS 'New themes that appeared during this period';
COMMENT ON COLUMN timeframe_analysis.declining_themes IS 'Themes that decreased in prominence';