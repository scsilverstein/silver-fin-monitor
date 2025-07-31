-- Create entity classifications table
CREATE TABLE IF NOT EXISTS entity_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    industry_id UUID NOT NULL,
    classification_type VARCHAR(50) DEFAULT 'primary',
    effective_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_entity_classifications_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_entity_classifications_industry 
        FOREIGN KEY (industry_id) 
        REFERENCES industries(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_entity_classifications_type CHECK (
        classification_type IN ('primary', 'secondary')
    ),
    
    CONSTRAINT chk_entity_classifications_dates CHECK (
        end_date IS NULL OR end_date >= effective_date
    ),
    
    CONSTRAINT uq_entity_classifications 
        UNIQUE(entity_id, industry_id, classification_type)
);

-- Add table comment
COMMENT ON TABLE entity_classifications IS 'Maps entities to their industry classifications';

-- Add column comments
COMMENT ON COLUMN entity_classifications.entity_id IS 'Reference to the entity being classified';
COMMENT ON COLUMN entity_classifications.industry_id IS 'Reference to the industry classification';
COMMENT ON COLUMN entity_classifications.classification_type IS 'Primary or secondary classification';
COMMENT ON COLUMN entity_classifications.effective_date IS 'Date this classification became effective';
COMMENT ON COLUMN entity_classifications.end_date IS 'Date this classification ended (null if current)';