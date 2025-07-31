-- Create knowledge graph entity mentions table
CREATE TABLE IF NOT EXISTS kg_entity_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    content_id UUID NOT NULL,
    
    -- Mention details
    mention_type VARCHAR(50) NOT NULL,
    mention_confidence DECIMAL(5, 2) DEFAULT 75.0,
    
    -- Position tracking
    mention_positions JSONB DEFAULT '[]',
    mention_count INTEGER DEFAULT 1,
    
    -- Context and analysis
    sentiment_score DECIMAL(5, 4),
    sentiment_magnitude DECIMAL(5, 4),
    relevance_score DECIMAL(5, 4),
    
    -- Extracted information
    extracted_facts JSONB DEFAULT '[]',
    extracted_relationships JSONB DEFAULT '[]',
    extracted_attributes JSONB DEFAULT '[]',
    
    -- Processing metadata
    extraction_method VARCHAR(100),
    extraction_model VARCHAR(100),
    is_verified BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_kg_entity_mentions_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES kg_entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_kg_entity_mentions_content 
        FOREIGN KEY (content_id) 
        REFERENCES processed_content(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_kg_entity_mentions_type CHECK (
        mention_type IN ('primary', 'secondary', 'quoted', 'referenced')
    ),
    
    CONSTRAINT chk_kg_entity_mentions_confidence CHECK (
        mention_confidence BETWEEN 0 AND 100
    ),
    
    CONSTRAINT chk_kg_entity_mentions_count CHECK (
        mention_count > 0
    ),
    
    CONSTRAINT chk_kg_entity_mentions_sentiment CHECK (
        sentiment_score IS NULL OR sentiment_score BETWEEN -1 AND 1
    ),
    
    CONSTRAINT chk_kg_entity_mentions_magnitude CHECK (
        sentiment_magnitude IS NULL OR sentiment_magnitude >= 0
    ),
    
    CONSTRAINT chk_kg_entity_mentions_relevance CHECK (
        relevance_score IS NULL OR relevance_score BETWEEN 0 AND 1
    ),
    
    CONSTRAINT uq_kg_entity_mentions 
        UNIQUE(entity_id, content_id)
);

-- Add table comment
COMMENT ON TABLE kg_entity_mentions IS 'Tracks entity mentions in content with confidence scoring';

-- Add column comments
COMMENT ON COLUMN kg_entity_mentions.mention_type IS 'Type of mention: primary, secondary, quoted, referenced';
COMMENT ON COLUMN kg_entity_mentions.mention_positions IS 'Array of {start, end, text} positions in content';
COMMENT ON COLUMN kg_entity_mentions.sentiment_score IS 'Sentiment towards entity in this content (-1 to 1)';
COMMENT ON COLUMN kg_entity_mentions.relevance_score IS 'How relevant the entity is to the content (0-1)';
COMMENT ON COLUMN kg_entity_mentions.extraction_method IS 'Method used to extract: nlp, regex, manual';