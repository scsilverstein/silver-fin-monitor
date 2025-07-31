-- Create scanner results table
CREATE TABLE IF NOT EXISTS scanner_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    scan_date DATE NOT NULL,
    scanner_type VARCHAR(50) NOT NULL,
    
    -- Scoring
    momentum_score DECIMAL(5, 2),
    value_score DECIMAL(5, 2),
    growth_score DECIMAL(5, 2),
    quality_score DECIMAL(5, 2),
    composite_score DECIMAL(5, 2),
    
    -- Rankings
    sector_rank INTEGER,
    industry_rank INTEGER,
    overall_rank INTEGER,
    
    -- Change metrics
    price_change_1d DECIMAL(10, 4),
    price_change_5d DECIMAL(10, 4),
    price_change_30d DECIMAL(10, 4),
    volume_ratio_10d DECIMAL(10, 4),
    
    -- Fundamental changes
    pe_change_30d DECIMAL(10, 4),
    forward_pe_change_30d DECIMAL(10, 4),
    earnings_revision_30d DECIMAL(10, 4),
    
    -- Signals
    signals JSONB DEFAULT '[]',
    signal_strength VARCHAR(20),
    
    -- Metadata
    scan_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_scanner_results_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_scanner_results_type CHECK (
        scanner_type IN ('momentum', 'value', 'growth', 'quality', 'earnings', 'technical', 'composite')
    ),
    
    CONSTRAINT chk_scanner_results_scores CHECK (
        (momentum_score IS NULL OR momentum_score BETWEEN 0 AND 100) AND
        (value_score IS NULL OR value_score BETWEEN 0 AND 100) AND
        (growth_score IS NULL OR growth_score BETWEEN 0 AND 100) AND
        (quality_score IS NULL OR quality_score BETWEEN 0 AND 100) AND
        (composite_score IS NULL OR composite_score BETWEEN 0 AND 100)
    ),
    
    CONSTRAINT chk_scanner_results_signal CHECK (
        signal_strength IS NULL OR 
        signal_strength IN ('very_weak', 'weak', 'neutral', 'strong', 'very_strong')
    ),
    
    CONSTRAINT uq_scanner_results 
        UNIQUE(entity_id, scan_date, scanner_type)
);

-- Add table comment
COMMENT ON TABLE scanner_results IS 'Stock scanner results with scoring and rankings';

-- Add column comments
COMMENT ON COLUMN scanner_results.scanner_type IS 'Type of scan: momentum, value, growth, quality, earnings, technical, composite';
COMMENT ON COLUMN scanner_results.volume_ratio_10d IS 'Current volume vs 10-day average';
COMMENT ON COLUMN scanner_results.signals IS 'Array of signals detected {type, strength, message}';
COMMENT ON COLUMN scanner_results.signal_strength IS 'Overall signal strength: very_weak to very_strong';