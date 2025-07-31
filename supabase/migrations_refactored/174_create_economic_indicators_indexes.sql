-- Create indexes for economic_indicators table
-- Support economic data analysis

-- Primary index for indicator and date
CREATE INDEX IF NOT EXISTS idx_economic_indicators_primary 
ON economic_indicators(indicator_code, release_date DESC);

-- Index for release date queries
CREATE INDEX IF NOT EXISTS idx_economic_indicators_date 
ON economic_indicators(release_date DESC);

-- Index for country-specific data
CREATE INDEX IF NOT EXISTS idx_economic_indicators_country 
ON economic_indicators(country, release_date DESC) 
WHERE country IS NOT NULL;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_economic_indicators_category 
ON economic_indicators(category, release_date DESC);

-- Index for importance filtering
CREATE INDEX IF NOT EXISTS idx_economic_indicators_importance 
ON economic_indicators(importance DESC, release_date DESC) 
WHERE importance >= 3;

-- Index for surprise analysis
CREATE INDEX IF NOT EXISTS idx_economic_indicators_surprise 
ON economic_indicators(release_date DESC, abs(actual_value - forecast_value) DESC) 
WHERE actual_value IS NOT NULL AND forecast_value IS NOT NULL;

-- Index for period-specific queries
CREATE INDEX IF NOT EXISTS idx_economic_indicators_period 
ON economic_indicators(indicator_code, period_year DESC, period_month DESC NULLS LAST);

-- JSONB index for metadata
CREATE INDEX IF NOT EXISTS idx_economic_indicators_metadata 
ON economic_indicators USING GIN(metadata);

-- Index for scheduled releases
CREATE INDEX IF NOT EXISTS idx_economic_indicators_scheduled 
ON economic_indicators(release_date) 
WHERE actual_value IS NULL AND release_date >= CURRENT_DATE;

-- Add index comments
COMMENT ON INDEX idx_economic_indicators_primary IS 'Primary indicator lookup';
COMMENT ON INDEX idx_economic_indicators_date IS 'Date-ordered releases';
COMMENT ON INDEX idx_economic_indicators_country IS 'Country-specific data';
COMMENT ON INDEX idx_economic_indicators_category IS 'Category filtering';
COMMENT ON INDEX idx_economic_indicators_importance IS 'High importance indicators';
COMMENT ON INDEX idx_economic_indicators_surprise IS 'Economic surprises';
COMMENT ON INDEX idx_economic_indicators_period IS 'Period-based queries';
COMMENT ON INDEX idx_economic_indicators_metadata IS 'Metadata queries';
COMMENT ON INDEX idx_economic_indicators_scheduled IS 'Upcoming releases';