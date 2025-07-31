-- Create indexes for earnings_data table
-- Optimize earnings analysis queries

-- Primary index for symbol and date
CREATE INDEX IF NOT EXISTS idx_earnings_data_symbol_date 
ON earnings_data(symbol, report_date DESC);

-- Index for earnings date lookups
CREATE INDEX IF NOT EXISTS idx_earnings_data_date 
ON earnings_data(report_date DESC);

-- Index for fiscal period queries
CREATE INDEX IF NOT EXISTS idx_earnings_data_fiscal 
ON earnings_data(symbol, fiscal_year DESC, fiscal_quarter DESC);

-- Index for earnings surprises
CREATE INDEX IF NOT EXISTS idx_earnings_data_surprise 
ON earnings_data(report_date DESC, surprise_percent DESC NULLS LAST) 
WHERE surprise_percent IS NOT NULL;

-- Index for EPS beat/miss
CREATE INDEX IF NOT EXISTS idx_earnings_data_beat 
ON earnings_data(report_date DESC, symbol) 
WHERE actual_eps > estimated_eps;

-- Index for revenue analysis
CREATE INDEX IF NOT EXISTS idx_earnings_data_revenue 
ON earnings_data(symbol, report_date DESC, actual_revenue DESC) 
WHERE actual_revenue IS NOT NULL;

-- Index for guidance tracking
CREATE INDEX IF NOT EXISTS idx_earnings_data_guidance 
ON earnings_data(report_date DESC, has_guidance) 
WHERE has_guidance = true;

-- JSONB index for additional metrics
CREATE INDEX IF NOT EXISTS idx_earnings_data_metrics 
ON earnings_data USING GIN(additional_metrics);

-- Index for year-over-year growth
CREATE INDEX IF NOT EXISTS idx_earnings_data_growth 
ON earnings_data(symbol, yoy_revenue_growth DESC) 
WHERE yoy_revenue_growth IS NOT NULL;

-- Add index comments
COMMENT ON INDEX idx_earnings_data_symbol_date IS 'Symbol earnings history';
COMMENT ON INDEX idx_earnings_data_date IS 'Date-ordered earnings';
COMMENT ON INDEX idx_earnings_data_fiscal IS 'Fiscal period lookups';
COMMENT ON INDEX idx_earnings_data_surprise IS 'Earnings surprise ranking';
COMMENT ON INDEX idx_earnings_data_beat IS 'Earnings beats';
COMMENT ON INDEX idx_earnings_data_revenue IS 'Revenue analysis';
COMMENT ON INDEX idx_earnings_data_guidance IS 'Companies providing guidance';
COMMENT ON INDEX idx_earnings_data_metrics IS 'Additional earnings metrics';
COMMENT ON INDEX idx_earnings_data_growth IS 'Growth rate analysis';