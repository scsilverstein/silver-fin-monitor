-- Create derived analytics table
CREATE TABLE IF NOT EXISTS derived_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analytics_date DATE NOT NULL,
    analytics_type VARCHAR(50) NOT NULL,
    
    -- Scope
    scope_type VARCHAR(50) NOT NULL,
    scope_identifier VARCHAR(255),
    
    -- Analytics results
    primary_metric DECIMAL(20, 4),
    secondary_metrics JSONB DEFAULT '{}',
    
    -- Trends and changes
    trend_direction VARCHAR(20),
    change_1d DECIMAL(10, 4),
    change_7d DECIMAL(10, 4),
    change_30d DECIMAL(10, 4),
    
    -- Statistical measures
    mean_value DECIMAL(20, 4),
    median_value DECIMAL(20, 4),
    std_deviation DECIMAL(20, 4),
    percentile_rank DECIMAL(5, 2),
    
    -- Insights
    key_insights JSONB DEFAULT '[]',
    anomalies_detected JSONB DEFAULT '[]',
    correlations JSONB DEFAULT '[]',
    
    -- Metadata
    calculation_method VARCHAR(100),
    data_points_used INTEGER,
    confidence_level DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_derived_analytics_type CHECK (
        analytics_type IN ('market_breadth', 'sector_rotation', 'sentiment_shift', 'momentum_analysis', 'correlation_matrix')
    ),
    
    CONSTRAINT chk_derived_analytics_scope CHECK (
        scope_type IN ('market', 'sector', 'industry', 'watchlist', 'portfolio')
    ),
    
    CONSTRAINT chk_derived_analytics_trend CHECK (
        trend_direction IS NULL OR 
        trend_direction IN ('strong_up', 'up', 'neutral', 'down', 'strong_down')
    ),
    
    CONSTRAINT chk_derived_analytics_confidence CHECK (
        confidence_level IS NULL OR confidence_level BETWEEN 0 AND 100
    ),
    
    CONSTRAINT chk_derived_analytics_percentile CHECK (
        percentile_rank IS NULL OR percentile_rank BETWEEN 0 AND 100
    ),
    
    CONSTRAINT uq_derived_analytics 
        UNIQUE(analytics_date, analytics_type, scope_type, scope_identifier)
);

-- Add table comment
COMMENT ON TABLE derived_analytics IS 'Store higher-level analytics derived from base data';

-- Add column comments
COMMENT ON COLUMN derived_analytics.analytics_type IS 'Type: market_breadth, sector_rotation, sentiment_shift, momentum_analysis, correlation_matrix';
COMMENT ON COLUMN derived_analytics.scope_type IS 'Scope: market, sector, industry, watchlist, portfolio';
COMMENT ON COLUMN derived_analytics.scope_identifier IS 'Identifier for the scope (e.g., sector name, portfolio ID)';
COMMENT ON COLUMN derived_analytics.key_insights IS 'Array of {insight_type, message, confidence} objects';
COMMENT ON COLUMN derived_analytics.anomalies_detected IS 'Array of {anomaly_type, severity, description} objects';
COMMENT ON COLUMN derived_analytics.correlations IS 'Array of {entity_1, entity_2, correlation_coefficient} objects';