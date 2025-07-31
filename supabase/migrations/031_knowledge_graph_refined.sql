-- Refined Knowledge Graph Entity System
-- Implements best practices for graph databases, data quality, and performance

-- =====================================================
-- PART 1: DROP AND RECREATE WITH IMPROVEMENTS
-- =====================================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS kg_entity_mentions CASCADE;
DROP TABLE IF EXISTS kg_entity_attributes CASCADE;
DROP TABLE IF EXISTS kg_relationships CASCADE;
DROP TABLE IF EXISTS kg_entities CASCADE;

-- =====================================================
-- PART 2: ENTITY TYPE DEFINITIONS
-- =====================================================

-- Define valid entity types and subtypes
CREATE TABLE kg_entity_types (
    entity_type VARCHAR(50) PRIMARY KEY,
    entity_subtype VARCHAR(50) NOT NULL,
    description TEXT,
    schema_version VARCHAR(10) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entity_type, entity_subtype)
);

-- Seed entity types
INSERT INTO kg_entity_types (entity_type, entity_subtype, description) VALUES
    ('security', 'stock', 'Publicly traded company stock'),
    ('security', 'etf', 'Exchange-traded fund'),
    ('security', 'mutual_fund', 'Mutual fund'),
    ('security', 'bond', 'Corporate or government bond'),
    ('person', 'executive', 'C-suite executive (CEO, CFO, etc.)'),
    ('person', 'director', 'Board member'),
    ('person', 'analyst', 'Financial analyst'),
    ('person', 'investor', 'Notable investor or fund manager'),
    ('organization', 'public_company', 'Publicly traded company'),
    ('organization', 'private_company', 'Private company'),
    ('organization', 'government', 'Government agency or regulator'),
    ('organization', 'nonprofit', 'Non-profit organization'),
    ('place', 'country', 'Country'),
    ('place', 'state', 'State or province'),
    ('place', 'city', 'City or town'),
    ('place', 'region', 'Geographic region'),
    ('event', 'earnings', 'Earnings announcement'),
    ('event', 'product_launch', 'Product or service launch'),
    ('event', 'merger', 'Merger or acquisition'),
    ('event', 'regulatory', 'Regulatory action or filing'),
    ('topic', 'industry', 'Industry classification'),
    ('topic', 'technology', 'Technology or innovation'),
    ('topic', 'theme', 'Market theme or trend');

-- =====================================================
-- PART 3: RELATIONSHIP TYPE DEFINITIONS
-- =====================================================

