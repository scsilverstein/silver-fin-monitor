-- Create knowledge graph triggers
-- Triggers for maintaining knowledge graph relationships and data integrity

-- Trigger function for entity relationship maintenance
CREATE OR REPLACE FUNCTION maintain_entity_relationships()
RETURNS TRIGGER AS $$
DECLARE
    related_entities UUID[];
    entity_id UUID;
BEGIN
    -- Extract entity mentions from processed content
    IF TG_TABLE_NAME = 'processed_content' AND TG_OP IN ('INSERT', 'UPDATE') THEN
        -- Find entities mentioned in the content
        SELECT ARRAY_AGG(DISTINCT e.id) INTO related_entities
        FROM entities e
        WHERE (
            NEW.processed_text ILIKE '%' || e.name || '%' OR
            (e.symbol IS NOT NULL AND NEW.processed_text ILIKE '%' || e.symbol || '%')
        )
        AND e.is_active = true;
        
        -- Create or update relationships between entities
        IF related_entities IS NOT NULL AND array_length(related_entities, 1) > 1 THEN
            -- Create relationships between co-mentioned entities
            FOR i IN 1..array_length(related_entities, 1) LOOP
                FOR j IN (i+1)..array_length(related_entities, 1) LOOP
                    INSERT INTO kg_relationships (
                        source_entity_id,
                        target_entity_id,
                        relationship_type,
                        strength,
                        context_data,
                        created_at
                    ) VALUES (
                        related_entities[i],
                        related_entities[j],
                        'co_mentioned',
                        0.1, -- Base strength for co-mention
                        jsonb_build_object(
                            'content_id', NEW.id,
                            'mention_type', 'content'
                        ),
                        NOW()
                    )
                    ON CONFLICT (source_entity_id, target_entity_id, relationship_type) 
                    DO UPDATE SET
                        strength = kg_relationships.strength + 0.05,
                        updated_at = NOW(),
                        context_data = kg_relationships.context_data || 
                                     jsonb_build_object('last_mention', NOW());
                END LOOP;
            END LOOP;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for entity confidence scoring
CREATE OR REPLACE FUNCTION update_entity_confidence()
RETURNS TRIGGER AS $$
DECLARE
    mention_count INTEGER;
    relationship_count INTEGER;
    new_confidence DECIMAL(5, 2);
BEGIN
    -- Calculate confidence based on mentions and relationships
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        -- Count mentions in processed content
        SELECT COUNT(*) INTO mention_count
        FROM processed_content pc
        WHERE pc.processed_text ILIKE '%' || NEW.name || '%'
        OR (NEW.symbol IS NOT NULL AND pc.processed_text ILIKE '%' || NEW.symbol || '%');
        
        -- Count relationships
        SELECT COUNT(*) INTO relationship_count
        FROM kg_relationships kr
        WHERE kr.source_entity_id = NEW.id OR kr.target_entity_id = NEW.id;
        
        -- Calculate confidence score (0-100)
        new_confidence := LEAST(100, 
            (mention_count * 5) + (relationship_count * 2) + 
            CASE 
                WHEN NEW.entity_type = 'stock' THEN 20  -- Higher base for stocks
                WHEN NEW.entity_type = 'company' THEN 15
                ELSE 10
            END
        );
        
        NEW.confidence_score := new_confidence;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for relationship strength decay
CREATE OR REPLACE FUNCTION decay_relationship_strength()
RETURNS TRIGGER AS $$
BEGIN
    -- Decay relationship strength over time for inactive relationships
    IF TG_OP = 'UPDATE' AND OLD.updated_at < NOW() - INTERVAL '30 days' THEN
        NEW.strength := GREATEST(0.01, NEW.strength * 0.95);  -- 5% decay
        
        -- Mark for deletion if strength becomes too low
        IF NEW.strength < 0.05 THEN
            NEW.valid_to := NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for entity clustering updates
CREATE OR REPLACE FUNCTION update_entity_clusters()
RETURNS TRIGGER AS $$
DECLARE
    affected_entities UUID[];
