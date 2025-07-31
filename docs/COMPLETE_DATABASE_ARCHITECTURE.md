# Complete Silver Fin Monitor Database Architecture

## Overview

The Silver Fin Monitor database is a comprehensive financial intelligence system that integrates market data, AI analysis, and predictive modeling into a unified, performant architecture.

## Database Schema Layers

### 1. **Core Business Entities**
```
entities (master records)
├── sectors
├── industries  
├── entity_classifications
└── peer_groups / peer_group_members
```

### 2. **Market Data Layer**
```
market_data_daily (OHLCV)
market_data_intraday (tick data)
technical_analysis (indicators)
daily_analytics (pre-computed metrics)
```

### 3. **Fundamental Data Layer**
```
fundamentals (quarterly/annual statements)
fundamental_metrics (daily snapshots)
earnings_events (calendar & results)
earnings_estimates_history
```

### 4. **Options Data Layer**
```
options_chains (contract definitions)
options_quotes (pricing & Greeks)
options_flow (unusual activity)
```

### 5. **AI & Content Layer**
```
feed_sources (data sources)
raw_feeds (original content)
processed_content (NLP results)
daily_analysis (AI synthesis)
predictions (forward-looking)
prediction_comparisons (accuracy tracking)
```

### 6. **Integration Layer**
```
entity_content_mapping (entity ↔ content links)
entity_predictions (entity ↔ predictions)
unified_analytics (cross-source insights)
scanner_results (all scanner outputs)
```

### 7. **Infrastructure Layer**
```
job_queue (async processing)
cache_store (performance cache)
system_health_metrics (monitoring)
```

## Key Design Patterns

### 1. **Entity-Centric Architecture**
All financial data revolves around the `entities` table:
- Single source of truth for symbols
- Foreign key relationships maintain integrity
- Supports stocks, ETFs, mutual funds, REITs

### 2. **Temporal Data Separation**
Different tables for different time granularities:
- **Point-in-time**: Daily prices, metrics
- **Period-based**: Quarterly earnings, fundamentals
- **Event-driven**: Trades, news, predictions
- **Real-time**: Intraday quotes, options flow

### 3. **Flexible Classification System**
- Hierarchical sectors → industries
- Time-based classification changes
- Multiple classification types (primary/secondary)
- Dynamic peer groups

### 4. **Unified Analytics Interface**
All scanners output to `scanner_results`:
- Consistent scoring (0-100)
- Flexible metrics storage (JSONB)
- Unified alerting system
- Cross-scanner queries

## Integration Points

### 1. **Entity ↔ Content Mapping**
```sql
entities ←→ entity_content_mapping ←→ processed_content
```
- Relevance scoring
- Sentiment impact
- Mention context
- Extracted metrics

### 2. **Entity ↔ Predictions**
```sql
entities ←→ entity_predictions ←→ predictions
```
- Entity-specific impacts
- Price targets
- Confidence levels
- Time horizons

### 3. **Cross-Source Analytics**
```sql
market_data + fundamentals + options + sentiment → unified_analytics
```
- Composite scoring
- Multi-factor signals
- Source weighting
- Confidence levels

## Performance Optimizations

### 1. **Strategic Indexes**
- Primary/foreign keys
- Composite indexes for joins
- Partial indexes for filters
- Text search indexes (GIN)
- Trigram indexes for fuzzy search

### 2. **Materialized Views**
- `mv_market_overview`: Dashboard data
- `mv_entity_insights`: Complete entity view
- `mv_top_movers`: Daily movers
- Concurrent refresh support

### 3. **Pre-computed Analytics**
- `daily_analytics`: Performance metrics
- `technical_analysis`: Indicators
- `unified_analytics`: Composite scores
- Reduces real-time calculation load

### 4. **Data Partitioning** (Ready)
- Time-based partitioning for:
  - `market_data_daily` (by year)
  - `options_quotes` (by month)
  - `processed_content` (by quarter)

### 5. **Smart Caching**
- Database-level cache (`cache_store`)
- TTL-based expiration
- Tag-based invalidation
- Automatic cleanup

## Data Quality & Integrity

### 1. **Constraints**
- Foreign key relationships
- Check constraints (price > 0)
- Unique constraints (no duplicates)
- NOT NULL on critical fields

### 2. **Data Validation**
- Price relationship checks
- Date range validations
- Percentage bounds (0-100)
- Enum validations

### 3. **Audit Trail**
- Created/updated timestamps
- Data source tracking
- User/system attribution
- Historical snapshots

## Monitoring & Maintenance

