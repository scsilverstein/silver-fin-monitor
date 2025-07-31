-- Create indexes for backtest_results table
-- Support strategy analysis and optimization

-- Primary index for strategy backtests
CREATE INDEX IF NOT EXISTS idx_backtest_results_strategy 
ON backtest_results(strategy_id, completed_at DESC);

-- Index for user backtests
CREATE INDEX IF NOT EXISTS idx_backtest_results_user 
ON backtest_results(user_id, completed_at DESC);

-- Index for performance ranking
CREATE INDEX IF NOT EXISTS idx_backtest_results_performance 
ON backtest_results(total_return DESC, sharpe_ratio DESC) 
WHERE status = 'completed';

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_backtest_results_period 
ON backtest_results(start_date, end_date);

-- Index for status tracking
CREATE INDEX IF NOT EXISTS idx_backtest_results_status 
ON backtest_results(status, created_at DESC) 
WHERE status IN ('running', 'queued');

-- JSONB index for parameters
CREATE INDEX IF NOT EXISTS idx_backtest_results_params 
ON backtest_results USING GIN(parameters);

-- JSONB index for metrics
CREATE INDEX IF NOT EXISTS idx_backtest_results_metrics 
ON backtest_results USING GIN(performance_metrics);

-- Index for high Sharpe ratio strategies
CREATE INDEX IF NOT EXISTS idx_backtest_results_sharpe 
ON backtest_results(sharpe_ratio DESC) 
WHERE sharpe_ratio > 1.0 AND status = 'completed';

-- Index for low drawdown strategies
CREATE INDEX IF NOT EXISTS idx_backtest_results_drawdown 
ON backtest_results(max_drawdown) 
WHERE max_drawdown > -0.2 AND status = 'completed';

-- Index for win rate analysis
CREATE INDEX IF NOT EXISTS idx_backtest_results_winrate 
ON backtest_results(win_rate DESC) 
WHERE win_rate > 0.5 AND status = 'completed';

-- Add index comments
COMMENT ON INDEX idx_backtest_results_strategy IS 'Strategy backtest history';
COMMENT ON INDEX idx_backtest_results_user IS 'User backtest results';
COMMENT ON INDEX idx_backtest_results_performance IS 'Performance ranking';
COMMENT ON INDEX idx_backtest_results_period IS 'Time period analysis';
COMMENT ON INDEX idx_backtest_results_status IS 'Active backtest tracking';
COMMENT ON INDEX idx_backtest_results_params IS 'Parameter search';
COMMENT ON INDEX idx_backtest_results_metrics IS 'Metric analysis';
COMMENT ON INDEX idx_backtest_results_sharpe IS 'High Sharpe strategies';
COMMENT ON INDEX idx_backtest_results_drawdown IS 'Low drawdown strategies';
COMMENT ON INDEX idx_backtest_results_winrate IS 'High win rate strategies';