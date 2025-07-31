-- Create entity predictions table
CREATE TABLE IF NOT EXISTS entity_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    prediction_id UUID NOT NULL,
    
    -- Prediction specifics for this entity
    prediction_impact VARCHAR(20),
    confidence_level DECIMAL(5, 4),
    price_target DECIMAL(12, 2),
    target_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_entity_predictions_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_entity_predictions_prediction 
        FOREIGN KEY (prediction_id) 
        REFERENCES predictions(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_entity_predictions_impact CHECK (
        prediction_impact IS NULL OR 
        prediction_impact IN ('bullish', 'bearish', 'neutral')
    ),
    
    CONSTRAINT chk_entity_predictions_confidence CHECK (
        confidence_level IS NULL OR confidence_level BETWEEN 0 AND 1
    ),
    
    CONSTRAINT chk_entity_predictions_price CHECK (
        price_target IS NULL OR price_target > 0
    ),
    
    CONSTRAINT uq_entity_predictions 
        UNIQUE(entity_id, prediction_id)
);

-- Add table comment
COMMENT ON TABLE entity_predictions IS 'Links predictions to specific entities with targets';

-- Add column comments
COMMENT ON COLUMN entity_predictions.prediction_impact IS 'Expected impact on entity: bullish, bearish, neutral';
COMMENT ON COLUMN entity_predictions.confidence_level IS 'Confidence in this specific prediction (0-1)';
COMMENT ON COLUMN entity_predictions.price_target IS 'Predicted price target for the entity';
COMMENT ON COLUMN entity_predictions.target_date IS 'Date by which the target should be reached';