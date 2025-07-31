-- Create industries lookup table
CREATE TABLE IF NOT EXISTS industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id UUID NOT NULL,
    industry_name VARCHAR(100) NOT NULL,
    industry_code VARCHAR(20) UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_industries_sector_id 
        FOREIGN KEY (sector_id) 
        REFERENCES sectors(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT uq_industries_sector_name 
        UNIQUE(sector_id, industry_name)
);

-- Add table comment
COMMENT ON TABLE industries IS 'Industries within market sectors for detailed entity classification';

-- Add column comments
COMMENT ON COLUMN industries.id IS 'Unique identifier for the industry';
COMMENT ON COLUMN industries.sector_id IS 'Reference to parent sector';
COMMENT ON COLUMN industries.industry_name IS 'Name of the industry (e.g., Software, Biotechnology)';
COMMENT ON COLUMN industries.industry_code IS 'Short code for the industry (e.g., SOFT, BIOTECH)';
COMMENT ON COLUMN industries.description IS 'Detailed description of what this industry includes';
COMMENT ON COLUMN industries.created_at IS 'Timestamp when the industry was created';