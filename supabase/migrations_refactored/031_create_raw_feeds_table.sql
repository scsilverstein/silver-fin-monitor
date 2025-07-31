-- Create raw feed data table
CREATE TABLE IF NOT EXISTS raw_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    title VARCHAR(500),
    description TEXT,
    content TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    external_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_raw_feeds_source_id 
        FOREIGN KEY (source_id) 
        REFERENCES feed_sources(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_raw_feeds_processing_status CHECK (
        processing_status IN ('pending', 'processing', 'completed', 'failed')
    ),
    
    CONSTRAINT uq_raw_feeds_source_external 
        UNIQUE(source_id, external_id)
);

-- Add table comment
COMMENT ON TABLE raw_feeds IS 'Raw feed items from feed sources before processing';

-- Add column comments
COMMENT ON COLUMN raw_feeds.id IS 'Unique identifier for the raw feed item';
COMMENT ON COLUMN raw_feeds.source_id IS 'Reference to the feed source this item came from';
COMMENT ON COLUMN raw_feeds.title IS 'Title of the feed item';
COMMENT ON COLUMN raw_feeds.description IS 'Description or summary from the feed';
COMMENT ON COLUMN raw_feeds.content IS 'Full content of the feed item';
COMMENT ON COLUMN raw_feeds.published_at IS 'Publication timestamp from the feed source';
COMMENT ON COLUMN raw_feeds.external_id IS 'Unique ID from the feed source (episode ID, article ID, etc)';
COMMENT ON COLUMN raw_feeds.metadata IS 'Additional metadata from the feed source';
COMMENT ON COLUMN raw_feeds.processing_status IS 'Current processing status: pending, processing, completed, failed';
COMMENT ON COLUMN raw_feeds.created_at IS 'Timestamp when the raw feed was ingested';