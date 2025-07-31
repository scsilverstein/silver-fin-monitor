-- Create indexes for knowledge graph tables
-- Critical for graph query performance

-- kg_entities indexes
CREATE INDEX IF NOT EXISTS idx_kg_entities_type 
ON kg_entities(entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kg_entities_confidence 
ON kg_entities(confidence_score DESC) 
WHERE confidence_score > 0.8;

CREATE INDEX IF NOT EXISTS idx_kg_entities_search 
ON kg_entities USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_kg_entities_properties 
ON kg_entities USING GIN(properties);

CREATE INDEX IF NOT EXISTS idx_kg_entities_vector 
ON kg_entities USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- kg_relationships indexes
CREATE INDEX IF NOT EXISTS idx_kg_relationships_source 
ON kg_relationships(source_entity_id, relationship_type);

CREATE INDEX IF NOT EXISTS idx_kg_relationships_target 
ON kg_relationships(target_entity_id, relationship_type);

CREATE INDEX IF NOT EXISTS idx_kg_relationships_type 
ON kg_relationships(relationship_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kg_relationships_strength 
ON kg_relationships(strength DESC) 
WHERE strength > 0.5;

CREATE INDEX IF NOT EXISTS idx_kg_relationships_temporal 
ON kg_relationships(valid_from, valid_to) 
WHERE valid_to IS NULL OR valid_to > NOW();

-- kg_entity_attributes indexes
CREATE INDEX IF NOT EXISTS idx_kg_entity_attributes_entity 
ON kg_entity_attributes(entity_id, attribute_name);

CREATE INDEX IF NOT EXISTS idx_kg_entity_attributes_name 
ON kg_entity_attributes(attribute_name, attribute_value);

CREATE INDEX IF NOT EXISTS idx_kg_entity_attributes_temporal 
ON kg_entity_attributes(valid_from DESC, valid_to DESC NULLS FIRST);

-- Add index comments
COMMENT ON INDEX idx_kg_entities_type IS 'Filter entities by type';
COMMENT ON INDEX idx_kg_entities_confidence IS 'High confidence entities';
COMMENT ON INDEX idx_kg_entities_search IS 'Full text entity search';
COMMENT ON INDEX idx_kg_entities_properties IS 'Entity property queries';
COMMENT ON INDEX idx_kg_entities_vector IS 'Vector similarity search';
COMMENT ON INDEX idx_kg_relationships_source IS 'Source entity relationships';
COMMENT ON INDEX idx_kg_relationships_target IS 'Target entity relationships';
COMMENT ON INDEX idx_kg_relationships_type IS 'Relationship type queries';
COMMENT ON INDEX idx_kg_relationships_strength IS 'Strong relationships';
COMMENT ON INDEX idx_kg_relationships_temporal IS 'Valid relationships';
COMMENT ON INDEX idx_kg_entity_attributes_entity IS 'Entity attribute lookup';
COMMENT ON INDEX idx_kg_entity_attributes_name IS 'Attribute name-value pairs';
COMMENT ON INDEX idx_kg_entity_attributes_temporal IS 'Temporal attribute queries';