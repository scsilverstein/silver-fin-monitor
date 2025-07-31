-- Create master entities table
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    
    -- Legal entity information
    cik VARCHAR(10),
    lei VARCHAR(20),
    cusip VARCHAR(9),
    isin VARCHAR(12),
    
    -- Company classification
    entity_type VARCHAR(50) DEFAULT 'corporation',
    incorporation_date DATE,
    incorporation_country VARCHAR(2) DEFAULT 'US',
    
    -- Exchange information
    primary_exchange VARCHAR(50),
    listing_date DATE,
    delisting_date DATE,
    
    -- Business classification
    sic_code VARCHAR(4),
    naics_code VARCHAR(6),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_sp500 BOOLEAN DEFAULT false,
    is_nasdaq100 BOOLEAN DEFAULT false,
    is_dow30 BOOLEAN DEFAULT false,
    
    -- Metadata
    website_url TEXT,
    logo_url TEXT,
    description TEXT,
    employee_count INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_entities_entity_type CHECK (
        entity_type IN ('corporation', 'etf', 'mutual_fund', 'reit')
    )
);

-- Add table comment
COMMENT ON TABLE entities IS 'Master table for all financial entities (companies, ETFs, etc)';

-- Add column comments
COMMENT ON COLUMN entities.symbol IS 'Stock ticker symbol';
COMMENT ON COLUMN entities.cik IS 'SEC Central Index Key';
COMMENT ON COLUMN entities.lei IS 'Legal Entity Identifier';
COMMENT ON COLUMN entities.cusip IS 'Committee on Uniform Securities Identification';
COMMENT ON COLUMN entities.isin IS 'International Securities Identification Number';
COMMENT ON COLUMN entities.entity_type IS 'Type of entity: corporation, etf, mutual_fund, reit';
COMMENT ON COLUMN entities.sic_code IS 'Standard Industrial Classification';
COMMENT ON COLUMN entities.naics_code IS 'North American Industry Classification System';