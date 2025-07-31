-- Create indexes for stock_data table
-- High-frequency data requiring efficient indexing

-- Primary composite index for symbol and date queries
CREATE INDEX IF NOT EXISTS idx_stock_data_symbol_date 
ON stock_data(symbol, date DESC);

-- Index for date range queries across all symbols
CREATE INDEX IF NOT EXISTS idx_stock_data_date 
ON stock_data(date DESC);

-- Index for latest price lookups
CREATE INDEX IF NOT EXISTS idx_stock_data_latest 
ON stock_data(symbol, date DESC, close);

-- Index for volume analysis
CREATE INDEX IF NOT EXISTS idx_stock_data_volume 
ON stock_data(date DESC, volume DESC) 
WHERE volume > 0;

-- Index for price change analysis
CREATE INDEX IF NOT EXISTS idx_stock_data_change 
ON stock_data(date DESC, change_percent) 
WHERE change_percent IS NOT NULL;

-- Index for technical analysis (high/low)
CREATE INDEX IF NOT EXISTS idx_stock_data_highs_lows 
ON stock_data(symbol, date DESC, high, low);

-- Index for gap analysis (open vs previous close)
CREATE INDEX IF NOT EXISTS idx_stock_data_gaps 
ON stock_data(symbol, date DESC, open) 
WHERE gap_percent > 2 OR gap_percent < -2;

-- Partial index for unusual volume
CREATE INDEX IF NOT EXISTS idx_stock_data_unusual_volume 
ON stock_data(date DESC, symbol, relative_volume DESC) 
WHERE relative_volume > 2;

-- Add index comments
COMMENT ON INDEX idx_stock_data_symbol_date IS 'Primary index for symbol-date queries';
COMMENT ON INDEX idx_stock_data_date IS 'Date range queries across symbols';
COMMENT ON INDEX idx_stock_data_latest IS 'Quick latest price lookups';
COMMENT ON INDEX idx_stock_data_volume IS 'Volume-based analysis';
COMMENT ON INDEX idx_stock_data_change IS 'Price change analysis';
COMMENT ON INDEX idx_stock_data_highs_lows IS 'Technical analysis queries';
COMMENT ON INDEX idx_stock_data_gaps IS 'Gap up/down detection';
COMMENT ON INDEX idx_stock_data_unusual_volume IS 'Find unusual volume days';