BEGIN
    -- When relationships change, mark related entities for re-clustering
    IF TG_TABLE_NAME = 'kg_relationships' THEN
        affected_entities := ARRAY[
            COALESCE(NEW.source_entity_id, OLD.source_entity_id),
            COALESCE(NEW.target_entity_id, OLD.target_entity_id)
        ];
        
        -- Queue clustering job for affected entities
        PERFORM enqueue_job(
            'update_entity_clusters',
            jsonb_build_object(
                'entity_ids', affected_entities,
                'trigger', 'relationship_change'
            ),
            4  -- Lower priority
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for temporal relationship validation
CREATE OR REPLACE FUNCTION validate_temporal_relationships()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure valid_from <= valid_to
    IF NEW.valid_to IS NOT NULL AND NEW.valid_from > NEW.valid_to THEN
        RAISE EXCEPTION 'Relationship valid_from cannot be after valid_to';
    END IF;
    
    -- Set valid_from to now if not specified
    IF NEW.valid_from IS NULL THEN
        NEW.valid_from := NOW();
    END IF;
    
    -- Validate strength is within bounds
    IF NEW.strength < 0 OR NEW.strength > 1 THEN
        RAISE EXCEPTION 'Relationship strength must be between 0 and 1';
    END IF;
    
    -- Prevent self-relationships
    IF NEW.source_entity_id = NEW.target_entity_id THEN
        RAISE EXCEPTION 'Entity cannot have relationship with itself';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for entity attribute history
CREATE OR REPLACE FUNCTION track_entity_attribute_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Track changes to entity attributes
    IF TG_OP = 'UPDATE' AND OLD.metadata != NEW.metadata THEN
        -- Insert into attribute history
        INSERT INTO kg_entity_attributes (
            entity_id,
            attribute_name,
            attribute_value,
            attribute_type,
            valid_from,
            source_type,
            confidence_score
        ) 
        SELECT 
            NEW.id,
            'metadata_change',
            jsonb_build_object(
                'old_value', OLD.metadata,
                'new_value', NEW.metadata,
                'changed_fields', (
                    SELECT jsonb_object_agg(key, value)
                    FROM jsonb_each(NEW.metadata)
                    WHERE NOT (OLD.metadata ? key) OR OLD.metadata->key != value
                )
            ),
            'json',
            NOW(),
            'system',
            0.9;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply knowledge graph triggers
CREATE TRIGGER maintain_entity_relationships_trigger
    AFTER INSERT OR UPDATE ON processed_content
    FOR EACH ROW EXECUTE FUNCTION maintain_entity_relationships();

CREATE TRIGGER update_entity_confidence_trigger
    BEFORE INSERT OR UPDATE ON kg_entities
    FOR EACH ROW EXECUTE FUNCTION update_entity_confidence();

CREATE TRIGGER decay_relationship_strength_trigger
    BEFORE UPDATE ON kg_relationships
    FOR EACH ROW EXECUTE FUNCTION decay_relationship_strength();

CREATE TRIGGER update_entity_clusters_trigger
    AFTER INSERT OR UPDATE OR DELETE ON kg_relationships
    FOR EACH ROW EXECUTE FUNCTION update_entity_clusters();

CREATE TRIGGER validate_temporal_relationships_trigger
    BEFORE INSERT OR UPDATE ON kg_relationships
    FOR EACH ROW EXECUTE FUNCTION validate_temporal_relationships();

CREATE TRIGGER track_entity_attribute_changes_trigger
    AFTER UPDATE ON kg_entities
    FOR EACH ROW EXECUTE FUNCTION track_entity_attribute_changes();

-- Add trigger comments
COMMENT ON FUNCTION maintain_entity_relationships IS 'Automatically create relationships between co-mentioned entities';
COMMENT ON FUNCTION update_entity_confidence IS 'Update entity confidence based on mentions and relationships';
COMMENT ON FUNCTION decay_relationship_strength IS 'Decay inactive relationship strengths over time';
COMMENT ON FUNCTION update_entity_clusters IS 'Queue entity clustering updates when relationships change';
COMMENT ON FUNCTION validate_temporal_relationships IS 'Validate temporal relationship constraints';
COMMENT ON FUNCTION track_entity_attribute_changes IS 'Track changes to entity attributes';

COMMENT ON TRIGGER maintain_entity_relationships_trigger ON processed_content IS 'Create entity relationships from content';
COMMENT ON TRIGGER update_entity_confidence_trigger ON kg_entities IS 'Update entity confidence scores';
COMMENT ON TRIGGER decay_relationship_strength_trigger ON kg_relationships IS 'Decay inactive relationship strength';
COMMENT ON TRIGGER update_entity_clusters_trigger ON kg_relationships IS 'Update entity clusters on relationship changes';
COMMENT ON TRIGGER validate_temporal_relationships_trigger ON kg_relationships IS 'Validate temporal relationship data';
COMMENT ON TRIGGER track_entity_attribute_changes_trigger ON kg_entities IS 'Track entity attribute history';