-- Create feed source metrics table
CREATE TABLE IF NOT EXISTS feed_source_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    metric_date DATE NOT NULL,
    
    -- Processing metrics
    items_fetched INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    
    -- Quality metrics
    avg_content_length INTEGER,
    unique_entities_extracted INTEGER,
    sentiment_coverage DECIMAL(5, 2),
    
    -- Reliability metrics
    fetch_success_rate DECIMAL(5, 2),
    parse_success_rate DECIMAL(5, 2),
    uptime_percentage DECIMAL(5, 2),
    error_count INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_response_time_ms INTEGER,
    total_bytes_processed BIGINT,
    
    -- Detailed error tracking
    error_details JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_feed_source_metrics_source 
        FOREIGN KEY (source_id) 
        REFERENCES feed_sources(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_feed_source_metrics_rates CHECK (
        (fetch_success_rate IS NULL OR fetch_success_rate BETWEEN 0 AND 100) AND
        (parse_success_rate IS NULL OR parse_success_rate BETWEEN 0 AND 100) AND
        (uptime_percentage IS NULL OR uptime_percentage BETWEEN 0 AND 100) AND
        (sentiment_coverage IS NULL OR sentiment_coverage BETWEEN 0 AND 100)
    ),
    
    CONSTRAINT chk_feed_source_metrics_counts CHECK (
        items_fetched >= 0 AND
        items_processed >= 0 AND
        items_failed >= 0 AND
        error_count >= 0
    ),
    
    CONSTRAINT uq_feed_source_metrics_date 
        UNIQUE(source_id, metric_date)
);

-- Add table comment
COMMENT ON TABLE feed_source_metrics IS 'Track daily performance metrics for each feed source';

-- Add column comments
COMMENT ON COLUMN feed_source_metrics.processing_time_ms IS 'Total processing time in milliseconds';
COMMENT ON COLUMN feed_source_metrics.sentiment_coverage IS 'Percentage of items with sentiment analysis';
COMMENT ON COLUMN feed_source_metrics.fetch_success_rate IS 'Percentage of successful fetches';
COMMENT ON COLUMN feed_source_metrics.parse_success_rate IS 'Percentage of successful parses';
COMMENT ON COLUMN feed_source_metrics.error_details IS 'Array of {error_type, count, sample_message} objects';