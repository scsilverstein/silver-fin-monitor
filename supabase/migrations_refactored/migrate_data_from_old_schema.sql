-- Data migration script from old schema to new refactored schema
-- Run this AFTER all new schema migrations are complete

BEGIN;

-- Set session parameters for better performance
SET synchronous_commit = OFF;
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';

-- =====================================================
-- PHASE 1: Migrate core business data
-- =====================================================

-- Migrate feed_sources (if table exists in old schema)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'feed_sources_old') THEN
        
        INSERT INTO feed_sources (id, name, type, url, last_processed_at, is_active, config, created_at, updated_at)
        SELECT id, name, type, url, last_processed_at, is_active, config, created_at, updated_at
        FROM feed_sources_old
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Migrated % feed sources', (SELECT COUNT(*) FROM feed_sources_old);
    END IF;
END $$;

-- Migrate raw_feeds
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'raw_feeds_old') THEN
        
        INSERT INTO raw_feeds (id, source_id, title, description, content, published_at, 
                              external_id, metadata, processing_status, created_at)
        SELECT id, source_id, title, description, content, published_at,
               external_id, metadata, processing_status, created_at
        FROM raw_feeds_old
        WHERE source_id IN (SELECT id FROM feed_sources)
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Migrated % raw feeds', (SELECT COUNT(*) FROM raw_feeds_old);
    END IF;
END $$;

-- Migrate processed_content
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'processed_content_old') THEN
        
        INSERT INTO processed_content (id, raw_feed_id, processed_text, key_topics, 
                                      sentiment_score, entities, summary, processing_metadata, created_at)
        SELECT id, raw_feed_id, processed_text, key_topics,
               sentiment_score, entities, summary, processing_metadata, created_at
        FROM processed_content_old
        WHERE raw_feed_id IN (SELECT id FROM raw_feeds)
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Migrated % processed content items', (SELECT COUNT(*) FROM processed_content_old);
    END IF;
END $$;

-- =====================================================
-- PHASE 2: Update sequences
-- =====================================================

-- Reset sequences to max values to avoid conflicts
DO $$
DECLARE
    seq RECORD;
    max_id BIGINT;
BEGIN
    FOR seq IN 
        SELECT sequence_name, table_name, column_name
        FROM information_schema.sequences s
        JOIN information_schema.columns c ON c.column_default LIKE '%' || s.sequence_name || '%'
        WHERE s.sequence_schema = 'public'
    LOOP
        EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', seq.column_name, seq.table_name) INTO max_id;
        EXECUTE format('ALTER SEQUENCE %I RESTART WITH %s', seq.sequence_name, max_id + 1);
        RAISE NOTICE 'Reset sequence % to %', seq.sequence_name, max_id + 1;
    END LOOP;
END $$;

-- =====================================================
-- PHASE 3: Verify migration
-- =====================================================

-- Create migration summary
CREATE TEMP TABLE migration_summary AS
WITH counts AS (
    SELECT 'feed_sources' as table_name, COUNT(*) as row_count FROM feed_sources
    UNION ALL
    SELECT 'raw_feeds', COUNT(*) FROM raw_feeds
    UNION ALL
    SELECT 'processed_content', COUNT(*) FROM processed_content
    UNION ALL
    SELECT 'daily_analysis', COUNT(*) FROM daily_analysis
    UNION ALL
    SELECT 'predictions', COUNT(*) FROM predictions
)
SELECT * FROM counts WHERE row_count > 0;

-- Display summary
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== Migration Summary ===';
    FOR r IN SELECT * FROM migration_summary ORDER BY table_name LOOP
        RAISE NOTICE '% : % rows', rpad(r.table_name, 20), r.row_count;
    END LOOP;
END $$;

-- =====================================================
-- PHASE 4: Data integrity checks
-- =====================================================

-- Check for orphaned records
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    -- Check raw_feeds
    SELECT COUNT(*) INTO orphan_count
    FROM raw_feeds rf
    WHERE NOT EXISTS (SELECT 1 FROM feed_sources fs WHERE fs.id = rf.source_id);
    
    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % orphaned raw_feeds records', orphan_count;
    END IF;
    
    -- Check processed_content
    SELECT COUNT(*) INTO orphan_count
    FROM processed_content pc
    WHERE NOT EXISTS (SELECT 1 FROM raw_feeds rf WHERE rf.id = pc.raw_feed_id);
    
    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % orphaned processed_content records', orphan_count;
    END IF;
END $$;

-- =====================================================
-- PHASE 5: Cleanup (optional - uncomment to run)
-- =====================================================

-- Rename old tables (safer than dropping)
-- ALTER TABLE IF EXISTS feed_sources_old RENAME TO _archived_feed_sources;
-- ALTER TABLE IF EXISTS raw_feeds_old RENAME TO _archived_raw_feeds;
-- ALTER TABLE IF EXISTS processed_content_old RENAME TO _archived_processed_content;

-- Or drop old tables (dangerous - only after verification)
-- DROP TABLE IF EXISTS feed_sources_old CASCADE;
-- DROP TABLE IF EXISTS raw_feeds_old CASCADE;
-- DROP TABLE IF EXISTS processed_content_old CASCADE;

COMMIT;

-- Final summary
SELECT 
    'Migration complete. Please verify data integrity before removing old tables.' as message;