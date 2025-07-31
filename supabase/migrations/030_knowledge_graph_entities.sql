-- Knowledge Graph Entity System
-- Extends the entity concept to support people, places, organizations, and more
-- Enables rich relationship mapping for comprehensive market intelligence

-- =====================================================
-- PART 1: ENHANCED ENTITY SYSTEM
-- =====================================================

-- Rename existing entities table to security_entities (if needed)
-- ALTER TABLE entities RENAME TO security_entities;

-- Create universal entities table for knowledge graph
CREATE TABLE IF NOT EXISTS kg_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core identification
    entity_type VARCHAR(50) NOT NULL, -- 'security', 'person', 'organization', 'place', 'event', 'topic'
    entity_subtype VARCHAR(50), -- 'stock', 'etf', 'ceo', 'analyst', 'company', 'city', 'country', etc.
    
    -- Common fields for all entities
    name VARCHAR(500) NOT NULL,
    canonical_name VARCHAR(500), -- Standardized name for deduplication
    aliases TEXT[] DEFAULT '{}', -- Alternative names, tickers, nicknames
    description TEXT,
    
    -- Security-specific fields (null for non-securities)
    symbol VARCHAR(10), -- Stock ticker
    cusip VARCHAR(9),
    isin VARCHAR(12),
    exchange VARCHAR(50),
    
    -- Person-specific fields
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(100),
    title VARCHAR(100), -- CEO, CFO, Analyst, etc.
    
    -- Organization-specific fields
    organization_type VARCHAR(50), -- 'public_company', 'private_company', 'government', 'nonprofit'
    founding_date DATE,
    
    -- Place-specific fields
    place_type VARCHAR(50), -- 'city', 'state', 'country', 'region'
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    population BIGINT,
    
    -- Common metadata
    is_active BOOLEAN DEFAULT true,
    importance_score DECIMAL(5, 2) DEFAULT 50.0, -- 0-100 importance in knowledge graph
    data_sources TEXT[] DEFAULT '{}', -- Where this entity was found/verified
    external_ids JSONB DEFAULT '{}', -- IDs from other systems (CIK, LEI, Wikidata, etc.)
    metadata JSONB DEFAULT '{}', -- Flexible additional data
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    UNIQUE(entity_type, canonical_name),
    CHECK (
        (entity_type = 'security' AND symbol IS NOT NULL) OR
        (entity_type != 'security')
    )
);

-- =====================================================
-- PART 2: ENTITY RELATIONSHIPS (KNOWLEDGE GRAPH EDGES)
-- =====================================================

CREATE TABLE kg_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationship definition
    subject_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
    predicate VARCHAR(100) NOT NULL, -- 'employs', 'located_in', 'competes_with', 'supplies', etc.
    object_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
    
    -- Relationship metadata
    relationship_type VARCHAR(50), -- 'employment', 'ownership', 'partnership', 'location'
    strength DECIMAL(5, 2) DEFAULT 50.0, -- 0-100 strength of relationship
    confidence DECIMAL(5, 2) DEFAULT 75.0, -- 0-100 confidence in relationship
    
    -- Temporal validity
    valid_from DATE,
    valid_to DATE,
    is_current BOOLEAN DEFAULT true,
    
    -- Additional context
    context TEXT, -- Description of the relationship
    properties JSONB DEFAULT '{}', -- Additional properties (e.g., ownership %, role details)
    
    -- Source tracking
    source_documents TEXT[] DEFAULT '{}', -- Which documents/feeds mentioned this
    first_observed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_confirmed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate relationships
    UNIQUE(subject_id, predicate, object_id, valid_from),
    -- Prevent self-relationships
    CHECK (subject_id != object_id)
);

-- =====================================================
-- PART 3: ENTITY ATTRIBUTES (DYNAMIC PROPERTIES)
-- =====================================================

CREATE TABLE kg_entity_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
    
    -- Attribute definition
    attribute_type VARCHAR(100) NOT NULL, -- 'financial_metric', 'contact_info', 'social_media'
    attribute_name VARCHAR(200) NOT NULL, -- 'revenue_2023', 'twitter_handle', 'headquarters_address'
    attribute_value TEXT,
    attribute_data JSONB DEFAULT '{}', -- Structured data
    
    -- Temporal validity
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_to DATE,
    is_current BOOLEAN DEFAULT true,
    
    -- Metadata
    unit VARCHAR(50), -- 'USD', 'millions', 'percent'
    confidence DECIMAL(5, 2) DEFAULT 75.0,
    source VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, attribute_type, attribute_name, valid_from)
);

-- =====================================================
-- PART 4: ENTITY MENTIONS IN CONTENT
-- =====================================================