-- Define valid relationship types
CREATE TABLE kg_relationship_types (
    predicate VARCHAR(100) PRIMARY KEY,
    inverse_predicate VARCHAR(100),
    relationship_category VARCHAR(50) NOT NULL, -- 'employment', 'ownership', 'location', etc.
    subject_types VARCHAR(50)[] NOT NULL, -- Valid subject entity types
    object_types VARCHAR(50)[] NOT NULL,  -- Valid object entity types
    description TEXT,
    is_symmetric BOOLEAN DEFAULT false,
    is_transitive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed relationship types
INSERT INTO kg_relationship_types (
    predicate, inverse_predicate, relationship_category, 
    subject_types, object_types, description
) VALUES
    ('employs', 'employed_by', 'employment', 
     ARRAY['organization'], ARRAY['person'], 'Organization employs person'),
    ('owns', 'owned_by', 'ownership', 
     ARRAY['organization', 'person'], ARRAY['security', 'organization'], 'Entity owns another entity'),
    ('located_in', 'location_of', 'location', 
     ARRAY['organization', 'person', 'event'], ARRAY['place'], 'Entity is located in place'),
    ('competes_with', 'competes_with', 'competition', 
     ARRAY['organization'], ARRAY['organization'], 'Organizations compete', true, false),
    ('supplies', 'supplied_by', 'supply_chain', 
     ARRAY['organization'], ARRAY['organization'], 'Supplier relationship'),
    ('regulates', 'regulated_by', 'regulatory', 
     ARRAY['organization'], ARRAY['organization', 'security'], 'Regulatory oversight'),
    ('invests_in', 'invested_by', 'investment', 
     ARRAY['person', 'organization'], ARRAY['security', 'organization'], 'Investment relationship'),
    ('advises', 'advised_by', 'advisory', 
     ARRAY['person', 'organization'], ARRAY['organization', 'person'], 'Advisory relationship'),
    ('covers', 'covered_by', 'coverage', 
     ARRAY['person'], ARRAY['security', 'organization'], 'Analyst coverage'),
    ('subsidiary_of', 'parent_of', 'corporate_structure', 
     ARRAY['organization'], ARRAY['organization'], 'Subsidiary relationship', false, true);

-- =====================================================
-- PART 4: IMPROVED ENTITIES TABLE
-- =====================================================

CREATE TABLE kg_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core identification (with better constraints)
    entity_type VARCHAR(50) NOT NULL,
    entity_subtype VARCHAR(50) NOT NULL,
    
    -- Names and identifiers
    name VARCHAR(500) NOT NULL,
    display_name VARCHAR(500) NOT NULL, -- How to show in UI
    canonical_name VARCHAR(500) NOT NULL, -- Uppercase, standardized
    name_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', name)) STORED,
    
    -- Alternative identifiers
    aliases TEXT[] DEFAULT '{}',
    identifiers JSONB DEFAULT '{}', -- {ticker: 'AAPL', cusip: '...', lei: '...'}
    
    -- Common attributes
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false, -- Human or trusted source verified
    
    -- Quality and importance metrics
    importance_score DECIMAL(5, 2) DEFAULT 50.0 CHECK (importance_score BETWEEN 0 AND 100),
    quality_score DECIMAL(5, 2) DEFAULT 50.0 CHECK (quality_score BETWEEN 0 AND 100),
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
    
    -- Type-specific data (JSONB for flexibility with validation)
    properties JSONB DEFAULT '{}',
    
    -- Source and metadata
    source_systems TEXT[] DEFAULT '{}',
    external_ids JSONB DEFAULT '{}', -- {wikidata: 'Q312', bloomberg: '...'}
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_entity_type_subtype 
        FOREIGN KEY (entity_type, entity_subtype) 
        REFERENCES kg_entity_types(entity_type, entity_subtype),
    CONSTRAINT unique_canonical_name 
        UNIQUE(entity_type, canonical_name),
    CONSTRAINT canonical_name_uppercase 
        CHECK (canonical_name = UPPER(canonical_name))
);

-- =====================================================
-- PART 5: IMPROVED RELATIONSHIPS TABLE
-- =====================================================

CREATE TABLE kg_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core relationship
    subject_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
    predicate VARCHAR(100) NOT NULL REFERENCES kg_relationship_types(predicate),
    object_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
    
    -- Relationship strength and confidence
    strength DECIMAL(5, 2) DEFAULT 50.0 CHECK (strength BETWEEN 0 AND 100),
    confidence DECIMAL(5, 2) DEFAULT 75.0 CHECK (confidence BETWEEN 0 AND 100),
    
    -- Temporal validity with better constraints
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_to DATE,
    is_current BOOLEAN GENERATED ALWAYS AS (
        valid_to IS NULL OR valid_to >= CURRENT_DATE
    ) STORED,
    
    -- Relationship metadata
    properties JSONB DEFAULT '{}', -- Type-specific properties
    context TEXT, -- Human-readable context
    
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
    CONSTRAINT no_self_relationship CHECK (subject_id != object_id),
    CONSTRAINT valid_date_range CHECK (valid_to IS NULL OR valid_from <= valid_to),
    CONSTRAINT unique_current_relationship 
        EXCLUDE USING gist (
            subject_id WITH =,
            predicate WITH =,
            object_id WITH =,
            daterange(valid_from, valid_to) WITH &&
        )
);

-- =====================================================
-- PART 6: IMPROVED ATTRIBUTES TABLE
-- =====================================================

