-- Create migration tracking table
-- This must be run first to track all subsequent migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    checksum VARCHAR(64),
    applied_by VARCHAR(255) DEFAULT CURRENT_USER,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Add table comment
COMMENT ON TABLE schema_migrations IS 'Tracks applied database migrations for version control';

-- Add column comments
COMMENT ON COLUMN schema_migrations.version IS 'Migration version number (e.g., 001, 002)';
COMMENT ON COLUMN schema_migrations.name IS 'Migration file name';
COMMENT ON COLUMN schema_migrations.executed_at IS 'When the migration was executed';
COMMENT ON COLUMN schema_migrations.execution_time_ms IS 'How long the migration took to run';
COMMENT ON COLUMN schema_migrations.checksum IS 'SHA256 hash of migration file for integrity check';
COMMENT ON COLUMN schema_migrations.applied_by IS 'Database user who ran the migration';
COMMENT ON COLUMN schema_migrations.success IS 'Whether the migration completed successfully';
COMMENT ON COLUMN schema_migrations.error_message IS 'Error details if migration failed';

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at 
ON schema_migrations(executed_at DESC);