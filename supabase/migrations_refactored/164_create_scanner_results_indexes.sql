-- Create indexes for scanner_results table
-- Support efficient scanning and filtering

-- Primary index for date-based queries
CREATE INDEX IF NOT EXISTS idx_scanner_results_date 
ON scanner_results(scan_date DESC, scanner_type);

-- Index for symbol lookups
CREATE INDEX IF NOT EXISTS idx_scanner_results_symbol 
ON scanner_results(symbol, scan_date DESC);

-- Index for scanner type filtering
CREATE INDEX IF NOT EXISTS idx_scanner_results_type 
ON scanner_results(scanner_type, scan_date DESC);

-- Composite score ranking
CREATE INDEX IF NOT EXISTS idx_scanner_results_score 
ON scanner_results(scan_date DESC, score DESC NULLS LAST);

-- Index for signal strength filtering
CREATE INDEX IF NOT EXISTS idx_scanner_results_signals 
ON scanner_results(scan_date DESC, signal_strength DESC) 
WHERE signal_strength > 0.7;

-- JSONB index for metrics queries
CREATE INDEX IF NOT EXISTS idx_scanner_results_metrics 
ON scanner_results USING GIN(metrics);

-- Index for finding top movers
CREATE INDEX IF NOT EXISTS idx_scanner_results_movers 
ON scanner_results(scan_date, (metrics->>'change_percent')::numeric DESC) 
WHERE metrics ? 'change_percent';

-- Index for sector-based scans
CREATE INDEX IF NOT EXISTS idx_scanner_results_sector 
ON scanner_results(scan_date DESC, (metrics->>'sector')) 
WHERE metrics ? 'sector';

-- Index for alert generation
CREATE INDEX IF NOT EXISTS idx_scanner_results_alerts 
ON scanner_results(scan_date DESC, signal_strength DESC) 
WHERE alert_triggered = true;

-- Add index comments
COMMENT ON INDEX idx_scanner_results_date IS 'Date-based scanner queries';
COMMENT ON INDEX idx_scanner_results_symbol IS 'Symbol-specific scan history';
COMMENT ON INDEX idx_scanner_results_type IS 'Filter by scanner type';
COMMENT ON INDEX idx_scanner_results_score IS 'Rank by composite score';
COMMENT ON INDEX idx_scanner_results_signals IS 'High signal strength results';
COMMENT ON INDEX idx_scanner_results_metrics IS 'Query scanner metrics';
COMMENT ON INDEX idx_scanner_results_movers IS 'Find biggest movers';
COMMENT ON INDEX idx_scanner_results_sector IS 'Sector-based analysis';
COMMENT ON INDEX idx_scanner_results_alerts IS 'Triggered alerts';