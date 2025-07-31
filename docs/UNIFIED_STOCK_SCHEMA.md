# Unified Stock System Database Design

## Overview

The unified stock system consolidates all stock-related data into a cohesive, normalized structure optimized for daily analysis. This design eliminates duplication, ensures data integrity, and provides superior performance for complex queries.

## Key Design Principles

### 1. **Single Source of Truth**
- `entities` table serves as the master record for all tradeable securities
- No duplicate symbol storage across tables
- All related data references the entity via foreign keys

### 2. **Temporal Data Separation**
- **Point-in-time data**: `market_data_daily`, `fundamental_metrics`
- **Period data**: `fundamentals` (quarterly/annual)
- **Event data**: `earnings_events`, `options_flow`
- Clear distinction prevents confusion and improves query performance

### 3. **Flexible Classification**
- Normalized sector/industry hierarchy
- Support for multiple classifications per entity
- Time-based classification changes tracked

### 4. **Performance Optimization**
- Strategic indexes on all foreign keys and common query patterns
- Materialized views for expensive calculations
- Pre-computed analytics for dashboard performance
- Partitioning ready for large-scale data

## Core Tables Structure

### Entity Management

```sql
entities                    -- Master company/security records
├── sectors                 -- Sector classifications
├── industries             -- Industry classifications (under sectors)
└── entity_classifications -- Maps entities to industries
```

### Market Data

```sql
market_data_daily          -- Daily OHLCV data
market_data_intraday       -- Optional tick/minute data
technical_analysis         -- Computed technical indicators
```

### Fundamental Data

```sql
fundamentals               -- Quarterly/annual financial statements
fundamental_metrics        -- Daily snapshots of key ratios
```

### Earnings

```sql
earnings_events           -- Earnings calendar and results
earnings_estimates_history -- Tracks estimate changes over time
```

### Options

```sql
options_chains            -- All available option contracts
options_quotes            -- Real-time option pricing and Greeks
options_flow              -- Large/unusual options trades
```

### Analysis & Scanning

```sql
scanner_results           -- Unified scanner output (all types)
peer_groups              -- Define comparison groups
peer_group_members       -- Entities in each peer group
daily_analytics          -- Pre-computed performance metrics
```

## Key Features

### 1. **Entity-Centric Design**
All data relates back to the master `entities` table:
```sql
-- Get complete entity information
SELECT * FROM get_entity_complete('AAPL');
```

### 2. **Peer Comparison Built-In**
```sql
-- Compare entity to peers
SELECT * FROM compare_to_peers(
    entity_id, 
    'pe_ratio', 
    peer_group_id
);
```

### 3. **Unified Scanner Results**
All scanner types use the same output format:
```sql
-- Query all scanner results
SELECT * FROM scanner_results 
WHERE scan_type IN ('momentum', 'value', 'options_flow')
AND alert_level = 'strong_buy';
```

### 4. **Time-Series Optimized**
Efficient queries for time-based analysis:
```sql
-- Get 30-day price performance
SELECT return_1d, return_5d, return_1m 
FROM daily_analytics 
WHERE entity_id = ? 
ORDER BY analytics_date DESC;
```

### 5. **Options Integration**
Complete options data with entity linkage:
```sql
-- Find unusual options activity
SELECT * FROM options_flow 
WHERE is_unusual = true 
AND entity_id IN (SELECT entity_id FROM peer_group_members WHERE peer_group_id = ?);
```

## Migration Benefits

### Before (Old Schema)
- 15+ disconnected tables
- Duplicate symbol storage
- Inconsistent naming conventions
- No clear relationships
- Mixed temporal data
- Poor query performance

### After (Unified Schema)
- Normalized structure with clear relationships
- Single source of truth for entities
- Consistent naming and data types
- Temporal data properly separated
- Optimized for common query patterns
- Built-in peer comparison
- Unified scanner interface

## Usage Examples

### 1. **Daily Market Analysis**
```sql
-- Top movers with complete context
SELECT 
    e.symbol,
    e.name,
    da.return_1d,
    da.volatility_30d,
    fm.pe_ratio,
    ee.earnings_date,
    sr.alert_message
FROM entities e
JOIN daily_analytics da ON e.id = da.entity_id
JOIN fundamental_metrics fm ON e.id = fm.entity_id
LEFT JOIN earnings_events ee ON e.id = ee.entity_id AND ee.has_reported = false
LEFT JOIN scanner_results sr ON e.id = sr.entity_id AND sr.scan_date = CURRENT_DATE
WHERE da.analytics_date = CURRENT_DATE
ORDER BY ABS(da.return_1d) DESC
LIMIT 50;
```

