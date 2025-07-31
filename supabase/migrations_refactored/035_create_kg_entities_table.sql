-- Create knowledge graph entities table
CREATE TABLE IF NOT EXISTS kg_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core identification
    entity_type VARCHAR(50) NOT NULL,
    entity_subtype VARCHAR(50) NOT NULL,
    
    -- Names and identifiers
    name VARCHAR(500) NOT NULL,
    display_name VARCHAR(500) NOT NULL,
    canonical_name VARCHAR(500) NOT NULL,
    name_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', name)) STORED,
    
    -- Alternative identifiers
    aliases TEXT[] DEFAULT '{}',
    identifiers JSONB DEFAULT '{}',
    
    -- Common attributes
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    
    -- Quality and importance metrics
    importance_score DECIMAL(5, 2) DEFAULT 50.0,
    quality_score DECIMAL(5, 2) DEFAULT 50.0,
    completeness_score DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE 
            WHEN description IS NOT NULL THEN 20
            ELSE 0
        END +
        CASE 
            WHEN array_length(aliases, 1) > 0 THEN 20
            ELSE 0
        END +
        CASE 
            WHEN (identifiers->>'website') IS NOT NULL THEN 20
            ELSE 0
        END +
        CASE 
            WHEN is_verified THEN 40
            ELSE 0
        END
    ) STORED,
    
    -- Type-specific data
    properties JSONB DEFAULT '{}',
    
    -- Source and metadata
    source_systems TEXT[] DEFAULT '{}',
    external_ids JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_kg_entities_type_subtype 
        FOREIGN KEY (entity_type, entity_subtype) 
        REFERENCES kg_entity_types(entity_type, entity_subtype),
    
    CONSTRAINT uq_kg_entities_canonical 
        UNIQUE(entity_type, canonical_name),
    
    CONSTRAINT chk_kg_entities_canonical_uppercase 
        CHECK (canonical_name = UPPER(canonical_name)),
    
    CONSTRAINT chk_kg_entities_importance CHECK (
        importance_score BETWEEN 0 AND 100
    ),
    
    CONSTRAINT chk_kg_entities_quality CHECK (
        quality_score BETWEEN 0 AND 100
    )
);

-- Add table comment
COMMENT ON TABLE kg_entities IS 'Core entity table for knowledge graph - stores all types of entities with validation';

-- Add column comments
COMMENT ON COLUMN kg_entities.entity_type IS 'High-level entity type: security, person, organization, place, event, topic';
COMMENT ON COLUMN kg_entities.entity_subtype IS 'Specific subtype within entity type';
COMMENT ON COLUMN kg_entities.canonical_name IS 'Uppercase standardized name for deduplication';
COMMENT ON COLUMN kg_entities.name_vector IS 'Full-text search vector for entity names';
COMMENT ON COLUMN kg_entities.importance_score IS 'Entity importance from 0-100';
COMMENT ON COLUMN kg_entities.quality_score IS 'Data quality score from 0-100';
COMMENT ON COLUMN kg_entities.completeness_score IS 'Calculated completeness based on filled fields';