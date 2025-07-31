-- Create indexes for options_data table
-- Complex queries requiring strategic indexing

-- Primary composite index for option lookups
CREATE INDEX IF NOT EXISTS idx_options_data_primary 
ON options_data(symbol, expiration_date, strike, option_type, date DESC);

-- Index for expiration date queries
CREATE INDEX IF NOT EXISTS idx_options_data_expiration 
ON options_data(expiration_date, symbol) 
WHERE expiration_date >= CURRENT_DATE;

-- Index for strike price analysis
CREATE INDEX IF NOT EXISTS idx_options_data_strike 
ON options_data(symbol, strike, option_type, date DESC);

-- Index for volume and open interest
CREATE INDEX IF NOT EXISTS idx_options_data_volume_oi 
ON options_data(date DESC, volume DESC, open_interest DESC) 
WHERE volume > 100;

-- Index for implied volatility analysis
CREATE INDEX IF NOT EXISTS idx_options_data_iv 
ON options_data(symbol, date DESC, implied_volatility) 
WHERE implied_volatility IS NOT NULL;

-- Index for in-the-money options
CREATE INDEX IF NOT EXISTS idx_options_data_itm 
ON options_data(symbol, expiration_date, moneyness) 
WHERE moneyness > 0;

-- Index for unusual options activity
CREATE INDEX IF NOT EXISTS idx_options_data_unusual 
ON options_data(date DESC, symbol, volume_oi_ratio DESC) 
WHERE volume_oi_ratio > 2;

-- Index for options chain queries
CREATE INDEX IF NOT EXISTS idx_options_data_chain 
ON options_data(symbol, expiration_date, strike, option_type) 
WHERE date = (SELECT MAX(date) FROM options_data);

-- JSONB index for Greeks
CREATE INDEX IF NOT EXISTS idx_options_data_greeks 
ON options_data USING GIN(greeks);

-- Add index comments
COMMENT ON INDEX idx_options_data_primary IS 'Primary index for option contract lookups';
COMMENT ON INDEX idx_options_data_expiration IS 'Query by expiration date';
COMMENT ON INDEX idx_options_data_strike IS 'Strike price analysis';
COMMENT ON INDEX idx_options_data_volume_oi IS 'High volume and open interest';
COMMENT ON INDEX idx_options_data_iv IS 'Implied volatility analysis';
COMMENT ON INDEX idx_options_data_itm IS 'In-the-money options';
COMMENT ON INDEX idx_options_data_unusual IS 'Unusual options activity detection';
COMMENT ON INDEX idx_options_data_chain IS 'Efficient options chain queries';
COMMENT ON INDEX idx_options_data_greeks IS 'Query option Greeks';