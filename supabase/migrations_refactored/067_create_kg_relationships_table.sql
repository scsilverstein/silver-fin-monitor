-- Create knowledge graph relationships table
CREATE TABLE IF NOT EXISTS kg_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core relationship
    subject_id UUID NOT NULL,
    predicate VARCHAR(100) NOT NULL,
    object_id UUID NOT NULL,
    
    -- Relationship strength and confidence
    strength DECIMAL(5, 2) DEFAULT 50.0,
    confidence DECIMAL(5, 2) DEFAULT 75.0,
    
    -- Temporal validity
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_to DATE,
    is_current BOOLEAN GENERATED ALWAYS AS (
        valid_to IS NULL OR valid_to >= CURRENT_DATE
    ) STORED,
    
    -- Relationship metadata
    properties JSONB DEFAULT '{}',
    context TEXT,
    
    -- Source tracking
    source_systems TEXT[] DEFAULT '{}',
    source_documents TEXT[] DEFAULT '{}',
    evidence_urls TEXT[] DEFAULT '{}',
    
    -- Quality tracking
    is_verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_kg_relationships_subject 
        FOREIGN KEY (subject_id) 
        REFERENCES kg_entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_kg_relationships_object 
        FOREIGN KEY (object_id) 
        REFERENCES kg_entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_kg_relationships_predicate 
        FOREIGN KEY (predicate) 
        REFERENCES kg_relationship_types(predicate),
    
    CONSTRAINT chk_kg_relationships_no_self CHECK (
        subject_id != object_id
    ),
    
    CONSTRAINT chk_kg_relationships_dates CHECK (
        valid_to IS NULL OR valid_from <= valid_to
    ),
    
    CONSTRAINT chk_kg_relationships_strength CHECK (
        strength BETWEEN 0 AND 100
    ),
    
    CONSTRAINT chk_kg_relationships_confidence CHECK (
        confidence BETWEEN 0 AND 100
    ),
    
    CONSTRAINT excl_kg_relationships_current 
        EXCLUDE USING gist (
            subject_id WITH =,
            predicate WITH =,
            object_id WITH =,
            daterange(valid_from, valid_to) WITH &&
        )
);

-- Add table comment
COMMENT ON TABLE kg_relationships IS 'Relationship table with temporal validity and type constraints';

-- Add column comments
COMMENT ON COLUMN kg_relationships.subject_id IS 'Entity that is the subject of the relationship';
COMMENT ON COLUMN kg_relationships.predicate IS 'Type of relationship (employs, owns, located_in, etc)';
COMMENT ON COLUMN kg_relationships.object_id IS 'Entity that is the object of the relationship';
COMMENT ON COLUMN kg_relationships.strength IS 'Strength of the relationship (0-100)';
COMMENT ON COLUMN kg_relationships.confidence IS 'Confidence in the relationship (0-100)';
COMMENT ON COLUMN kg_relationships.is_current IS 'Whether this relationship is currently valid';