-- Enhanced entity content mapping for knowledge graph
CREATE TABLE kg_entity_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES processed_content(id) ON DELETE CASCADE,
    
    -- Mention details
    mention_type VARCHAR(50), -- 'primary', 'secondary', 'quoted', 'referenced'
    mention_count INTEGER DEFAULT 1,
    mention_positions INTEGER[], -- Character positions in text
    mention_context TEXT[], -- Surrounding text for each mention
    
    -- Sentiment and relevance
    sentiment_score DECIMAL(5, 4), -- -1 to 1
    relevance_score DECIMAL(5, 4), -- 0 to 1
    
    -- Extracted information
    extracted_facts JSONB DEFAULT '[]', -- Facts extracted about this entity
    extracted_relationships JSONB DEFAULT '[]', -- Relationships mentioned
    extracted_attributes JSONB DEFAULT '[]', -- Attributes/properties mentioned
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, content_id)
);

-- =====================================================
-- PART 5: MIGRATION FROM OLD ENTITIES
-- =====================================================

-- Migrate existing entities to knowledge graph
INSERT INTO kg_entities (
    id,
    entity_type,
    entity_subtype,
    name,
    canonical_name,
    aliases,
    description,
    symbol,
    cusip,
    isin,
    exchange,
    is_active,
    external_ids,
    created_at,
    updated_at
)
SELECT 
    id,
    'security' as entity_type,
    CASE 
        WHEN entity_type = 'etf' THEN 'etf'
        WHEN entity_type = 'mutual_fund' THEN 'mutual_fund'
        ELSE 'stock'
    END as entity_subtype,
    name,
    UPPER(symbol) as canonical_name,
    ARRAY[symbol] as aliases,
    description,
    symbol,
    cusip,
    isin,
    primary_exchange,
    is_active,
    jsonb_build_object(
        'cik', cik,
        'lei', lei,
        'sic_code', sic_code,
        'naics_code', naics_code
    ) as external_ids,
    created_at,
    updated_at
FROM entities
ON CONFLICT (entity_type, canonical_name) DO NOTHING;

-- Create relationships for company officers (example)
-- This would be populated from SEC filings, news, etc.
INSERT INTO kg_relationships (subject_id, predicate, object_id, relationship_type, properties)
SELECT 
    company.id as subject_id,
    'employs' as predicate,
    person.id as object_id,
    'employment' as relationship_type,
    jsonb_build_object('position', person.title, 'start_date', '2023-01-01')
FROM kg_entities company
JOIN kg_entities person ON person.entity_type = 'person'
WHERE company.entity_type = 'security'
AND company.symbol IN ('AAPL', 'GOOGL', 'MSFT') -- Example
AND person.name IN ('Tim Cook', 'Sundar Pichai', 'Satya Nadella'); -- Would be populated from data

-- =====================================================
-- PART 6: KNOWLEDGE GRAPH VIEWS
-- =====================================================

-- Entity network view
CREATE OR REPLACE VIEW v_entity_network AS
SELECT 
    s.id as subject_id,
    s.name as subject_name,
    s.entity_type as subject_type,
    r.predicate,
    o.id as object_id,
    o.name as object_name,
    o.entity_type as object_type,
    r.strength,
    r.confidence,
    r.is_current
FROM kg_relationships r
JOIN kg_entities s ON r.subject_id = s.id
JOIN kg_entities o ON r.object_id = o.id
WHERE r.is_current = true;

-- Entity with all relationships
CREATE OR REPLACE VIEW v_entity_complete AS
SELECT 
    e.*,
    -- Outgoing relationships
    (
        SELECT json_agg(json_build_object(
            'predicate', r.predicate,
            'object', o.name,
            'object_type', o.entity_type,
            'strength', r.strength
        ))
        FROM kg_relationships r
        JOIN kg_entities o ON r.object_id = o.id
        WHERE r.subject_id = e.id AND r.is_current = true
    ) as outgoing_relationships,
    -- Incoming relationships
    (
        SELECT json_agg(json_build_object(
            'subject', s.name,
            'subject_type', s.entity_type,
            'predicate', r.predicate,
            'strength', r.strength
        ))
        FROM kg_relationships r
        JOIN kg_entities s ON r.subject_id = s.id
        WHERE r.object_id = e.id AND r.is_current = true
    ) as incoming_relationships,
    -- Current attributes
    (
        SELECT json_object_agg(
            a.attribute_name,
            a.attribute_value
        )
        FROM kg_entity_attributes a
        WHERE a.entity_id = e.id AND a.is_current = true
    ) as attributes
FROM kg_entities e;

-- =====================================================
-- PART 7: KNOWLEDGE GRAPH FUNCTIONS
-- =====================================================

