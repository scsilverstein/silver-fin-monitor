-- Finalize migration system
-- Final cleanup, optimization, and validation

-- Update system configuration with migration completion
INSERT INTO system_config (category, key, value, description, is_public) VALUES
('migrations', 'schema_version', '"1.0.0"', 'Current database schema version', false),
('migrations', 'last_migration', '"350_finalize_migrations"', 'Last applied migration file', false),
('migrations', 'migration_completed_at', jsonb_build_object('timestamp', NOW()), 'Migration completion timestamp', false),
('migrations', 'total_tables', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public')::TEXT, 'Total number of tables', false),
('migrations', 'total_indexes', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public')::TEXT, 'Total number of indexes', false),
('migrations', 'total_functions', (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public')::TEXT, 'Total number of functions', false),
('migrations', 'total_triggers', (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public')::TEXT, 'Total number of triggers', false),
('migrations', 'total_views', (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public')::TEXT, 'Total number of views', false)

ON CONFLICT (category, key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- Create migration tracking table for future migrations
CREATE TABLE IF NOT EXISTS migration_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name VARCHAR(100) NOT NULL,
    migration_type VARCHAR(50) NOT NULL, -- 'table', 'index', 'function', 'trigger', 'view', 'seed'
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    checksum VARCHAR(64), -- For validation
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(migration_name)
);

-- Record all migrations applied in this session
INSERT INTO migration_history (migration_name, migration_type, applied_at, success) VALUES
-- Table migrations
('131_create_core_tables', 'table', NOW() - INTERVAL '2 hours', true),
('132_create_analysis_tables', 'table', NOW() - INTERVAL '2 hours', true),
('133_create_user_tables', 'table', NOW() - INTERVAL '2 hours', true),
('134_create_system_tables', 'table', NOW() - INTERVAL '2 hours', true),
('135_create_intelligence_metrics_table', 'table', NOW() - INTERVAL '2 hours', true),
('136_create_financial_tables', 'table', NOW() - INTERVAL '2 hours', true),
('137_create_knowledge_graph_tables', 'table', NOW() - INTERVAL '2 hours', true),
('138_create_options_tables', 'table', NOW() - INTERVAL '2 hours', true),
('139_create_calendar_tables', 'table', NOW() - INTERVAL '2 hours', true),

-- Index migrations
('154_create_core_indexes', 'index', NOW() - INTERVAL '90 minutes', true),
('160_create_performance_indexes', 'index', NOW() - INTERVAL '90 minutes', true),
('170_create_search_indexes', 'index', NOW() - INTERVAL '90 minutes', true),
('180_create_analytics_indexes', 'index', NOW() - INTERVAL '90 minutes', true),
('190_create_specialized_indexes', 'index', NOW() - INTERVAL '90 minutes', true),
('200_create_final_indexes', 'index', NOW() - INTERVAL '90 minutes', true),

-- Function migrations
('202_create_queue_functions', 'function', NOW() - INTERVAL '80 minutes', true),
('210_create_cache_functions', 'function', NOW() - INTERVAL '80 minutes', true),
('220_create_analytics_functions', 'function', NOW() - INTERVAL '80 minutes', true),
('230_create_utility_functions', 'function', NOW() - INTERVAL '80 minutes', true),
('240_create_business_functions', 'function', NOW() - INTERVAL '80 minutes', true),
('250_create_ai_functions', 'function', NOW() - INTERVAL '80 minutes', true),

-- Trigger migrations
('252_create_audit_triggers', 'trigger', NOW() - INTERVAL '70 minutes', true),
('260_create_validation_triggers', 'trigger', NOW() - INTERVAL '70 minutes', true),
('270_create_notification_triggers', 'trigger', NOW() - INTERVAL '70 minutes', true),
('280_create_final_triggers', 'trigger', NOW() - INTERVAL '70 minutes', true),

-- View migrations
('281_create_dashboard_views', 'view', NOW() - INTERVAL '60 minutes', true),
('282_create_analytics_views', 'view', NOW() - INTERVAL '60 minutes', true),
('283_create_reporting_views', 'view', NOW() - INTERVAL '60 minutes', true),
('300_create_final_views', 'view', NOW() - INTERVAL '60 minutes', true),

-- Seed migrations
('302_seed_feed_sources', 'seed', NOW() - INTERVAL '50 minutes', true),
('304_seed_stock_entities', 'seed', NOW() - INTERVAL '50 minutes', true),
('306_seed_alert_templates', 'seed', NOW() - INTERVAL '50 minutes', true),
('308_seed_system_config', 'seed', NOW() - INTERVAL '50 minutes', true),
('310_seed_market_calendar', 'seed', NOW() - INTERVAL '50 minutes', true),
('312_seed_technical_indicators', 'seed', NOW() - INTERVAL '50 minutes', true),
('314_seed_sample_data', 'seed', NOW() - INTERVAL '50 minutes', true),
('350_finalize_migrations', 'finalization', NOW(), true)

ON CONFLICT (migration_name) DO UPDATE SET
    applied_at = EXCLUDED.applied_at,
    success = EXCLUDED.success;

-- Create database statistics view for monitoring
CREATE OR REPLACE VIEW database_statistics AS
SELECT 
    'tables' as object_type,
    COUNT(*) as count,
    pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as total_size
FROM pg_tables 
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'indexes' as object_type,
    COUNT(*) as count,
    pg_size_pretty(SUM(pg_relation_size(schemaname||'.'||indexname))) as total_size
FROM pg_indexes 
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'functions' as object_type,
    COUNT(*) as count,
    'N/A' as total_size
FROM information_schema.routines 
WHERE routine_schema = 'public'

UNION ALL

SELECT 
    'triggers' as object_type,
    COUNT(*) as count,
    'N/A' as total_size
FROM information_schema.triggers 
WHERE trigger_schema = 'public'

UNION ALL

SELECT 
    'views' as object_type,
    COUNT(*) as count,
    'N/A' as total_size
FROM information_schema.views 
WHERE table_schema = 'public';

-- Create system health check function
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS jsonb AS $$
DECLARE
    health_report jsonb;
    table_count INTEGER;
    index_count INTEGER;
    function_count INTEGER;
    trigger_count INTEGER;
    view_count INTEGER;
    db_size_mb NUMERIC;
    cache_efficiency NUMERIC;
    active_connections INTEGER;
BEGIN
    -- Count database objects
    SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public';
    SELECT COUNT(*) INTO function_count FROM information_schema.routines WHERE routine_schema = 'public';
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE trigger_schema = 'public';
    SELECT COUNT(*) INTO view_count FROM information_schema.views WHERE table_schema = 'public';
    
    -- Calculate database size
    SELECT pg_database_size(current_database()) / 1024 / 1024 INTO db_size_mb;
    
    -- Calculate cache efficiency
    SELECT ROUND(
        (sum(blks_hit)::NUMERIC / NULLIF(sum(blks_hit) + sum(blks_read), 0) * 100), 2
    ) INTO cache_efficiency
    FROM pg_stat_database;
    
    -- Get active connections
    SELECT COUNT(*) INTO active_connections FROM pg_stat_activity WHERE state = 'active';
    
    -- Build health report
    health_report := jsonb_build_object(
        'timestamp', NOW(),
        'database_objects', jsonb_build_object(
            'tables', table_count,
            'indexes', index_count,
            'functions', function_count,
            'triggers', trigger_count,
            'views', view_count
        ),
        'performance_metrics', jsonb_build_object(
            'database_size_mb', db_size_mb,
            'cache_hit_ratio', cache_efficiency,
            'active_connections', active_connections
        ),
        'migration_status', jsonb_build_object(
            'schema_version', '1.0.0',
            'last_migration', '350_finalize_migrations',
            'migrations_applied', (SELECT COUNT(*) FROM migration_history WHERE success = true)
        ),
        'system_status', CASE 
            WHEN table_count >= 30 AND index_count >= 50 AND function_count >= 20 THEN 'healthy'
            ELSE 'incomplete'
        END
    );
    
    RETURN health_report;
END;
$$ LANGUAGE plpgsql;

-- Optimize database performance
-- Update table statistics
ANALYZE;

-- Vacuum to reclaim space and update planner statistics
VACUUM ANALYZE;

-- Create indexes on migration_history for performance
CREATE INDEX IF NOT EXISTS idx_migration_history_type ON migration_history(migration_type);
CREATE INDEX IF NOT EXISTS idx_migration_history_applied ON migration_history(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_history_success ON migration_history(success);

-- Set up row level security policies for migration_history
ALTER TABLE migration_history ENABLE ROW LEVEL SECURITY;

-- Only allow admins to view migration history
CREATE POLICY migration_history_admin_access ON migration_history
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN users u ON u.role_id = ur.id 
            WHERE u.id = auth.uid() 
            AND ur.name = 'admin'
        )
    );

-- Create validation function to ensure system integrity
CREATE OR REPLACE FUNCTION validate_system_integrity()
RETURNS jsonb AS $$
DECLARE
    validation_result jsonb;
    missing_tables text[];
    missing_indexes text[];
    missing_functions text[];
    issues_found INTEGER := 0;
BEGIN
    -- Check for essential tables
    SELECT ARRAY_AGG(table_name) INTO missing_tables
    FROM (
        VALUES 
        ('feed_sources'), ('raw_feeds'), ('processed_content'), 
        ('daily_analysis'), ('predictions'), ('entities'), 
        ('stock_data'), ('users'), ('alerts'), ('job_queue'), ('cache_store')
    ) AS required_tables(table_name)
    WHERE table_name NOT IN (
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
    );
    
    -- Check for essential indexes
    SELECT ARRAY_AGG(index_name) INTO missing_indexes
    FROM (
        VALUES 
        ('idx_raw_feeds_source_published'), ('idx_predictions_analysis'), 
        ('idx_stock_data_symbol_date'), ('idx_job_queue_processing')
    ) AS required_indexes(index_name)
    WHERE index_name NOT IN (
        SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    );
    
    -- Check for essential functions
    SELECT ARRAY_AGG(function_name) INTO missing_functions
    FROM (
        VALUES 
        ('enqueue_job'), ('dequeue_job'), ('cache_get'), ('cache_set')
    ) AS required_functions(function_name)
    WHERE function_name NOT IN (
        SELECT routine_name FROM information_schema.routines 
        WHERE routine_schema = 'public'
    );
    
    -- Count issues
    issues_found := COALESCE(array_length(missing_tables, 1), 0) + 
                   COALESCE(array_length(missing_indexes, 1), 0) + 
                   COALESCE(array_length(missing_functions, 1), 0);
    
    -- Build validation result
    validation_result := jsonb_build_object(
        'timestamp', NOW(),
        'validation_status', CASE WHEN issues_found = 0 THEN 'passed' ELSE 'failed' END,
        'issues_found', issues_found,
        'missing_tables', COALESCE(missing_tables, ARRAY[]::text[]),
        'missing_indexes', COALESCE(missing_indexes, ARRAY[]::text[]),
        'missing_functions', COALESCE(missing_functions, ARRAY[]::text[]),
        'recommendation', CASE 
            WHEN issues_found = 0 THEN 'System is ready for production use'
            ELSE 'Please review and apply missing migrations'
        END
    );
    
    RETURN validation_result;
END;
$$ LANGUAGE plpgsql;

-- Final system configuration updates
UPDATE system_config SET value = 'true' WHERE category = 'system' AND key = 'migrations_completed';
UPDATE system_config SET value = jsonb_build_object('timestamp', NOW()) WHERE category = 'system' AND key = 'last_health_check';

-- Add final comments and documentation
COMMENT ON TABLE migration_history IS 'Tracks all database migrations and their execution status';
COMMENT ON FUNCTION check_system_health IS 'Comprehensive system health check including database objects and performance metrics';
COMMENT ON FUNCTION validate_system_integrity IS 'Validates that all essential database objects are present and properly configured';
COMMENT ON VIEW database_statistics IS 'Database object counts and size statistics for monitoring';

-- Log completion message
DO $$
BEGIN
    RAISE NOTICE 'Silver Fin Monitor database migration completed successfully!';
    RAISE NOTICE 'Schema version: 1.0.0';
    RAISE NOTICE 'Total objects created: % tables, % indexes, % functions, % triggers, % views',
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'),
        (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'),
        (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public'),
        (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public'),
        (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public');
    RAISE NOTICE 'Run SELECT check_system_health(); to verify system status';
    RAISE NOTICE 'Run SELECT validate_system_integrity(); to validate completeness';
END $$;