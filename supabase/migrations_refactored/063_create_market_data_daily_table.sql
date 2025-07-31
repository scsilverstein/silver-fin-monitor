-- Create daily market data table
CREATE TABLE IF NOT EXISTS market_data_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    market_date DATE NOT NULL,
    
    -- Price data
    open_price DECIMAL(12, 4),
    high_price DECIMAL(12, 4),
    low_price DECIMAL(12, 4),
    close_price DECIMAL(12, 4),
    adjusted_close DECIMAL(12, 4),
    
    -- Volume data
    volume BIGINT,
    dollar_volume DECIMAL(20, 2),
    
    -- Additional metrics
    vwap DECIMAL(12, 4),
    num_trades INTEGER,
    
    -- Data quality
    data_source VARCHAR(50) NOT NULL,
    is_adjusted BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_market_data_daily_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_market_data_daily_prices CHECK (
        (open_price IS NULL AND high_price IS NULL AND low_price IS NULL AND close_price IS NULL) OR
        (open_price >= 0 AND high_price >= 0 AND low_price >= 0 AND close_price >= 0 AND
         high_price >= low_price AND high_price >= open_price AND high_price >= close_price AND
         low_price <= open_price AND low_price <= close_price)
    ),
    
    CONSTRAINT chk_market_data_daily_volume CHECK (
        volume IS NULL OR volume >= 0
    ),
    
    CONSTRAINT uq_market_data_daily 
        UNIQUE(entity_id, market_date, data_source)
);

-- Add table comment
COMMENT ON TABLE market_data_daily IS 'Daily price and volume data for entities';

-- Add column comments
COMMENT ON COLUMN market_data_daily.entity_id IS 'Reference to the entity this data is for';
COMMENT ON COLUMN market_data_daily.market_date IS 'Trading date for this data';
COMMENT ON COLUMN market_data_daily.dollar_volume IS 'Volume multiplied by close price';
COMMENT ON COLUMN market_data_daily.vwap IS 'Volume Weighted Average Price';
COMMENT ON COLUMN market_data_daily.data_source IS 'Source of the market data (yahoo, alpha_vantage, polygon, etc)';
COMMENT ON COLUMN market_data_daily.is_adjusted IS 'Whether prices are adjusted for splits and dividends';