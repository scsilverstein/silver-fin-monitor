-- Create prediction comparisons table
CREATE TABLE IF NOT EXISTS prediction_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_date DATE NOT NULL,
    previous_prediction_id UUID,
    current_analysis_id UUID,
    accuracy_score FLOAT,
    outcome_description TEXT,
    comparison_analysis JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_prediction_comparisons_prediction 
        FOREIGN KEY (previous_prediction_id) 
        REFERENCES predictions(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_prediction_comparisons_analysis 
        FOREIGN KEY (current_analysis_id) 
        REFERENCES daily_analysis(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_prediction_comparisons_accuracy CHECK (
        accuracy_score BETWEEN 0 AND 1
    )
);

-- Add table comment
COMMENT ON TABLE prediction_comparisons IS 'Tracks prediction accuracy by comparing with actual outcomes';

-- Add column comments
COMMENT ON COLUMN prediction_comparisons.comparison_date IS 'Date the comparison was performed';
COMMENT ON COLUMN prediction_comparisons.previous_prediction_id IS 'The prediction being evaluated';
COMMENT ON COLUMN prediction_comparisons.current_analysis_id IS 'Current analysis to compare against';
COMMENT ON COLUMN prediction_comparisons.accuracy_score IS 'How accurate the prediction was (0-1)';
COMMENT ON COLUMN prediction_comparisons.outcome_description IS 'Human-readable description of the outcome';
COMMENT ON COLUMN prediction_comparisons.comparison_analysis IS 'Detailed analysis data from comparison';