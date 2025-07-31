-- Create knowledge graph relationship history table
CREATE TABLE IF NOT EXISTS kg_relationship_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    change_reason TEXT,
    
    -- Constraints
    CONSTRAINT chk_kg_relationship_history_operation CHECK (
        operation IN ('INSERT', 'UPDATE', 'DELETE')
    )
);

-- Add table comment
COMMENT ON TABLE kg_relationship_history IS 'Complete audit trail for relationship changes';

-- Add column comments
COMMENT ON COLUMN kg_relationship_history.relationship_id IS 'ID of the relationship that was changed';
COMMENT ON COLUMN kg_relationship_history.operation IS 'Type of operation: INSERT, UPDATE, DELETE';
COMMENT ON COLUMN kg_relationship_history.changed_by IS 'User who made the change';
COMMENT ON COLUMN kg_relationship_history.old_values IS 'Previous values before change';
COMMENT ON COLUMN kg_relationship_history.new_values IS 'New values after change';
COMMENT ON COLUMN kg_relationship_history.change_reason IS 'Reason for the change if provided';