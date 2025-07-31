-- Create indexes for market_data table
-- Support market-wide analysis

-- Primary index for symbol and timestamp
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_time 
ON market_data(symbol, timestamp DESC);

-- Index for real-time queries
CREATE INDEX IF NOT EXISTS idx_market_data_realtime 
ON market_data(timestamp DESC, symbol) 
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Index for data type filtering
CREATE INDEX IF NOT EXISTS idx_market_data_type 
ON market_data(data_type, timestamp DESC);

-- Index for bid/ask spread analysis
CREATE INDEX IF NOT EXISTS idx_market_data_spread 
ON market_data(symbol, timestamp DESC, bid, ask) 
WHERE data_type = 'quote';

-- Index for trade analysis
CREATE INDEX IF NOT EXISTS idx_market_data_trades 
ON market_data(timestamp DESC, size DESC) 
WHERE data_type = 'trade' AND size > 1000;

-- JSONB index for additional data
CREATE INDEX IF NOT EXISTS idx_market_data_additional 
ON market_data USING GIN(additional_data);

-- Index for market hours data only
CREATE INDEX IF NOT EXISTS idx_market_data_market_hours 
ON market_data(timestamp DESC) 
WHERE EXTRACT(hour FROM timestamp AT TIME ZONE 'America/New_York') BETWEEN 9 AND 16;

-- Index for pre/post market data
CREATE INDEX IF NOT EXISTS idx_market_data_extended_hours 
ON market_data(timestamp DESC, symbol) 
WHERE EXTRACT(hour FROM timestamp AT TIME ZONE 'America/New_York') NOT BETWEEN 9 AND 16;

-- Add index comments
COMMENT ON INDEX idx_market_data_symbol_time IS 'Primary symbol-time lookup';
COMMENT ON INDEX idx_market_data_realtime IS 'Recent real-time data';
COMMENT ON INDEX idx_market_data_type IS 'Filter by data type';
COMMENT ON INDEX idx_market_data_spread IS 'Bid-ask spread analysis';
COMMENT ON INDEX idx_market_data_trades IS 'Large trade analysis';
COMMENT ON INDEX idx_market_data_additional IS 'Query additional data fields';
COMMENT ON INDEX idx_market_data_market_hours IS 'Regular market hours only';
COMMENT ON INDEX idx_market_data_extended_hours IS 'Extended hours trading';