CREATE TABLE kg_entity_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
    
    -- Attribute definition with better structure
    attribute_category VARCHAR(100) NOT NULL, -- 'financial', 'contact', 'social'
    attribute_name VARCHAR(200) NOT NULL,
    attribute_value TEXT,
    attribute_type VARCHAR(50) NOT NULL, -- 'string', 'number', 'date', 'json'
    
    -- Structured value storage
    value_text TEXT,
    value_numeric DECIMAL,
    value_date DATE,
    value_json JSONB,
    
    -- Temporal validity
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_to DATE,
    is_current BOOLEAN GENERATED ALWAYS AS (
        valid_to IS NULL OR valid_to >= CURRENT_DATE
    ) STORED,
    
    -- Metadata
    unit VARCHAR(50), -- 'USD', 'percent', 'millions'
    precision_digits INTEGER, -- For numeric values
    confidence DECIMAL(5, 2) DEFAULT 75.0 CHECK (confidence BETWEEN 0 AND 100),
    
    -- Source tracking
    source_system VARCHAR(100),
    source_document VARCHAR(500),
    is_verified BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_attribute_type CHECK (
        (attribute_type = 'string' AND value_text IS NOT NULL) OR
        (attribute_type = 'number' AND value_numeric IS NOT NULL) OR
        (attribute_type = 'date' AND value_date IS NOT NULL) OR
        (attribute_type = 'json' AND value_json IS NOT NULL)
    ),
    CONSTRAINT unique_current_attribute 
        EXCLUDE USING gist (
            entity_id WITH =,
            attribute_category WITH =,
            attribute_name WITH =,
            daterange(valid_from, valid_to) WITH &&
        )
);

-- =====================================================
-- PART 7: IMPROVED ENTITY MENTIONS
-- =====================================================

CREATE TABLE kg_entity_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES processed_content(id) ON DELETE CASCADE,
    
    -- Mention details with better structure
    mention_type VARCHAR(50) NOT NULL, -- 'primary', 'secondary', 'quoted', 'referenced'
    mention_confidence DECIMAL(5, 2) DEFAULT 75.0 CHECK (mention_confidence BETWEEN 0 AND 100),
    
    -- Position tracking (for highlighting)
    mention_positions JSONB DEFAULT '[]', -- [{start: 100, end: 110, text: "Apple Inc."}]
    mention_count INTEGER DEFAULT 1 CHECK (mention_count > 0),
    
    -- Context and analysis
    sentiment_score DECIMAL(5, 4) CHECK (sentiment_score BETWEEN -1 AND 1),
    sentiment_magnitude DECIMAL(5, 4) CHECK (sentiment_magnitude >= 0),
    relevance_score DECIMAL(5, 4) CHECK (relevance_score BETWEEN 0 AND 1),
    
    -- Extracted information
    extracted_facts JSONB DEFAULT '[]',
    extracted_relationships JSONB DEFAULT '[]', -- Potential relationships to create
    extracted_attributes JSONB DEFAULT '[]', -- Potential attributes to add
    
    -- Processing metadata
    extraction_method VARCHAR(100), -- 'nlp', 'regex', 'manual'
    extraction_model VARCHAR(100), -- Model/version used
    is_verified BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, content_id)
);

-- =====================================================
-- PART 8: AUDIT AND HISTORY TABLES
-- =====================================================

-- Entity change history
CREATE TABLE kg_entity_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_by VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    change_reason TEXT
);

-- Relationship change history
CREATE TABLE kg_relationship_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_by VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    change_reason TEXT
);

-- =====================================================
-- PART 9: IMPROVED INDEXES
-- =====================================================

-- Entity indexes
CREATE INDEX idx_kg_entities_type_subtype ON kg_entities(entity_type, entity_subtype);
CREATE INDEX idx_kg_entities_canonical ON kg_entities(canonical_name);
CREATE INDEX idx_kg_entities_name_fts ON kg_entities USING GIN(name_vector);
CREATE INDEX idx_kg_entities_aliases ON kg_entities USING GIN(aliases);
CREATE INDEX idx_kg_entities_identifiers ON kg_entities USING GIN(identifiers);
CREATE INDEX idx_kg_entities_active_important ON kg_entities(importance_score DESC) 
    WHERE is_active = true AND is_verified = true;