-- Find entities by any identifier
CREATE OR REPLACE FUNCTION find_entity(search_term TEXT)
RETURNS TABLE (
    entity_id UUID,
    entity_type VARCHAR(50),
    name VARCHAR(500),
    match_type VARCHAR(50),
    relevance FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as entity_id,
        e.entity_type,
        e.name,
        CASE 
            WHEN UPPER(e.symbol) = UPPER(search_term) THEN 'symbol_exact'
            WHEN UPPER(e.name) = UPPER(search_term) THEN 'name_exact'
            WHEN UPPER(e.canonical_name) = UPPER(search_term) THEN 'canonical_exact'
            WHEN UPPER(search_term) = ANY(SELECT UPPER(unnest(e.aliases))) THEN 'alias_exact'
            WHEN e.symbol ILIKE '%' || search_term || '%' THEN 'symbol_partial'
            WHEN e.name ILIKE '%' || search_term || '%' THEN 'name_partial'
            ELSE 'other'
        END as match_type,
        CASE 
            WHEN UPPER(e.symbol) = UPPER(search_term) THEN 1.0
            WHEN UPPER(e.name) = UPPER(search_term) THEN 0.95
            WHEN UPPER(e.canonical_name) = UPPER(search_term) THEN 0.9
            WHEN UPPER(search_term) = ANY(SELECT UPPER(unnest(e.aliases))) THEN 0.85
            WHEN e.symbol ILIKE '%' || search_term || '%' THEN 0.7
            WHEN e.name ILIKE '%' || search_term || '%' THEN 0.6
            ELSE 0.5
        END as relevance
    FROM kg_entities e
    WHERE 
        e.symbol ILIKE '%' || search_term || '%' OR
        e.name ILIKE '%' || search_term || '%' OR
        e.canonical_name ILIKE '%' || search_term || '%' OR
        search_term = ANY(e.aliases)
    ORDER BY relevance DESC, e.importance_score DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Get entity relationships graph
CREATE OR REPLACE FUNCTION get_entity_graph(
    entity_id UUID,
    depth INTEGER DEFAULT 2
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    WITH RECURSIVE entity_graph AS (
        -- Start with the target entity
        SELECT 
            e.id,
            e.name,
            e.entity_type,
            0 as depth,
            ARRAY[e.id] as path
        FROM kg_entities e
        WHERE e.id = entity_id
        
        UNION ALL
        
        -- Add related entities up to specified depth
        SELECT 
            e.id,
            e.name,
            e.entity_type,
            eg.depth + 1,
            eg.path || e.id
        FROM entity_graph eg
        JOIN kg_relationships r ON (
            (r.subject_id = eg.id AND e.id = r.object_id) OR
            (r.object_id = eg.id AND e.id = r.subject_id)
        )
        JOIN kg_entities e ON e.id IN (r.subject_id, r.object_id) AND e.id != eg.id
        WHERE eg.depth < depth
        AND NOT e.id = ANY(eg.path) -- Prevent cycles
        AND r.is_current = true
    ),
    nodes AS (
        SELECT DISTINCT ON (id)
            id,
            name,
            entity_type,
            depth
        FROM entity_graph
    ),
    edges AS (
        SELECT DISTINCT
            r.subject_id as source,
            r.object_id as target,
            r.predicate,
            r.strength
        FROM kg_relationships r
        WHERE r.is_current = true
        AND r.subject_id IN (SELECT id FROM nodes)
        AND r.object_id IN (SELECT id FROM nodes)
    )
    SELECT jsonb_build_object(
        'nodes', (SELECT json_agg(row_to_json(n.*)) FROM nodes n),
        'edges', (SELECT json_agg(row_to_json(e.*)) FROM edges e)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Extract entities from text (would integrate with NLP service)
CREATE OR REPLACE FUNCTION extract_entities_from_text(
    content_text TEXT,
    content_id UUID
) RETURNS TABLE (
    entity_id UUID,
    entity_name VARCHAR(500),
    entity_type VARCHAR(50),
    confidence FLOAT
) AS $$
BEGIN
    -- This is a simplified version - in production would call NLP service
    -- For now, it does basic pattern matching
    
    -- Find stock symbols (capital letters, 1-5 chars)
    RETURN QUERY
    SELECT 
        e.id as entity_id,
        e.name as entity_name,
        e.entity_type,
        0.9::FLOAT as confidence
    FROM kg_entities e
    WHERE e.entity_type = 'security'
    AND (
        content_text ~ ('\y' || e.symbol || '\y') OR
        content_text ILIKE '%' || e.name || '%'
    );
    
    -- Find mentioned people (would use NER in production)
    RETURN QUERY
    SELECT 
        e.id as entity_id,
        e.name as entity_name,
        e.entity_type,
        0.8::FLOAT as confidence
    FROM kg_entities e
    WHERE e.entity_type = 'person'
    AND content_text ILIKE '%' || e.name || '%';
    
    -- Find places
    RETURN QUERY
    SELECT 
        e.id as entity_id,
        e.name as entity_name,
        e.entity_type,
        0.7::FLOAT as confidence
    FROM kg_entities e
    WHERE e.entity_type = 'place'
    AND content_text ILIKE '%' || e.name || '%';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 8: INDEXES FOR PERFORMANCE
-- =====================================================

-- Entity search indexes
CREATE INDEX idx_kg_entities_type ON kg_entities(entity_type);
CREATE INDEX idx_kg_entities_symbol ON kg_entities(symbol) WHERE symbol IS NOT NULL;
CREATE INDEX idx_kg_entities_name_gin ON kg_entities USING GIN(name gin_trgm_ops);
CREATE INDEX idx_kg_entities_canonical ON kg_entities(canonical_name);
CREATE INDEX idx_kg_entities_aliases_gin ON kg_entities USING GIN(aliases);
CREATE INDEX idx_kg_entities_importance ON kg_entities(importance_score DESC) WHERE is_active = true;

-- Relationship indexes
CREATE INDEX idx_kg_relationships_subject ON kg_relationships(subject_id);
CREATE INDEX idx_kg_relationships_object ON kg_relationships(object_id);
CREATE INDEX idx_kg_relationships_predicate ON kg_relationships(predicate);
CREATE INDEX idx_kg_relationships_current ON kg_relationships(subject_id, object_id) WHERE is_current = true;
CREATE INDEX idx_kg_relationships_type ON kg_relationships(relationship_type) WHERE is_current = true;

-- Attribute indexes
CREATE INDEX idx_kg_attributes_entity ON kg_entity_attributes(entity_id);
CREATE INDEX idx_kg_attributes_type ON kg_entity_attributes(attribute_type);
CREATE INDEX idx_kg_attributes_current ON kg_entity_attributes(entity_id, attribute_type) WHERE is_current = true;

-- Mention indexes
CREATE INDEX idx_kg_mentions_entity ON kg_entity_mentions(entity_id);
CREATE INDEX idx_kg_mentions_content ON kg_entity_mentions(content_id);
CREATE INDEX idx_kg_mentions_relevance ON kg_entity_mentions(relevance_score DESC);

-- =====================================================
-- PART 9: EXAMPLE DATA
-- =====================================================

-- Example: Add key people
INSERT INTO kg_entities (entity_type, entity_subtype, name, canonical_name, title) VALUES
('person', 'executive', 'Tim Cook', 'TIMOTHY DONALD COOK', 'CEO'),
('person', 'executive', 'Warren Buffett', 'WARREN EDWARD BUFFETT', 'CEO'),
('person', 'executive', 'Elon Musk', 'ELON REEVE MUSK', 'CEO'),
('person', 'analyst', 'Cathie Wood', 'CATHERINE DUDDY WOOD', 'CEO & CIO');

-- Example: Add organizations
INSERT INTO kg_entities (entity_type, entity_subtype, name, canonical_name, organization_type) VALUES
('organization', 'company', 'Apple Inc.', 'APPLE INC', 'public_company'),
('organization', 'company', 'Berkshire Hathaway', 'BERKSHIRE HATHAWAY INC', 'public_company'),
('organization', 'company', 'ARK Invest', 'ARK INVESTMENT MANAGEMENT LLC', 'private_company'),
('organization', 'regulator', 'Securities and Exchange Commission', 'SEC', 'government');

-- Example: Add places
INSERT INTO kg_entities (entity_type, entity_subtype, name, canonical_name, place_type) VALUES
('place', 'city', 'Cupertino', 'CUPERTINO', 'city'),
('place', 'city', 'Omaha', 'OMAHA', 'city'),
('place', 'state', 'California', 'CALIFORNIA', 'state'),
('place', 'country', 'United States', 'UNITED STATES', 'country');

-- Example: Create relationships
-- Note: In production, these would be created from entity extraction
-- INSERT INTO kg_relationships (subject_id, predicate, object_id, relationship_type, properties)
-- SELECT ... (would need actual IDs)

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE kg_entities IS 'Universal entity table for knowledge graph - includes securities, people, places, organizations';
COMMENT ON TABLE kg_relationships IS 'Relationships between entities - the edges of the knowledge graph';
COMMENT ON TABLE kg_entity_attributes IS 'Dynamic attributes for entities with temporal validity';
COMMENT ON TABLE kg_entity_mentions IS 'Tracks where entities are mentioned in content with context';
COMMENT ON FUNCTION find_entity IS 'Find entities by any identifier - symbol, name, alias';
COMMENT ON FUNCTION get_entity_graph IS 'Get the relationship graph around an entity up to specified depth';