-- Create intelligence metrics table
CREATE TABLE IF NOT EXISTS intelligence_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_category VARCHAR(50) NOT NULL,
    
    -- Metric values
    metric_value DECIMAL(20, 4) NOT NULL,
    previous_value DECIMAL(20, 4),
    change_percentage DECIMAL(10, 4),
    
    -- Context
    entity_id UUID,
    symbol VARCHAR(20),
    sector VARCHAR(100),
    industry VARCHAR(100),
    
    -- Metadata
    calculation_method VARCHAR(100),
    data_sources JSONB DEFAULT '[]',
    confidence_level DECIMAL(5, 2),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_intelligence_metrics_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE SET NULL,
    
    CONSTRAINT chk_intelligence_metrics_type CHECK (
        metric_type IN ('accuracy', 'coverage', 'timeliness', 'sentiment_accuracy', 'prediction_success')
    ),
    
    CONSTRAINT chk_intelligence_metrics_category CHECK (
        metric_category IN ('system', 'source', 'model', 'prediction', 'alert')
    ),
    
    CONSTRAINT chk_intelligence_metrics_confidence CHECK (
        confidence_level IS NULL OR confidence_level BETWEEN 0 AND 100
    )
);

-- Add table comment
COMMENT ON TABLE intelligence_metrics IS 'Track performance metrics for intelligence system';

-- Add column comments
COMMENT ON COLUMN intelligence_metrics.metric_type IS 'Type of metric: accuracy, coverage, timeliness, sentiment_accuracy, prediction_success';
COMMENT ON COLUMN intelligence_metrics.metric_category IS 'Category: system, source, model, prediction, alert';
COMMENT ON COLUMN intelligence_metrics.calculation_method IS 'How the metric was calculated';
COMMENT ON COLUMN intelligence_metrics.data_sources IS 'Array of data sources used';
COMMENT ON COLUMN intelligence_metrics.confidence_level IS 'Confidence in the metric (0-100)';