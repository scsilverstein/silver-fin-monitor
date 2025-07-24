-- Create prediction_comparisons table for accuracy tracking
CREATE TABLE IF NOT EXISTS prediction_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_date DATE NOT NULL,
    previous_prediction_id UUID REFERENCES predictions(id) ON DELETE CASCADE,
    current_analysis_id UUID REFERENCES daily_analysis(id) ON DELETE CASCADE,
    accuracy_score FLOAT CHECK (accuracy_score BETWEEN 0 AND 1),
    outcome_description TEXT,
    comparison_analysis JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prediction_comparisons_prediction 
    ON prediction_comparisons(previous_prediction_id);

CREATE INDEX IF NOT EXISTS idx_prediction_comparisons_analysis 
    ON prediction_comparisons(current_analysis_id);

CREATE INDEX IF NOT EXISTS idx_prediction_comparisons_date 
    ON prediction_comparisons(comparison_date DESC);

-- Add a unique constraint to prevent duplicate comparisons
CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_comparisons_unique 
    ON prediction_comparisons(previous_prediction_id, comparison_date);

-- Grant appropriate permissions
GRANT ALL ON prediction_comparisons TO authenticated;
GRANT SELECT ON prediction_comparisons TO anon;

-- Add RLS policies
ALTER TABLE prediction_comparisons ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all comparisons
CREATE POLICY "Authenticated users can view all prediction comparisons" ON prediction_comparisons
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy for service role to manage comparisons
CREATE POLICY "Service role can manage prediction comparisons" ON prediction_comparisons
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add a comment explaining the table
COMMENT ON TABLE prediction_comparisons IS 'Tracks the accuracy of predictions by comparing them with actual outcomes over time';
COMMENT ON COLUMN prediction_comparisons.previous_prediction_id IS 'Reference to the original prediction being evaluated';
COMMENT ON COLUMN prediction_comparisons.current_analysis_id IS 'Reference to the analysis used to evaluate the prediction';
COMMENT ON COLUMN prediction_comparisons.accuracy_score IS 'Score between 0 and 1 indicating how accurate the prediction was';
COMMENT ON COLUMN prediction_comparisons.outcome_description IS 'Human-readable description of what actually happened vs what was predicted';
COMMENT ON COLUMN prediction_comparisons.comparison_analysis IS 'Detailed JSON analysis of the comparison including factors that influenced accuracy';