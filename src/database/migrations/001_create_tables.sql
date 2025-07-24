-- Feed Sources Configuration
CREATE TABLE IF NOT EXISTS feed_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'podcast', 'rss', 'youtube', 'api'
    url TEXT NOT NULL,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}', -- source-specific configuration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw Feed Data
CREATE TABLE IF NOT EXISTS raw_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    title VARCHAR(500),
    description TEXT,
    content TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    external_id VARCHAR(255), -- podcast episode ID, article ID, etc.
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_id, external_id)
);

-- Processed Content
CREATE TABLE IF NOT EXISTS processed_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_feed_id UUID NOT NULL REFERENCES raw_feeds(id) ON DELETE CASCADE,
    processed_text TEXT,
    key_topics TEXT[] DEFAULT '{}',
    sentiment_score FLOAT CHECK (sentiment_score BETWEEN -1 AND 1),
    entities JSONB DEFAULT '{}',
    summary TEXT,
    processing_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Market Analysis
CREATE TABLE IF NOT EXISTS daily_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    market_sentiment VARCHAR(50),
    key_themes TEXT[] DEFAULT '{}',
    overall_summary TEXT,
    ai_analysis JSONB DEFAULT '{}',
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    sources_analyzed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(analysis_date)
);

-- Predictions
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_analysis_id UUID REFERENCES daily_analysis(id),
    prediction_type VARCHAR(100), -- 'market_direction', 'economic_indicator', 'geopolitical_event'
    prediction_text TEXT,
    confidence_level FLOAT CHECK (confidence_level BETWEEN 0 AND 1),
    time_horizon VARCHAR(50), -- '1_week', '1_month', '3_months', '6_months', '1_year'
    prediction_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Database-Based Job Queue (replaces Bull/Redis)
CREATE TABLE IF NOT EXISTS job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL, -- 'feed_fetch', 'content_process', 'daily_analysis', 'prediction_compare'
    priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'retry'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure jobs are processed once
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry'))
);

-- Database-Based Simple Cache (replaces Redis)
CREATE TABLE IF NOT EXISTS cache_store (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_feeds_source_published ON raw_feeds(source_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_feeds_status ON raw_feeds(processing_status);
CREATE INDEX IF NOT EXISTS idx_daily_analysis_date ON daily_analysis(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_analysis ON predictions(daily_analysis_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_queue_processing ON job_queue(status, priority, scheduled_at) WHERE status IN ('pending', 'retry');
CREATE INDEX IF NOT EXISTS idx_job_queue_cleanup ON job_queue(expires_at) WHERE status IN ('completed', 'failed');
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_store(expires_at);