### 2. **Earnings Analysis**
```sql
-- Upcoming earnings with historical performance
WITH earnings_history AS (
    SELECT 
        entity_id,
        AVG(eps_surprise_percent) as avg_surprise,
        COUNT(*) FILTER (WHERE eps_surprise > 0) as beat_count,
        COUNT(*) as total_reports
    FROM earnings_events
    WHERE has_reported = true
    GROUP BY entity_id
)
SELECT 
    e.symbol,
    ee.earnings_date,
    ee.eps_estimate,
    eh.avg_surprise,
    eh.beat_count::FLOAT / eh.total_reports as beat_rate
FROM earnings_events ee
JOIN entities e ON e.id = ee.entity_id
JOIN earnings_history eh ON eh.entity_id = ee.entity_id
WHERE ee.earnings_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
ORDER BY ee.earnings_date, e.symbol;
```

### 3. **Options Scanner**
```sql
-- High-value options opportunities
SELECT 
    e.symbol,
    oc.contract_type,
    oc.strike,
    oc.expiration,
    oq.implied_volatility,
    oq.volume,
    oq.volume_oi_ratio,
    sr.overall_score
FROM options_chains oc
JOIN entities e ON e.id = oc.entity_id
JOIN options_quotes oq ON oq.option_id = oc.id
JOIN scanner_results sr ON sr.entity_id = e.id 
    AND sr.scan_type = 'options_value'
    AND sr.scan_date = CURRENT_DATE
WHERE oq.quote_timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
AND sr.overall_score > 80
ORDER BY sr.overall_score DESC;
```

### 4. **Sector Analysis**
```sql
-- Sector performance comparison
SELECT 
    s.sector_name,
    COUNT(DISTINCT e.id) as company_count,
    AVG(da.return_1d) as avg_return_1d,
    AVG(da.return_1m) as avg_return_1m,
    AVG(fm.pe_ratio) as avg_pe_ratio,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fm.market_cap) as median_market_cap
FROM sectors s
JOIN industries i ON i.sector_id = s.id
JOIN entity_classifications ec ON ec.industry_id = i.id
JOIN entities e ON e.id = ec.entity_id
JOIN daily_analytics da ON da.entity_id = e.id
JOIN fundamental_metrics fm ON fm.entity_id = e.id
WHERE da.analytics_date = CURRENT_DATE
AND fm.metric_date = CURRENT_DATE
GROUP BY s.sector_name
ORDER BY avg_return_1d DESC;
```

## Performance Considerations

### Indexes
- Primary keys on all tables
- Foreign key indexes for joins
- Composite indexes for common query patterns
- Partial indexes for filtered queries
- GIN indexes for JSONB fields

### Materialized Views
- `mv_top_movers` - Pre-computed top daily movers
- Refresh via `refresh_materialized_views()` function

### Query Optimization Tips
1. Always filter by date first when possible
2. Use `entity_id` instead of joining on symbol
3. Leverage pre-computed `daily_analytics` table
4. Use partial indexes for boolean filters

## Maintenance

### Daily Tasks
```sql
-- Refresh materialized views
SELECT refresh_materialized_views();

-- Update daily analytics
CALL update_daily_analytics();

-- Clean old intraday data
DELETE FROM market_data_intraday 
WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';
```

### Data Quality Checks
```sql
-- Check for missing market data
SELECT e.symbol, MAX(md.market_date) as last_update
FROM entities e
LEFT JOIN market_data_daily md ON e.id = md.entity_id
WHERE e.is_active = true
GROUP BY e.symbol
HAVING MAX(md.market_date) < CURRENT_DATE - 1
OR MAX(md.market_date) IS NULL;
```

## Migration Guide Summary

1. **Create new schema** - Run `020_unified_stock_system.sql`
2. **Migrate data** - Run `021_migrate_to_unified_schema.sql`
3. **Verify migration** - Check quality report
4. **Update application** - Point to new table names
5. **Test thoroughly** - Ensure all queries work
6. **Backup old tables** - Rename with `_backup_` prefix
7. **Drop old tables** - After verification period

## Best Practices

1. **Always use entity_id** for joins, not symbol
2. **Specify data_source** when inserting market data
3. **Use appropriate temporal table** based on data frequency
4. **Leverage peer groups** for relative analysis
5. **Pre-compute expensive metrics** in daily_analytics
6. **Use scanner_results** for all screening output
7. **Maintain referential integrity** with proper constraints

This unified design provides a solid foundation for comprehensive stock market analysis while maintaining performance and data integrity.