CREATE INDEX idx_kg_entities_quality ON kg_entities(quality_score DESC, completeness_score DESC);

-- Relationship indexes
CREATE INDEX idx_kg_relationships_subject ON kg_relationships(subject_id);
CREATE INDEX idx_kg_relationships_object ON kg_relationships(object_id);
CREATE INDEX idx_kg_relationships_predicate ON kg_relationships(predicate);
CREATE INDEX idx_kg_relationships_current ON kg_relationships(subject_id, predicate, object_id) 
    WHERE is_current = true;
CREATE INDEX idx_kg_relationships_temporal ON kg_relationships USING GIST(
    daterange(valid_from, valid_to)
);

-- Attribute indexes
CREATE INDEX idx_kg_attributes_entity_category ON kg_entity_attributes(entity_id, attribute_category);
CREATE INDEX idx_kg_attributes_current ON kg_entity_attributes(entity_id, attribute_category) 
    WHERE is_current = true;
CREATE INDEX idx_kg_attributes_numeric ON kg_entity_attributes(attribute_name, value_numeric) 
    WHERE attribute_type = 'number';

-- Mention indexes
CREATE INDEX idx_kg_mentions_entity ON kg_entity_mentions(entity_id);
CREATE INDEX idx_kg_mentions_content ON kg_entity_mentions(content_id);
CREATE INDEX idx_kg_mentions_sentiment ON kg_entity_mentions(sentiment_score) 
    WHERE sentiment_score IS NOT NULL;
CREATE INDEX idx_kg_mentions_relevance ON kg_entity_mentions(relevance_score DESC);

-- =====================================================
-- PART 10: VALIDATION FUNCTIONS
-- =====================================================

-- Validate entity data
CREATE OR REPLACE FUNCTION validate_entity_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure canonical name is uppercase
    NEW.canonical_name := UPPER(NEW.canonical_name);
    
    -- Ensure display name is set
    IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
        NEW.display_name := NEW.name;
    END IF;
    
    -- Validate identifiers based on entity type
    IF NEW.entity_type = 'security' AND NEW.entity_subtype = 'stock' THEN
        IF NOT (NEW.identifiers ? 'ticker') THEN
            RAISE EXCEPTION 'Stock entities must have a ticker identifier';
        END IF;
    END IF;
    
    -- Update timestamp
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_entity_data_trigger
    BEFORE INSERT OR UPDATE ON kg_entities
    FOR EACH ROW EXECUTE FUNCTION validate_entity_data();

-- Validate relationship data
CREATE OR REPLACE FUNCTION validate_relationship_data()
RETURNS TRIGGER AS $$
DECLARE
    v_subject_type VARCHAR(50);
    v_object_type VARCHAR(50);
    v_rel_type RECORD;
BEGIN
    -- Get entity types
    SELECT entity_type INTO v_subject_type FROM kg_entities WHERE id = NEW.subject_id;
    SELECT entity_type INTO v_object_type FROM kg_entities WHERE id = NEW.object_id;
    
    -- Get relationship type definition
    SELECT * INTO v_rel_type FROM kg_relationship_types WHERE predicate = NEW.predicate;
    
    -- Validate entity types match relationship definition
    IF NOT (v_subject_type = ANY(v_rel_type.subject_types)) THEN
        RAISE EXCEPTION 'Invalid subject type % for predicate %', v_subject_type, NEW.predicate;
    END IF;
    
    IF NOT (v_object_type = ANY(v_rel_type.object_types)) THEN
        RAISE EXCEPTION 'Invalid object type % for predicate %', v_object_type, NEW.predicate;
    END IF;
    
    -- Update timestamp
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_relationship_data_trigger
    BEFORE INSERT OR UPDATE ON kg_relationships
    FOR EACH ROW EXECUTE FUNCTION validate_relationship_data();

