-- Create indexes for technical_indicators table
-- Support technical analysis queries

-- Primary composite index
CREATE INDEX IF NOT EXISTS idx_technical_indicators_primary 
ON technical_indicators(symbol, indicator_type, timeframe, date DESC);

-- Index for latest indicators
CREATE INDEX IF NOT EXISTS idx_technical_indicators_latest 
ON technical_indicators(symbol, indicator_type, date DESC);

-- Index for indicator type queries
CREATE INDEX IF NOT EXISTS idx_technical_indicators_type 
ON technical_indicators(indicator_type, date DESC);

-- Index for timeframe-specific queries
CREATE INDEX IF NOT EXISTS idx_technical_indicators_timeframe 
ON technical_indicators(timeframe, date DESC);

-- Index for signal generation
CREATE INDEX IF NOT EXISTS idx_technical_indicators_signals 
ON technical_indicators(date DESC, signal) 
WHERE signal IS NOT NULL;

-- JSONB index for values
CREATE INDEX IF NOT EXISTS idx_technical_indicators_values 
ON technical_indicators USING GIN(values);

-- Index for RSI extremes
CREATE INDEX IF NOT EXISTS idx_technical_indicators_rsi_extremes 
ON technical_indicators(date DESC, symbol, (values->>'rsi')::numeric) 
WHERE indicator_type = 'RSI' AND 
      ((values->>'rsi')::numeric < 30 OR (values->>'rsi')::numeric > 70);

-- Index for MACD crossovers
CREATE INDEX IF NOT EXISTS idx_technical_indicators_macd_cross 
ON technical_indicators(date DESC, symbol) 
WHERE indicator_type = 'MACD' AND signal IN ('bullish_cross', 'bearish_cross');

-- Index for moving average analysis
CREATE INDEX IF NOT EXISTS idx_technical_indicators_ma 
ON technical_indicators(symbol, timeframe, date DESC) 
WHERE indicator_type IN ('SMA', 'EMA');

-- Add index comments
COMMENT ON INDEX idx_technical_indicators_primary IS 'Primary lookup for technical indicators';
COMMENT ON INDEX idx_technical_indicators_latest IS 'Latest indicator values';
COMMENT ON INDEX idx_technical_indicators_type IS 'Filter by indicator type';
COMMENT ON INDEX idx_technical_indicators_timeframe IS 'Timeframe-specific analysis';
COMMENT ON INDEX idx_technical_indicators_signals IS 'Trading signal detection';
COMMENT ON INDEX idx_technical_indicators_values IS 'Query indicator values';
COMMENT ON INDEX idx_technical_indicators_rsi_extremes IS 'RSI oversold/overbought';
COMMENT ON INDEX idx_technical_indicators_macd_cross IS 'MACD crossover signals';
COMMENT ON INDEX idx_technical_indicators_ma IS 'Moving average queries';