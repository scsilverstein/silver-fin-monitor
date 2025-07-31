-- Create processed content table
CREATE TABLE IF NOT EXISTS processed_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_feed_id UUID NOT NULL,
    processed_text TEXT,
    key_topics TEXT[] DEFAULT '{}',
    sentiment_score FLOAT,
    entities JSONB DEFAULT '{}',
    summary TEXT,
    processing_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_processed_content_raw_feed 
        FOREIGN KEY (raw_feed_id) 
        REFERENCES raw_feeds(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_processed_content_sentiment CHECK (
        sentiment_score BETWEEN -1 AND 1
    )
);

-- Add table comment
COMMENT ON TABLE processed_content IS 'Processed and analyzed content from raw feeds';

-- Add column comments
COMMENT ON COLUMN processed_content.raw_feed_id IS 'Reference to the raw feed this content was processed from';
COMMENT ON COLUMN processed_content.processed_text IS 'Cleaned and processed text content';
COMMENT ON COLUMN processed_content.key_topics IS 'Array of key topics extracted from content';
COMMENT ON COLUMN processed_content.sentiment_score IS 'Sentiment score from -1 (negative) to 1 (positive)';
COMMENT ON COLUMN processed_content.entities IS 'Extracted entities {companies: [], people: [], locations: [], tickers: []}';
COMMENT ON COLUMN processed_content.summary IS 'AI-generated summary of the content';
COMMENT ON COLUMN processed_content.processing_metadata IS 'Metadata about processing (models used, versions, etc)';