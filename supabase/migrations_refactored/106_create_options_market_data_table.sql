-- Create options market data table
CREATE TABLE IF NOT EXISTS options_market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_chain_id UUID NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Timestamp
    market_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Price data
    bid DECIMAL(12, 4),
    ask DECIMAL(12, 4),
    last DECIMAL(12, 4),
    mark DECIMAL(12, 4),
    
    -- Size data
    bid_size INTEGER,
    ask_size INTEGER,
    
    -- Volume and interest
    volume INTEGER,
    open_interest INTEGER,
    volume_oi_ratio DECIMAL(10, 4),
    
    -- Greeks at this point
    implied_volatility DECIMAL(10, 6),
    delta DECIMAL(8, 6),
    gamma DECIMAL(8, 6),
    theta DECIMAL(8, 6),
    vega DECIMAL(8, 6),
    
    -- Calculated metrics
    bid_ask_spread DECIMAL(12, 4),
    spread_percentage DECIMAL(10, 4),
    
    -- Data quality
    data_source VARCHAR(50) NOT NULL,
    is_stale BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_options_market_data_chain 
        FOREIGN KEY (option_chain_id) 
        REFERENCES options_chains(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_options_market_data_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_options_market_data_prices CHECK (
        (bid IS NULL OR bid >= 0) AND
        (ask IS NULL OR ask >= 0) AND
        (last IS NULL OR last >= 0) AND
        (mark IS NULL OR mark >= 0)
    ),
    
    CONSTRAINT chk_options_market_data_sizes CHECK (
        (bid_size IS NULL OR bid_size >= 0) AND
        (ask_size IS NULL OR ask_size >= 0)
    ),
    
    CONSTRAINT chk_options_market_data_volume CHECK (
        (volume IS NULL OR volume >= 0) AND
        (open_interest IS NULL OR open_interest >= 0)
    )
);

-- Add table comment
COMMENT ON TABLE options_market_data IS 'Time series options market data';

-- Add column comments
COMMENT ON COLUMN options_market_data.mark IS 'Mark price (midpoint of bid-ask)';
COMMENT ON COLUMN options_market_data.volume_oi_ratio IS 'Volume to open interest ratio';
COMMENT ON COLUMN options_market_data.spread_percentage IS 'Bid-ask spread as percentage of mark';
COMMENT ON COLUMN options_market_data.is_stale IS 'Whether this data is considered stale';