-- =====================================================
-- PART 11: AUDIT TRIGGERS
-- =====================================================

-- Entity audit trigger
CREATE OR REPLACE FUNCTION audit_entity_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO kg_entity_history (
            entity_id, operation, old_values, changed_by
        ) VALUES (
            OLD.id, TG_OP, row_to_json(OLD), current_user
        );
        RETURN OLD;
    ELSE
        INSERT INTO kg_entity_history (
            entity_id, operation, old_values, new_values, changed_by
        ) VALUES (
            NEW.id, TG_OP, 
            CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
            row_to_json(NEW), 
            current_user
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_entity_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON kg_entities
    FOR EACH ROW EXECUTE FUNCTION audit_entity_changes();

-- =====================================================
-- PART 12: HELPER FUNCTIONS
-- =====================================================

-- Improved entity search with ranking
CREATE OR REPLACE FUNCTION search_entities(
    search_query TEXT,
    entity_types VARCHAR(50)[] DEFAULT NULL,
    limit_results INTEGER DEFAULT 20
) RETURNS TABLE (
    entity_id UUID,
    entity_type VARCHAR(50),
    name VARCHAR(500),
    display_name VARCHAR(500),
    match_type VARCHAR(50),
    relevance_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH search_terms AS (
        SELECT 
            search_query as original,
            UPPER(search_query) as uppercase,
            to_tsquery('english', search_query) as tsquery
    ),
    matches AS (
        SELECT 
            e.id as entity_id,
            e.entity_type,
            e.name,
            e.display_name,
            CASE 
                WHEN e.canonical_name = st.uppercase THEN 'exact_canonical'
                WHEN (e.identifiers->>'ticker') = st.uppercase THEN 'exact_ticker'
                WHEN UPPER(e.name) = st.uppercase THEN 'exact_name'
                WHEN st.uppercase = ANY(SELECT UPPER(unnest(e.aliases))) THEN 'exact_alias'
                WHEN e.name_vector @@ st.tsquery THEN 'fulltext'
                WHEN e.canonical_name LIKE '%' || st.uppercase || '%' THEN 'partial_canonical'
                WHEN e.name ILIKE '%' || st.original || '%' THEN 'partial_name'
                ELSE 'other'
            END as match_type,
            CASE 
                WHEN e.canonical_name = st.uppercase THEN 1.0
                WHEN (e.identifiers->>'ticker') = st.uppercase THEN 0.95
                WHEN UPPER(e.name) = st.uppercase THEN 0.9
                WHEN st.uppercase = ANY(SELECT UPPER(unnest(e.aliases))) THEN 0.85
                WHEN e.name_vector @@ st.tsquery THEN 0.7
                WHEN e.canonical_name LIKE st.uppercase || '%' THEN 0.6
                WHEN e.canonical_name LIKE '%' || st.uppercase || '%' THEN 0.5
                WHEN e.name ILIKE '%' || st.original || '%' THEN 0.4
                ELSE 0.3
            END * 
            (e.importance_score / 100.0) * 
            (e.quality_score / 100.0) *
            CASE WHEN e.is_verified THEN 1.2 ELSE 1.0 END as relevance_score
        FROM kg_entities e
        CROSS JOIN search_terms st
        WHERE 
            e.is_active = true
            AND (entity_types IS NULL OR e.entity_type = ANY(entity_types))
            AND (
                e.canonical_name LIKE '%' || st.uppercase || '%' OR
                e.name ILIKE '%' || st.original || '%' OR
                st.uppercase = ANY(SELECT UPPER(unnest(e.aliases))) OR
                e.name_vector @@ st.tsquery OR
                EXISTS (
                    SELECT 1 FROM jsonb_each_text(e.identifiers) 
                    WHERE value ILIKE '%' || st.original || '%'
                )
            )
    )
    SELECT * FROM matches
    ORDER BY relevance_score DESC, match_type
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

-- Get entity with all relationships and attributes
CREATE OR REPLACE FUNCTION get_entity_details(entity_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'entity', row_to_json(e.*),
        'attributes', (
            SELECT jsonb_object_agg(
                a.attribute_name,
                jsonb_build_object(
                    'value', COALESCE(a.value_text, a.value_numeric::text, a.value_date::text, a.value_json::text),
                    'type', a.attribute_type,
                    'category', a.attribute_category,
                    'unit', a.unit,
                    'confidence', a.confidence,
                    'valid_from', a.valid_from,
                    'valid_to', a.valid_to
                )
            )
            FROM kg_entity_attributes a
            WHERE a.entity_id = e.id AND a.is_current = true
        ),
        'relationships_outgoing', (
            SELECT json_agg(json_build_object(
                'predicate', r.predicate,
                'object_id', r.object_id,
                'object_name', o.display_name,
                'object_type', o.entity_type,
                'strength', r.strength,
                'confidence', r.confidence,
                'properties', r.properties
            ) ORDER BY r.confidence DESC, r.strength DESC)
            FROM kg_relationships r
            JOIN kg_entities o ON r.object_id = o.id
            WHERE r.subject_id = e.id AND r.is_current = true
        ),
        'relationships_incoming', (
            SELECT json_agg(json_build_object(
                'subject_id', r.subject_id,
                'subject_name', s.display_name,
                'subject_type', s.entity_type,
                'predicate', r.predicate,
                'strength', r.strength,
                'confidence', r.confidence,
                'properties', r.properties
            ) ORDER BY r.confidence DESC, r.strength DESC)
            FROM kg_relationships r
            JOIN kg_entities s ON r.subject_id = s.id
            WHERE r.object_id = e.id AND r.is_current = true
        ),
        'recent_mentions', (
            SELECT json_agg(json_build_object(
                'content_id', m.content_id,
                'mention_type', m.mention_type,
                'sentiment_score', m.sentiment_score,
                'relevance_score', m.relevance_score,
                'created_at', m.created_at
            ) ORDER BY m.created_at DESC)
            FROM kg_entity_mentions m
            WHERE m.entity_id = e.id
            LIMIT 10
        )
    ) INTO result
    FROM kg_entities e
    WHERE e.id = entity_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 13: DATA QUALITY VIEWS
-- =====================================================

-- Entity quality dashboard
CREATE VIEW v_entity_quality AS
SELECT 
    entity_type,
    entity_subtype,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE is_verified) as verified_count,
    COUNT(*) FILTER (WHERE is_active) as active_count,
    AVG(quality_score) as avg_quality_score,
    AVG(completeness_score) as avg_completeness_score,
    AVG(importance_score) as avg_importance_score,
    COUNT(*) FILTER (WHERE array_length(aliases, 1) > 0) as with_aliases,
    COUNT(*) FILTER (WHERE description IS NOT NULL) as with_description
FROM kg_entities
GROUP BY entity_type, entity_subtype
ORDER BY entity_type, entity_subtype;

-- Relationship quality dashboard
CREATE VIEW v_relationship_quality AS
SELECT 
    predicate,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE is_verified) as verified_count,
    COUNT(*) FILTER (WHERE is_current) as current_count,
    AVG(confidence) as avg_confidence,
    AVG(strength) as avg_strength,
    COUNT(DISTINCT source_systems) as source_system_count
FROM kg_relationships
GROUP BY predicate
ORDER BY total_count DESC;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE kg_entities IS 'Core entity table for knowledge graph - stores all types of entities with validation';
COMMENT ON TABLE kg_relationships IS 'Relationship table with temporal validity and type constraints';
COMMENT ON TABLE kg_entity_attributes IS 'Flexible attribute storage with proper type handling';
COMMENT ON TABLE kg_entity_mentions IS 'Tracks entity mentions in content with confidence scoring';
COMMENT ON TABLE kg_entity_history IS 'Complete audit trail for entity changes';
COMMENT ON FUNCTION search_entities IS 'Advanced entity search with relevance ranking';
COMMENT ON FUNCTION get_entity_details IS 'Get complete entity information including relationships and attributes';