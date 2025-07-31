-- Create options chains table
CREATE TABLE IF NOT EXISTS options_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    
    -- Contract identification
    contract_symbol VARCHAR(50) NOT NULL,
    underlying_symbol VARCHAR(10) NOT NULL,
    
    -- Contract specifications
    option_type VARCHAR(4) NOT NULL,
    strike_price DECIMAL(12, 4) NOT NULL,
    expiration DATE NOT NULL,
    
    -- Trading data
    last_trade_date TIMESTAMP WITH TIME ZONE,
    last_price DECIMAL(12, 4),
    bid DECIMAL(12, 4),
    ask DECIMAL(12, 4),
    volume INTEGER,
    open_interest INTEGER,
    
    -- Greeks
    implied_volatility DECIMAL(10, 6),
    delta DECIMAL(8, 6),
    gamma DECIMAL(8, 6),
    theta DECIMAL(8, 6),
    vega DECIMAL(8, 6),
    rho DECIMAL(8, 6),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    in_the_money BOOLEAN DEFAULT false,
    
    -- Metadata
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_options_chains_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_options_chains_type CHECK (
        option_type IN ('CALL', 'PUT')
    ),
    
    CONSTRAINT chk_options_chains_strike CHECK (
        strike_price > 0
    ),
    
    CONSTRAINT chk_options_chains_prices CHECK (
        (last_price IS NULL OR last_price >= 0) AND
        (bid IS NULL OR bid >= 0) AND
        (ask IS NULL OR ask >= 0) AND
        (ask IS NULL OR bid IS NULL OR ask >= bid)
    ),
    
    CONSTRAINT chk_options_chains_volume CHECK (
        (volume IS NULL OR volume >= 0) AND
        (open_interest IS NULL OR open_interest >= 0)
    ),
    
    CONSTRAINT chk_options_chains_iv CHECK (
        implied_volatility IS NULL OR implied_volatility BETWEEN 0 AND 10
    ),
    
    CONSTRAINT uq_options_chains 
        UNIQUE(contract_symbol, data_source)
);

-- Add table comment
COMMENT ON TABLE options_chains IS 'Options contract specifications and current data';

-- Add column comments
COMMENT ON COLUMN options_chains.contract_symbol IS 'Standardized options contract symbol';
COMMENT ON COLUMN options_chains.option_type IS 'CALL or PUT';
COMMENT ON COLUMN options_chains.in_the_money IS 'Whether option is in the money at current price';
COMMENT ON COLUMN options_chains.implied_volatility IS 'Implied volatility from option price';
COMMENT ON COLUMN options_chains.delta IS 'Rate of change of option price with underlying price';
COMMENT ON COLUMN options_chains.theta IS 'Rate of time decay';