-- Create indexes for market_correlations table
-- Optimize correlation analysis queries

-- Primary index for symbol pairs
CREATE INDEX IF NOT EXISTS idx_market_correlations_symbols 
ON market_correlations(symbol1, symbol2, timeframe, calculated_date DESC);

-- Index for reverse lookup (symbol2 to symbol1)
CREATE INDEX IF NOT EXISTS idx_market_correlations_reverse 
ON market_correlations(symbol2, symbol1, timeframe, calculated_date DESC);

-- Index for high correlations
CREATE INDEX IF NOT EXISTS idx_market_correlations_high 
ON market_correlations(calculated_date DESC, abs(correlation_coefficient) DESC) 
WHERE abs(correlation_coefficient) > 0.7;

-- Index for timeframe analysis
CREATE INDEX IF NOT EXISTS idx_market_correlations_timeframe 
ON market_correlations(timeframe, calculated_date DESC);

-- Index for correlation type
CREATE INDEX IF NOT EXISTS idx_market_correlations_type 
ON market_correlations(correlation_type, calculated_date DESC);

-- Index for significant p-values
CREATE INDEX IF NOT EXISTS idx_market_correlations_significant 
ON market_correlations(calculated_date DESC, correlation_coefficient DESC) 
WHERE p_value < 0.05;

-- Index for period-specific queries
CREATE INDEX IF NOT EXISTS idx_market_correlations_period 
ON market_correlations(period_days, calculated_date DESC);

-- Index for finding uncorrelated pairs
CREATE INDEX IF NOT EXISTS idx_market_correlations_uncorrelated 
ON market_correlations(calculated_date DESC, abs(correlation_coefficient)) 
WHERE abs(correlation_coefficient) < 0.3;

-- Add index comments
COMMENT ON INDEX idx_market_correlations_symbols IS 'Symbol pair lookups';
COMMENT ON INDEX idx_market_correlations_reverse IS 'Reverse symbol lookups';
COMMENT ON INDEX idx_market_correlations_high IS 'Highly correlated pairs';
COMMENT ON INDEX idx_market_correlations_timeframe IS 'Timeframe-specific analysis';
COMMENT ON INDEX idx_market_correlations_type IS 'Correlation type filtering';
COMMENT ON INDEX idx_market_correlations_significant IS 'Statistically significant correlations';
COMMENT ON INDEX idx_market_correlations_period IS 'Period-based analysis';
COMMENT ON INDEX idx_market_correlations_uncorrelated IS 'Find hedge opportunities';