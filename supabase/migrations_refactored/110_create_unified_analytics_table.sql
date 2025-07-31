-- Create unified analytics table
CREATE TABLE IF NOT EXISTS unified_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID,
    analytics_date DATE NOT NULL,
    analytics_type VARCHAR(50) NOT NULL,
    
    -- Composite scores
    overall_score DECIMAL(5, 2),
    momentum_score DECIMAL(5, 2),
    value_score DECIMAL(5, 2),
    sentiment_score DECIMAL(5, 2),
    risk_score DECIMAL(5, 2),
    
    -- Key metrics (type-specific)
    metrics JSONB NOT NULL,
    
    -- Signals and alerts
    signals JSONB DEFAULT '[]',
    
    -- Data sources used
    source_count INTEGER,
    confidence_level DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_unified_analytics_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_unified_analytics_type CHECK (
        analytics_type IN ('market', 'fundamental', 'sentiment', 'technical', 'options', 'composite')
    ),
    
    CONSTRAINT chk_unified_analytics_scores CHECK (
        (overall_score IS NULL OR overall_score BETWEEN 0 AND 100) AND
        (momentum_score IS NULL OR momentum_score BETWEEN 0 AND 100) AND
        (value_score IS NULL OR value_score BETWEEN 0 AND 100) AND
        (sentiment_score IS NULL OR sentiment_score BETWEEN 0 AND 100) AND
        (risk_score IS NULL OR risk_score BETWEEN 0 AND 100)
    ),
    
    CONSTRAINT chk_unified_analytics_confidence CHECK (
        confidence_level IS NULL OR confidence_level BETWEEN 0 AND 100
    ),
    
    CONSTRAINT uq_unified_analytics 
        UNIQUE(entity_id, analytics_date, analytics_type)
);

-- Add table comment
COMMENT ON TABLE unified_analytics IS 'Consolidated analytics combining all insights sources';

-- Add column comments
COMMENT ON COLUMN unified_analytics.analytics_type IS 'Type of analytics: market, fundamental, sentiment, technical, options, composite';
COMMENT ON COLUMN unified_analytics.overall_score IS 'Combined score from 0-100';
COMMENT ON COLUMN unified_analytics.metrics IS 'Type-specific metrics as JSON';
COMMENT ON COLUMN unified_analytics.signals IS 'Array of {type, strength, message} signals';
COMMENT ON COLUMN unified_analytics.source_count IS 'Number of data sources used';
COMMENT ON COLUMN unified_analytics.confidence_level IS 'Confidence in the analytics (0-100)';