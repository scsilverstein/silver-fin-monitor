-- Create feed sources configuration table
CREATE TABLE IF NOT EXISTS feed_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_feed_sources_type CHECK (
        type IN ('podcast', 'rss', 'youtube', 'api', 'multi_source', 'reddit')
    )
);

-- Add table comment
COMMENT ON TABLE feed_sources IS 'Configuration for all content feed sources (RSS, podcast, YouTube, API)';

-- Add column comments
COMMENT ON COLUMN feed_sources.id IS 'Unique identifier for the feed source';
COMMENT ON COLUMN feed_sources.name IS 'Human-readable name of the feed source';
COMMENT ON COLUMN feed_sources.type IS 'Type of feed source: podcast, rss, youtube, api, multi_source, reddit';
COMMENT ON COLUMN feed_sources.url IS 'URL endpoint for the feed source';
COMMENT ON COLUMN feed_sources.last_processed_at IS 'Timestamp of last successful processing';
COMMENT ON COLUMN feed_sources.is_active IS 'Whether this feed source is currently active';
COMMENT ON COLUMN feed_sources.config IS 'Feed-specific configuration (categories, priority, etc)';
COMMENT ON COLUMN feed_sources.created_at IS 'Timestamp when the feed source was created';
COMMENT ON COLUMN feed_sources.updated_at IS 'Timestamp when the feed source was last updated';