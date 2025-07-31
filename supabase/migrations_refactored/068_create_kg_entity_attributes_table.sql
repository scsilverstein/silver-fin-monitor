-- Create knowledge graph entity attributes table
CREATE TABLE IF NOT EXISTS kg_entity_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    
    -- Attribute definition
    attribute_category VARCHAR(100) NOT NULL,
    attribute_name VARCHAR(200) NOT NULL,
    attribute_value TEXT,
    attribute_type VARCHAR(50) NOT NULL,
    
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
    unit VARCHAR(50),
    precision_digits INTEGER,
    confidence DECIMAL(5, 2) DEFAULT 75.0,
    
    -- Source tracking
    source_system VARCHAR(100),
    source_document VARCHAR(500),
    is_verified BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_kg_entity_attributes_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES kg_entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_kg_entity_attributes_type CHECK (
        attribute_type IN ('string', 'number', 'date', 'json')
    ),
    
    CONSTRAINT chk_kg_entity_attributes_value CHECK (
        (attribute_type = 'string' AND value_text IS NOT NULL) OR
        (attribute_type = 'number' AND value_numeric IS NOT NULL) OR
        (attribute_type = 'date' AND value_date IS NOT NULL) OR
        (attribute_type = 'json' AND value_json IS NOT NULL)
    ),
    
    CONSTRAINT chk_kg_entity_attributes_confidence CHECK (
        confidence BETWEEN 0 AND 100
    ),
    
    CONSTRAINT excl_kg_entity_attributes_current 
        EXCLUDE USING gist (
            entity_id WITH =,
            attribute_category WITH =,
            attribute_name WITH =,
            daterange(valid_from, valid_to) WITH &&
        )
);

-- Add table comment
COMMENT ON TABLE kg_entity_attributes IS 'Flexible attribute storage with proper type handling';

-- Add column comments
COMMENT ON COLUMN kg_entity_attributes.attribute_category IS 'Category of attribute: financial, contact, social, etc';
COMMENT ON COLUMN kg_entity_attributes.attribute_name IS 'Name of the attribute';
COMMENT ON COLUMN kg_entity_attributes.attribute_type IS 'Data type: string, number, date, json';
COMMENT ON COLUMN kg_entity_attributes.unit IS 'Unit of measurement (USD, percent, millions, etc)';
COMMENT ON COLUMN kg_entity_attributes.precision_digits IS 'Number of decimal places for numeric values';