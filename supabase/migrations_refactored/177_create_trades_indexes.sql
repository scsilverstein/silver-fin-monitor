-- Create indexes for trades table
-- Optimize trade history and analysis

-- Primary index for user trades
CREATE INDEX IF NOT EXISTS idx_trades_user 
ON trades(user_id, executed_at DESC);

-- Index for portfolio trades
CREATE INDEX IF NOT EXISTS idx_trades_portfolio 
ON trades(portfolio_id, executed_at DESC);

-- Index for symbol-specific trades
CREATE INDEX IF NOT EXISTS idx_trades_symbol 
ON trades(symbol, executed_at DESC);

-- Index for trade type analysis
CREATE INDEX IF NOT EXISTS idx_trades_type 
ON trades(trade_type, executed_at DESC);

-- Index for order status tracking
CREATE INDEX IF NOT EXISTS idx_trades_status 
ON trades(order_status, created_at DESC) 
WHERE order_status IN ('pending', 'partial');

-- Index for executed trades
CREATE INDEX IF NOT EXISTS idx_trades_executed 
ON trades(executed_at DESC) 
WHERE order_status = 'executed';

-- Index for large trades
CREATE INDEX IF NOT EXISTS idx_trades_large 
ON trades(executed_at DESC, total_amount DESC) 
WHERE total_amount > 10000;

-- Index for profit/loss analysis
CREATE INDEX IF NOT EXISTS idx_trades_pnl 
ON trades(user_id, realized_pnl DESC) 
WHERE realized_pnl IS NOT NULL;

-- JSONB index for execution details
CREATE INDEX IF NOT EXISTS idx_trades_execution 
ON trades USING GIN(execution_details);

-- Index for commission tracking
CREATE INDEX IF NOT EXISTS idx_trades_commission 
ON trades(executed_at DESC, commission DESC) 
WHERE commission > 0;

-- Add index comments
COMMENT ON INDEX idx_trades_user IS 'User trade history';
COMMENT ON INDEX idx_trades_portfolio IS 'Portfolio trade activity';
COMMENT ON INDEX idx_trades_symbol IS 'Symbol trade history';
COMMENT ON INDEX idx_trades_type IS 'Trade type analysis';
COMMENT ON INDEX idx_trades_status IS 'Pending order tracking';
COMMENT ON INDEX idx_trades_executed IS 'Completed trades';
COMMENT ON INDEX idx_trades_large IS 'Large trade monitoring';
COMMENT ON INDEX idx_trades_pnl IS 'Profit/loss ranking';
COMMENT ON INDEX idx_trades_execution IS 'Execution detail queries';
COMMENT ON INDEX idx_trades_commission IS 'Commission analysis';