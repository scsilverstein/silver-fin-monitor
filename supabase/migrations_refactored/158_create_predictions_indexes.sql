-- Create indexes for predictions table
-- Performance and query optimization

-- Composite index for analysis-based queries
CREATE INDEX IF NOT EXISTS idx_predictions_analysis 
ON predictions(daily_analysis_id, created_at DESC);

-- Index for prediction type filtering
CREATE INDEX IF NOT EXISTS idx_predictions_type_horizon 
ON predictions(prediction_type, time_horizon, created_at DESC);

-- Index for high confidence predictions
CREATE INDEX IF NOT EXISTS idx_predictions_confidence 
ON predictions(confidence_level DESC, created_at DESC) 
WHERE confidence_level > 0.7;

-- Index for time horizon queries
CREATE INDEX IF NOT EXISTS idx_predictions_horizon 
ON predictions(time_horizon, created_at DESC);

-- Index for tracking prediction accuracy
CREATE INDEX IF NOT EXISTS idx_predictions_accuracy_tracking 
ON predictions(created_at, time_horizon, is_evaluated) 
WHERE is_evaluated = false;

-- Index for evaluated predictions
CREATE INDEX IF NOT EXISTS idx_predictions_evaluated 
ON predictions(is_evaluated, accuracy_score DESC) 
WHERE is_evaluated = true;

-- JSONB index for prediction data
CREATE INDEX IF NOT EXISTS idx_predictions_data 
ON predictions USING GIN(prediction_data);

-- Full text search on prediction text
CREATE INDEX IF NOT EXISTS idx_predictions_text_search 
ON predictions USING GIN(to_tsvector('english', prediction_text));

-- Add index comments
COMMENT ON INDEX idx_predictions_analysis IS 'Link predictions to daily analyses';
COMMENT ON INDEX idx_predictions_type_horizon IS 'Filter by type and time horizon';
COMMENT ON INDEX idx_predictions_confidence IS 'Find high confidence predictions';
COMMENT ON INDEX idx_predictions_horizon IS 'Query by time horizon';
COMMENT ON INDEX idx_predictions_accuracy_tracking IS 'Track unevaluated predictions';
COMMENT ON INDEX idx_predictions_evaluated IS 'Analyze evaluated predictions';
COMMENT ON INDEX idx_predictions_data IS 'Query prediction JSON data';
COMMENT ON INDEX idx_predictions_text_search IS 'Full text search on predictions';