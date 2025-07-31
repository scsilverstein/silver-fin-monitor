-- Schema verification script
-- Run this to verify all migrations were applied correctly

\echo '====================================='
\echo 'Silver Fin Monitor Schema Verification'
\echo '====================================='
\echo ''

-- Check extensions
\echo 'Installed Extensions:'
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector', 'pg_trgm', 'btree_gist')
ORDER BY extname;

\echo ''
\echo 'Missing Extensions:'
SELECT unnest(ARRAY['uuid-ossp', 'pgcrypto', 'vector', 'pg_trgm', 'btree_gist']) as required_extension
EXCEPT
SELECT extname FROM pg_extension;

-- Check tables
\echo ''
\echo 'Table Summary:'
SELECT 
    COUNT(*) as total_tables,
    COUNT(*) FILTER (WHERE table_name LIKE 'kg_%') as knowledge_graph_tables,
    COUNT(*) FILTER (WHERE table_name LIKE '%feeds%' OR table_name LIKE '%content%') as content_tables,
    COUNT(*) FILTER (WHERE table_name LIKE '%market%' OR table_name LIKE '%stock%') as market_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- Check critical tables exist
\echo ''
\echo 'Critical Tables Check:'
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'feed_sources', 'raw_feeds', 'processed_content', 'daily_analysis', 'predictions',
        'job_queue', 'cache_store', 'entities', 'sectors', 'industries',
        'market_data_daily', 'fundamental_metrics', 'kg_entities', 'kg_relationships'
    ]) as table_name
)
SELECT 
    rt.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM required_tables rt
LEFT JOIN information_schema.tables t 
    ON t.table_name = rt.table_name 
    AND t.table_schema = 'public'
ORDER BY rt.table_name;

-- Check indexes
\echo ''
\echo 'Index Summary:'
SELECT 
    COUNT(*) as total_indexes,
    COUNT(*) FILTER (WHERE indexdef LIKE '%WHERE%') as partial_indexes,
    COUNT(*) FILTER (WHERE indexdef LIKE '%UNIQUE%') as unique_indexes
FROM pg_indexes 
WHERE schemaname = 'public';

-- Check functions
\echo ''
\echo 'Function Summary:'
SELECT 
    COUNT(*) as total_functions,
    COUNT(*) FILTER (WHERE proname LIKE '%queue%') as queue_functions,
    COUNT(*) FILTER (WHERE proname LIKE '%cache%') as cache_functions,
    COUNT(*) FILTER (WHERE proname LIKE '%entity%') as entity_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- Check triggers
\echo ''
\echo 'Trigger Summary:'
SELECT 
    COUNT(*) as total_triggers,
    COUNT(*) FILTER (WHERE trigger_name LIKE '%updated_at%') as update_triggers,
    COUNT(*) FILTER (WHERE trigger_name LIKE '%audit%') as audit_triggers
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Check constraints
\echo ''
\echo 'Constraint Summary:'
SELECT 
    constraint_type,
    COUNT(*) as count
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
GROUP BY constraint_type
ORDER BY constraint_type;

-- Check foreign key relationships
\echo ''
\echo 'Foreign Key Relationships:'
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name
LIMIT 20;

-- Check data
\echo ''
\echo 'Data Summary:'
WITH table_counts AS (
    SELECT 'feed_sources' as table_name, COUNT(*) as row_count FROM feed_sources
    UNION ALL SELECT 'raw_feeds', COUNT(*) FROM raw_feeds
    UNION ALL SELECT 'processed_content', COUNT(*) FROM processed_content  
    UNION ALL SELECT 'daily_analysis', COUNT(*) FROM daily_analysis
    UNION ALL SELECT 'predictions', COUNT(*) FROM predictions
    UNION ALL SELECT 'job_queue', COUNT(*) FROM job_queue WHERE status != 'completed'
    UNION ALL SELECT 'cache_store', COUNT(*) FROM cache_store
)
SELECT * FROM table_counts ORDER BY table_name;

-- Check for common issues
\echo ''
\echo 'Potential Issues:'

-- Missing indexes on foreign keys
WITH fk_columns AS (
    SELECT 
        tc.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
),
indexed_columns AS (
    SELECT 
        tablename as table_name,
        unnest(string_to_array(
            substring(indexdef from '\(([^)]+)\)'), ', '
        )) as column_name
    FROM pg_indexes
    WHERE schemaname = 'public'
)
SELECT 
    'Missing index on foreign key' as issue_type,
    fk.table_name || '.' || fk.column_name as location
FROM fk_columns fk
LEFT JOIN indexed_columns ic 
    ON fk.table_name = ic.table_name 
    AND fk.column_name = ic.column_name
WHERE ic.column_name IS NULL
LIMIT 10;

\echo ''
\echo '====================================='
\echo 'Verification Complete'
\echo '====================================='