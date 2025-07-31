-- Create entity content mapping table
CREATE TABLE IF NOT EXISTS entity_content_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    content_id UUID NOT NULL,
    
    -- Relationship metadata
    relevance_score DECIMAL(5, 4),
    mention_type VARCHAR(50),
    mention_context TEXT,
    sentiment_impact DECIMAL(5, 4),
    
    -- Extracted metrics
    extracted_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_entity_content_mapping_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_entity_content_mapping_content 
        FOREIGN KEY (content_id) 
        REFERENCES processed_content(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_entity_content_mapping_relevance CHECK (
        relevance_score IS NULL OR relevance_score BETWEEN 0 AND 1
    ),
    
    CONSTRAINT chk_entity_content_mapping_mention CHECK (
        mention_type IS NULL OR 
        mention_type IN ('primary', 'secondary', 'industry', 'competitor')
    ),
    
    CONSTRAINT chk_entity_content_mapping_sentiment CHECK (
        sentiment_impact IS NULL OR sentiment_impact BETWEEN -1 AND 1
    ),
    
    CONSTRAINT uq_entity_content_mapping 
        UNIQUE(entity_id, content_id)
);

-- Add table comment
COMMENT ON TABLE entity_content_mapping IS 'Links entities to processed content with relevance scoring';

-- Add column comments
COMMENT ON COLUMN entity_content_mapping.relevance_score IS 'How relevant the entity is to the content (0-1)';
COMMENT ON COLUMN entity_content_mapping.mention_type IS 'Type of mention: primary, secondary, industry, competitor';
COMMENT ON COLUMN entity_content_mapping.mention_context IS 'Text context around the entity mention';
COMMENT ON COLUMN entity_content_mapping.sentiment_impact IS 'Sentiment impact on the entity (-1 to 1)';
COMMENT ON COLUMN entity_content_mapping.extracted_data IS 'Any numbers, dates, or facts extracted about the entity';