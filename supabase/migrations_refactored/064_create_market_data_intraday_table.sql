-- Create intraday market data table
CREATE TABLE IF NOT EXISTS market_data_intraday (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    price DECIMAL(12, 4),
    volume INTEGER,
    bid DECIMAL(12, 4),
    ask DECIMAL(12, 4),
    bid_size INTEGER,
    ask_size INTEGER,
    
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_market_data_intraday_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_market_data_intraday_price CHECK (
        price IS NULL OR price >= 0
    ),
    
    CONSTRAINT chk_market_data_intraday_bid_ask CHECK (
        (bid IS NULL AND ask IS NULL) OR 
        (bid > 0 AND ask > 0 AND ask >= bid)
    ),
    
    CONSTRAINT chk_market_data_intraday_sizes CHECK (
        (bid_size IS NULL OR bid_size >= 0) AND
        (ask_size IS NULL OR ask_size >= 0)
    )
);

-- Add table comment
COMMENT ON TABLE market_data_intraday IS 'Intraday price and quote data for high-frequency analysis';

-- Add column comments
COMMENT ON COLUMN market_data_intraday.entity_id IS 'Reference to the entity this data is for';
COMMENT ON COLUMN market_data_intraday.timestamp IS 'Exact timestamp of the data point';
COMMENT ON COLUMN market_data_intraday.price IS 'Trade price at this timestamp';
COMMENT ON COLUMN market_data_intraday.volume IS 'Volume traded at this timestamp';
COMMENT ON COLUMN market_data_intraday.bid IS 'Best bid price';
COMMENT ON COLUMN market_data_intraday.ask IS 'Best ask price';
COMMENT ON COLUMN market_data_intraday.bid_size IS 'Size available at bid';
COMMENT ON COLUMN market_data_intraday.ask_size IS 'Size available at ask';