### 1. **Health Metrics**
```sql
system_health_metrics
- Database size
- Query performance  
- Queue depth
- Failed jobs
- Data freshness
```

### 2. **Automated Maintenance**
- Materialized view refresh (4 hours)
- Old data cleanup (daily)
- Statistics update (daily)
- Health metrics capture (daily)

### 3. **Data Retention**
- Intraday: 30 days
- Daily: Indefinite
- Scanner results: 90 days
- Job queue: 7 days
- Options quotes: 180 days

## Query Patterns

### 1. **Entity Overview**
```sql
SELECT * FROM get_entity_complete('AAPL');
-- Returns entity + classification + quotes + fundamentals + earnings + technical
```

### 2. **Market Context**
```sql
SELECT * FROM get_entity_market_context('AAPL');
-- Returns performance vs peers + news + options flow + signals
```

### 3. **Peer Comparison**
```sql
SELECT * FROM compare_to_peers(entity_id, 'pe_ratio', peer_group_id);
-- Returns percentile ranking within peer group
```

### 4. **Correlation Analysis**
```sql
SELECT * FROM calculate_correlation_matrix(
    ARRAY['entity_id_1', 'entity_id_2', 'entity_id_3'],
    30 -- lookback days
);
```

### 5. **Unified Search**
```sql
-- Find all mentions of an entity across all content
SELECT 
    pc.created_at,
    pc.summary,
    ecm.sentiment_impact,
    fs.name as source
FROM entity_content_mapping ecm
JOIN processed_content pc ON ecm.content_id = pc.id
JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
JOIN feed_sources fs ON rf.source_id = fs.id
WHERE ecm.entity_id = ?
ORDER BY pc.created_at DESC;
```

## Best Practices

### 1. **Always Use Entity IDs**
```sql
-- Good: Use entity_id
JOIN market_data_daily md ON md.entity_id = e.id

-- Bad: Join on symbol
JOIN market_data_daily md ON md.symbol = e.symbol
```

### 2. **Leverage Pre-computed Data**
```sql
-- Good: Use daily_analytics
SELECT return_1d, return_1m FROM daily_analytics

-- Bad: Calculate on the fly
SELECT (close - LAG(close)) / LAG(close) as return_1d
```

### 3. **Filter Early**
```sql
-- Good: Filter in WHERE clause
WHERE market_date >= CURRENT_DATE - 30
AND entity_id IN (SELECT entity_id FROM ...)

-- Bad: Filter after join
JOIN ... 
HAVING market_date >= CURRENT_DATE - 30
```

### 4. **Use Appropriate Indexes**
```sql
-- Partial index usage
WHERE is_active = true  -- Uses idx_entities_active_liquid

-- Text search
WHERE to_tsvector('english', content) @@ to_tsquery('earnings')
```

### 5. **Batch Operations**
```sql
-- Good: Single insert with multiple rows
INSERT INTO table VALUES (1), (2), (3);

-- Bad: Multiple individual inserts
INSERT INTO table VALUES (1);
INSERT INTO table VALUES (2);
```

## Migration Path

### Phase 1: Foundation (Complete)
✅ Unified stock schema (020)
✅ Migration scripts (021)
✅ Integration layer (025)

### Phase 2: Optimization
- Drop legacy tables
- Add partitioning
- Enable compression
- Tune indexes

### Phase 3: Advanced Features
- Real-time streaming
- GraphQL API layer
- Time-series extensions
- ML model integration

## Security Considerations

### 1. **Row Level Security**
- Enabled on sensitive tables
- Policy-based access control
- User-specific data isolation

### 2. **Data Encryption**
- At-rest encryption (Supabase)
- TLS for connections
- Sensitive data masking

### 3. **Access Control**
- Role-based permissions
- API key management
- Audit logging

## Scalability

### Current Capacity
- Entities: 10,000+
- Daily updates: 1M+ rows
- Options chains: 100K+ contracts
- Content items: 10K+ per day

### Growth Path
1. **Vertical Scaling**: Increase compute/memory
2. **Read Replicas**: Distribute read load
3. **Partitioning**: Time-based data sharding
4. **Microservices**: Separate concerns
5. **Data Lake**: Historical data archive

## Conclusion

This architecture provides:
- **Unified Data Model**: Single source of truth
- **High Performance**: Optimized for daily analysis
- **Flexibility**: Extensible for new data types
- **Reliability**: Data integrity and quality
- **Scalability**: Growth-ready design

The system seamlessly integrates market data, fundamentals, options, and AI insights into a cohesive platform for comprehensive financial intelligence.