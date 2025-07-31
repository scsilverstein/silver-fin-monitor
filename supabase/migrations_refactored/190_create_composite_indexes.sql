-- Create composite indexes for complex queries
-- Multi-table optimization for common join patterns

-- Stock data with earnings correlation
CREATE INDEX IF NOT EXISTS idx_stock_earnings_composite 
ON stock_data(symbol, date DESC) 
WHERE date IN (
    SELECT report_date FROM earnings_data 
    WHERE earnings_data.symbol = stock_data.symbol
);

-- News sentiment with stock performance
CREATE INDEX IF NOT EXISTS idx_news_stock_sentiment 
ON news_items(published_at DESC, sentiment_score) 
WHERE array_length(symbols, 1) > 0 AND sentiment_score IS NOT NULL;

-- Options unusual activity with stock movement
CREATE INDEX IF NOT EXISTS idx_options_stock_activity 
ON options_data(date DESC, symbol, volume_oi_ratio DESC) 
WHERE volume_oi_ratio > 2 AND volume > 100;

-- Analyst upgrades with price performance
CREATE INDEX IF NOT EXISTS idx_analyst_price_correlation 
ON analyst_ratings(rating_date DESC, symbol) 
WHERE rating_change = 'upgrade' AND price_target IS NOT NULL;

-- Scanner results with technical indicators
CREATE INDEX IF NOT EXISTS idx_scanner_technical_composite 
ON scanner_results(scan_date DESC, signal_strength DESC) 
WHERE scanner_type IN ('momentum', 'technical') AND signal_strength > 0.7;

-- Economic indicators with market correlation
CREATE INDEX IF NOT EXISTS idx_economic_market_impact 
ON economic_indicators(release_date DESC, importance DESC) 
WHERE importance >= 3 AND actual_value IS NOT NULL;

-- Portfolio performance with market correlation
CREATE INDEX IF NOT EXISTS idx_portfolio_market_composite 
ON portfolio_holdings(user_id, allocation_percentage DESC) 
WHERE position_value > 1000 AND unrealized_pnl IS NOT NULL;

-- Backtest results with strategy optimization
CREATE INDEX IF NOT EXISTS idx_backtest_optimization 
ON backtest_results(strategy_id, sharpe_ratio DESC, max_drawdown) 
WHERE status = 'completed' AND total_return > 0;

-- Knowledge graph entity relationships
CREATE INDEX IF NOT EXISTS idx_kg_entity_relationship_composite 
ON kg_relationships(source_entity_id, target_entity_id, relationship_type) 
WHERE strength > 0.5;

-- Feed processing efficiency
CREATE INDEX IF NOT EXISTS idx_feed_processing_composite 
ON raw_feeds(source_id, processing_status, published_at DESC) 
WHERE processing_status IN ('pending', 'processing', 'failed');

-- Add index comments
COMMENT ON INDEX idx_stock_earnings_composite IS 'Stock-earnings date correlation';
COMMENT ON INDEX idx_news_stock_sentiment IS 'News sentiment impact on stocks';
COMMENT ON INDEX idx_options_stock_activity IS 'Options-stock movement correlation';
COMMENT ON INDEX idx_analyst_price_correlation IS 'Analyst upgrades vs price';
COMMENT ON INDEX idx_scanner_technical_composite IS 'Scanner-technical indicator alignment';
COMMENT ON INDEX idx_economic_market_impact IS 'Economic indicator market impact';
COMMENT ON INDEX idx_portfolio_market_composite IS 'Portfolio-market correlation';
COMMENT ON INDEX idx_backtest_optimization IS 'Strategy optimization queries';
COMMENT ON INDEX idx_kg_entity_relationship_composite IS 'Graph traversal optimization';
COMMENT ON INDEX idx_feed_processing_composite IS 'Feed processing efficiency';