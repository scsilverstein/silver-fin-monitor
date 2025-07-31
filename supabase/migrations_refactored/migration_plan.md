# Migration Refactoring Plan

## Goal
Create a clean, single-responsibility migration sequence with proper dependency ordering and no schema thrashing.

## Principles
1. **Single Responsibility**: Each migration does exactly ONE thing
2. **Dependency Order**: Tables created in order of dependencies
3. **No Renames/Drops**: Clean creation only
4. **Idempotent**: Safe to run multiple times

## Migration Sequence

### Phase 1: Extensions (001-010)
- 001_enable_uuid_extension.sql
- 002_enable_pgcrypto_extension.sql
- 003_enable_pgvector_extension.sql
- 004_enable_pg_trgm_extension.sql
- 005_enable_btree_gist_extension.sql

### Phase 2: Base Tables - No Foreign Keys (011-030)
- 011_create_feed_sources_table.sql
- 012_create_sectors_table.sql
- 013_create_cache_store_table.sql
- 014_create_job_queue_table.sql
- 015_create_daily_analysis_table.sql
- 016_create_kg_entity_types_table.sql
- 017_create_kg_relationship_types_table.sql

### Phase 3: Dependent Tables - Level 1 (031-060)
- 031_create_raw_feeds_table.sql
- 032_create_industries_table.sql
- 033_create_entities_table.sql
- 034_create_predictions_table.sql
- 035_create_kg_entities_table.sql
- 036_create_timeframe_analysis_table.sql

### Phase 4: Dependent Tables - Level 2 (061-100)
- 061_create_processed_content_table.sql
- 062_create_entity_classifications_table.sql
- 063_create_market_data_daily_table.sql
- 064_create_market_data_intraday_table.sql
- 065_create_fundamentals_table.sql
- 066_create_fundamental_metrics_table.sql
- 067_create_kg_relationships_table.sql
- 068_create_kg_entity_attributes_table.sql
- 069_create_prediction_comparisons_table.sql

### Phase 5: Dependent Tables - Level 3 (101-130)
- 101_create_kg_entity_mentions_table.sql
- 102_create_earnings_events_table.sql
- 103_create_earnings_transcripts_table.sql
- 104_create_earnings_reports_table.sql
- 105_create_options_chains_table.sql
- 106_create_options_market_data_table.sql
- 107_create_scanner_results_table.sql
- 108_create_entity_content_mapping_table.sql
- 109_create_entity_predictions_table.sql
- 110_create_unified_analytics_table.sql

### Phase 6: Complex Tables (131-150)
- 131_create_kg_entity_history_table.sql
- 132_create_kg_relationship_history_table.sql
- 133_create_kg_graph_layouts_table.sql
- 134_create_kg_entity_clusters_table.sql
- 135_create_intelligence_metrics_table.sql
- 136_create_intelligence_alert_rules_table.sql
- 137_create_intelligence_alerts_table.sql
- 138_create_feed_source_metrics_table.sql
- 139_create_derived_analytics_table.sql

### Phase 7: Indexes (151-200)
- 151_create_feed_sources_indexes.sql
- 152_create_raw_feeds_indexes.sql
- 153_create_processed_content_indexes.sql
- 154_create_daily_analysis_indexes.sql
- 155_create_predictions_indexes.sql
- 156_create_entities_indexes.sql
- 157_create_market_data_indexes.sql
- 158_create_kg_entities_indexes.sql
- 159_create_kg_relationships_indexes.sql
- 160_create_job_queue_indexes.sql

### Phase 8: Functions (201-250)
- 201_create_update_timestamp_function.sql
- 202_create_enqueue_job_function.sql
- 203_create_dequeue_job_function.sql
- 204_create_complete_job_function.sql
- 205_create_fail_job_function.sql
- 206_create_cache_get_function.sql
- 207_create_cache_set_function.sql
- 208_create_cache_delete_function.sql
- 209_create_cleanup_expired_data_function.sql
- 210_create_search_entities_function.sql
- 211_create_get_entity_details_function.sql

### Phase 9: Triggers (251-280)
- 251_create_feed_sources_update_trigger.sql
- 252_create_raw_feeds_update_trigger.sql
- 253_create_entities_update_trigger.sql
- 254_create_kg_entities_validation_trigger.sql
- 255_create_kg_relationships_validation_trigger.sql
- 256_create_kg_entities_audit_trigger.sql

### Phase 10: Views (281-300)
- 281_create_entity_quality_view.sql
- 282_create_relationship_quality_view.sql
- 283_create_market_overview_view.sql
- 284_create_scanner_overview_view.sql
- 285_create_earnings_calendar_view.sql

### Phase 11: Seed Data (301-350)
- 301_seed_sectors.sql
- 302_seed_industries.sql
- 303_seed_kg_entity_types.sql
- 304_seed_kg_relationship_types.sql
- 305_seed_feed_sources.sql

## Benefits
1. **Clear Dependencies**: No forward references
2. **Easy Rollback**: Each migration can be individually rolled back
3. **Debugging**: Easy to find where each object is created
4. **Testing**: Can test schema at any point in sequence
5. **Documentation**: Migration names are self-documenting
6. **CI/CD**: Perfect for automated deployment

## Rollback Strategy
Each migration will have a corresponding rollback file:
- down_001_enable_uuid_extension.sql -> DROP EXTENSION IF EXISTS "uuid-ossp";
- down_011_create_feed_sources_table.sql -> DROP TABLE IF EXISTS feed_sources;

## Implementation Notes
1. All CREATE statements use IF NOT EXISTS for idempotency
2. All foreign keys are named consistently: fk_[table]_[column]
3. All indexes are named consistently: idx_[table]_[columns]
4. All constraints are named consistently: chk_[table]_[constraint]
5. Comments are added to all tables and complex columns