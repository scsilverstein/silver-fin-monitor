-- Create sectors lookup table
CREATE TABLE IF NOT EXISTS sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_name VARCHAR(100) NOT NULL UNIQUE,
    sector_code VARCHAR(10) UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add table comment
COMMENT ON TABLE sectors IS 'Market sectors for entity classification';

-- Add column comments
COMMENT ON COLUMN sectors.id IS 'Unique identifier for the sector';
COMMENT ON COLUMN sectors.sector_name IS 'Name of the sector (e.g., Technology, Healthcare)';
COMMENT ON COLUMN sectors.sector_code IS 'Short code for the sector (e.g., TECH, HLTH)';
COMMENT ON COLUMN sectors.description IS 'Detailed description of what this sector includes';
COMMENT ON COLUMN sectors.created_at IS 'Timestamp when the sector was created';