-- Create indexes for strategy_signals table
-- Optimize signal generation and tracking

-- Primary index for strategy signals
CREATE INDEX IF NOT EXISTS idx_strategy_signals_strategy 
ON strategy_signals(strategy_id, signal_date DESC);

-- Index for symbol signals
CREATE INDEX IF NOT EXISTS idx_strategy_signals_symbol 
ON strategy_signals(symbol, signal_date DESC);

-- Index for signal type filtering
CREATE INDEX IF NOT EXISTS idx_strategy_signals_type 
ON strategy_signals(signal_type, signal_date DESC);

-- Index for active signals
CREATE INDEX IF NOT EXISTS idx_strategy_signals_active 
ON strategy_signals(is_active, signal_date DESC) 
WHERE is_active = true;

-- Index for signal strength
CREATE INDEX IF NOT EXISTS idx_strategy_signals_strength 
ON strategy_signals(signal_strength DESC, signal_date DESC) 
WHERE signal_strength > 0.7;

-- Index for executed signals
CREATE INDEX IF NOT EXISTS idx_strategy_signals_executed 
ON strategy_signals(executed_at DESC) 
WHERE executed_at IS NOT NULL;

-- Index for signal performance tracking
CREATE INDEX IF NOT EXISTS idx_strategy_signals_performance 
ON strategy_signals(signal_return DESC) 
WHERE signal_return IS NOT NULL;

-- JSONB index for signal data
CREATE INDEX IF NOT EXISTS idx_strategy_signals_data 
ON strategy_signals USING GIN(signal_data);

-- Index for stop loss monitoring
CREATE INDEX IF NOT EXISTS idx_strategy_signals_stops 
ON strategy_signals(symbol, stop_price) 
WHERE is_active = true AND stop_price IS NOT NULL;

-- Index for target price monitoring
CREATE INDEX IF NOT EXISTS idx_strategy_signals_targets 
ON strategy_signals(symbol, target_price) 
WHERE is_active = true AND target_price IS NOT NULL;

-- Add index comments
COMMENT ON INDEX idx_strategy_signals_strategy IS 'Strategy signal history';
COMMENT ON INDEX idx_strategy_signals_symbol IS 'Symbol signal lookup';
COMMENT ON INDEX idx_strategy_signals_type IS 'Signal type filtering';
COMMENT ON INDEX idx_strategy_signals_active IS 'Active signal monitoring';
COMMENT ON INDEX idx_strategy_signals_strength IS 'High confidence signals';
COMMENT ON INDEX idx_strategy_signals_executed IS 'Executed signal tracking';
COMMENT ON INDEX idx_strategy_signals_performance IS 'Signal performance analysis';
COMMENT ON INDEX idx_strategy_signals_data IS 'Signal data queries';
COMMENT ON INDEX idx_strategy_signals_stops IS 'Stop loss monitoring';
COMMENT ON INDEX idx_strategy_signals_targets IS 'Target price monitoring';