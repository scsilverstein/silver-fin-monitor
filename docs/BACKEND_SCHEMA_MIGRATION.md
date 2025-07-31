# Backend Schema Migration Guide

## Overview

This guide details the changes required in the backend layer to support the new unified database schema.

## Table Mapping Reference

| Old Table | New Table(s) | Notes |
|-----------|-------------|-------|
| `stock_symbols` | `entities` | Master records for all securities |
| `stock_fundamentals` | `fundamental_metrics` + `fundamentals` | Split into daily metrics and period data |
| `stock_scanner_results` | `scanner_results` | Unified scanner with scan_type field |
| `stock_watchlist` | Use `peer_groups` with type='watchlist' | Or create custom watchlist table |
| `stock_peer_groups` | `peer_groups` + `peer_group_members` | Normalized structure |
| `earnings_calendar` | `earnings_events` | Enhanced with estimate history |
| `options_contracts` | `options_chains` | Renamed and enhanced |
| `options_market_data` | `options_quotes` | Better naming |

## Field Mapping Reference

| Old Field | New Field | Table | Notes |
|-----------|-----------|-------|-------|
| `symbol_id` | `entity_id` | All tables | Consistent naming |
| `data_date` | `metric_date` | `fundamental_metrics` | Daily metrics |
| `data_date` | `market_date` | `market_data_daily` | Market data |
| `earnings_per_share` | `eps_diluted` | `fundamentals` | Quarterly/annual |
| `forward_earnings_per_share` | Calculated from `earnings_events` | - | Derived field |
| `pe_ratio` | `pe_ratio` | `fundamental_metrics` | Moved table |
| `price` | `close_price` | `market_data_daily` | Separate table |

## Required Backend Changes

### 1. Update Database Queries

#### Example: Stock Controller

**OLD:**
```typescript
// src/controllers/stock.controller.ts
const getStockSymbols = async (req: Request, res: Response) => {
  const query = `
    SELECT * FROM stock_symbols 
    WHERE is_active = true 
    ORDER BY symbol
  `;
  const result = await db.query(query);
  res.json(result);
};
```

**NEW:**
```typescript
// src/controllers/stock.controller.ts
const getStockSymbols = async (req: Request, res: Response) => {
  const query = `
    SELECT 
      e.*,
      s.sector_name,
      i.industry_name
    FROM entities e
    LEFT JOIN entity_classifications ec ON e.id = ec.entity_id 
      AND ec.classification_type = 'primary'
    LEFT JOIN industries i ON ec.industry_id = i.id
    LEFT JOIN sectors s ON i.sector_id = s.id
    WHERE e.is_active = true 
    ORDER BY e.symbol
  `;
  const result = await db.query(query);
  res.json(result);
};
```

#### Example: Get Stock Fundamentals

**OLD:**
```typescript
const getStockFundamentals = async (symbolId: string) => {
  const query = `
    SELECT * FROM stock_fundamentals
    WHERE symbol_id = $1
    ORDER BY data_date DESC
    LIMIT 1
  `;
  return await db.query(query, [symbolId]);
};
```

**NEW:**
```typescript
const getStockFundamentals = async (entityId: string) => {
  // Get daily metrics
  const metricsQuery = `
    SELECT * FROM fundamental_metrics
    WHERE entity_id = $1
    ORDER BY metric_date DESC
    LIMIT 1
  `;
  const metrics = await db.query(metricsQuery, [entityId]);

  // Get latest quarterly fundamentals
  const fundamentalsQuery = `
    SELECT * FROM fundamentals
    WHERE entity_id = $1
    AND period_type = 'quarterly'
    ORDER BY period_end_date DESC
    LIMIT 1
  `;
  const fundamentals = await db.query(fundamentalsQuery, [entityId]);

  // Get latest market data
  const marketQuery = `
    SELECT * FROM market_data_daily
    WHERE entity_id = $1
    ORDER BY market_date DESC
    LIMIT 1
  `;
  const marketData = await db.query(marketQuery, [entityId]);

  // Combine results
  return {
    metrics: metrics[0],
    fundamentals: fundamentals[0],
    marketData: marketData[0]
  };
};
```

### 2. Update Service Layer

#### Stock Data Fetcher Service

**OLD:**
```typescript
// src/services/stock/stock-data-fetcher.ts
async fetchAndStoreFundamentals(symbol: string) {
  const data = await this.fetchFromAPI(symbol);
  
  await db.query(`
    INSERT INTO stock_fundamentals (
      symbol_id, data_date, earnings_per_share, 
      pe_ratio, price, volume
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [symbolId, date, data.eps, data.pe, data.price, data.volume]);
}
```

**NEW:**
```typescript
// src/services/stock/stock-data-fetcher.ts
async fetchAndStoreFundamentals(symbol: string) {
  const data = await this.fetchFromAPI(symbol);
  const entity = await this.getEntityBySymbol(symbol);
  
  // Store daily metrics
  await db.query(`
    INSERT INTO fundamental_metrics (
      entity_id, metric_date, pe_ratio, forward_pe_ratio,
      market_cap, beta, data_source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (entity_id, metric_date, data_source) 
    DO UPDATE SET
      pe_ratio = EXCLUDED.pe_ratio,
      forward_pe_ratio = EXCLUDED.forward_pe_ratio,
      market_cap = EXCLUDED.market_cap,
      beta = EXCLUDED.beta
  `, [entity.id, new Date(), data.pe, data.forwardPE, 
      data.marketCap, data.beta, 'yahoo']);

  // Store market data
  await db.query(`
    INSERT INTO market_data_daily (
      entity_id, market_date, open_price, high_price,
      low_price, close_price, volume, data_source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (entity_id, market_date, data_source) 
    DO UPDATE SET
      close_price = EXCLUDED.close_price,
      volume = EXCLUDED.volume
  `, [entity.id, new Date(), data.open, data.high, 
      data.low, data.close, data.volume, 'yahoo']);
}
```

### 3. Update API Response DTOs

#### Stock Response DTO

**OLD:**
```typescript
interface StockResponse {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  fundamentals: {
    earnings_per_share: number;
    pe_ratio: number;
    price: number;
  };
}
```

**NEW:**
```typescript
interface StockResponse {
  id: string;
  symbol: string;
  name: string;
  primary_exchange: string;
  classification: {
    sector_name: string;
    industry_name: string;
  };
  metrics: {
    pe_ratio: number;
    forward_pe_ratio: number;
    market_cap: number;
    beta: number;
  };
  fundamentals: {
    eps_diluted: number;
    revenue: number;
    net_margin: number;
  };
  market_data: {
    close_price: number;
    volume: number;
    return_1d: number;
  };
}
```

### 4. Update Scanner Implementation

**OLD:**
```typescript
// Scanner results storage
await db.query(`
  INSERT INTO stock_scanner_results (
    symbol_id, scan_date, scan_type, 
    momentum_score, value_score, composite_score
  ) VALUES ($1, $2, $3, $4, $5, $6)
`, [...values]);
```

**NEW:**
```typescript
// Unified scanner results
await db.query(`
  INSERT INTO scanner_results (
    entity_id, scan_date, scan_type,
    overall_score, momentum_score, value_score,
    metrics_snapshot, alert_level, alert_message
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`, [
  entityId, 
  new Date(), 
  'technical_momentum',
  overallScore, 
  momentumScore, 
  valueScore,
  JSON.stringify(metricsSnapshot),
  alertLevel,
  alertMessage
]);
```

### 5. Update Query Joins

**OLD:**
```typescript
const getStockWithFundamentals = `
  SELECT 
    s.*,
    sf.earnings_per_share,
    sf.pe_ratio,
    sf.price
  FROM stock_symbols s
  LEFT JOIN stock_fundamentals sf ON s.id = sf.symbol_id
  WHERE s.symbol = $1
`;
```

**NEW:**
```typescript
const getEntityWithFullData = `
  SELECT 
    e.*,
    i.industry_name,
    s.sector_name,
    fm.pe_ratio,
    fm.market_cap,
    md.close_price,
    md.volume,
    da.return_1d,
    da.volatility_30d,
    f.eps_diluted,
    f.revenue
  FROM entities e
  LEFT JOIN entity_classifications ec ON e.id = ec.entity_id 
    AND ec.classification_type = 'primary'
  LEFT JOIN industries i ON ec.industry_id = i.id
  LEFT JOIN sectors s ON i.sector_id = s.id
  LEFT JOIN fundamental_metrics fm ON e.id = fm.entity_id
    AND fm.metric_date = (
      SELECT MAX(metric_date) 
      FROM fundamental_metrics 
      WHERE entity_id = e.id
    )
  LEFT JOIN market_data_daily md ON e.id = md.entity_id
    AND md.market_date = (
      SELECT MAX(market_date) 
      FROM market_data_daily 
      WHERE entity_id = e.id
    )
  LEFT JOIN daily_analytics da ON e.id = da.entity_id
    AND da.analytics_date = CURRENT_DATE
  LEFT JOIN fundamentals f ON e.id = f.entity_id
    AND f.period_end_date = (
      SELECT MAX(period_end_date) 
      FROM fundamentals 
      WHERE entity_id = e.id 
      AND period_type = 'quarterly'
    )
  WHERE e.symbol = $1
`;
```

## Migration Strategy

### Phase 1: Parallel Implementation (Recommended)
1. Create new endpoints with `/v2/` prefix
2. Implement new schema queries alongside old ones
3. Test thoroughly with both schemas
4. Gradually migrate frontend to v2 endpoints

### Phase 2: Data Migration
1. Run migration script (021_migrate_to_unified_schema.sql)
2. Verify data integrity
3. Update cron jobs and background workers

### Phase 3: Cutover
1. Switch all endpoints to new schema
2. Update API documentation
3. Remove old schema code
4. Drop old tables (after backup period)

## Example Endpoint Updates

### Get Stock Details Endpoint

**OLD:** `/api/stocks/:symbol`
```typescript
router.get('/stocks/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const stock = await getStockBySymbol(symbol);
  const fundamentals = await getLatestFundamentals(stock.id);
  res.json({ ...stock, fundamentals });
});
```

**NEW:** `/api/v2/entities/:symbol`
```typescript
router.get('/v2/entities/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const result = await getEntityComplete(symbol);
  
  // Transform to match expected API format
  const response = {
    id: result.entity.id,
    symbol: result.entity.symbol,
    name: result.entity.name,
    exchange: result.entity.primary_exchange,
    classification: {
      sector: result.classification.sector_name,
      industry: result.classification.industry_name
    },
    quote: {
      price: result.market_data.close_price,
      volume: result.market_data.volume,
      change_1d: result.analytics.return_1d
    },
    fundamentals: {
      pe_ratio: result.metrics.pe_ratio,
      market_cap: result.metrics.market_cap,
      eps: result.fundamentals.eps_diluted,
      revenue: result.fundamentals.revenue
    },
    next_earnings: result.next_earnings
  };
  
  res.json(response);
});
```

## Testing Checklist

- [ ] All stock listing endpoints return data
- [ ] Individual stock details include all fields
- [ ] Scanner results properly stored and retrieved
- [ ] Earnings calendar data accessible
- [ ] Options data queries work
- [ ] Peer comparisons function correctly
- [ ] Historical data queries perform well
- [ ] API response times acceptable
- [ ] Error handling for missing data
- [ ] Backward compatibility maintained

## Common Pitfalls

1. **Foreign Key Mismatches**: Ensure all `symbol_id` references are updated to `entity_id`
2. **Missing Joins**: New schema requires more complex joins for complete data
3. **Performance**: Some queries may need optimization with the normalized structure
4. **Data Types**: Some fields changed types (e.g., market cap now DECIMAL instead of BIGINT)
5. **Null Handling**: More nullable fields in normalized structure

## Performance Optimization

1. **Use Materialized Views**:
```typescript
// Instead of complex joins, use pre-computed views
const query = `SELECT * FROM mv_entity_insights WHERE symbol = $1`;
```

2. **Batch Queries**:
```typescript
// Fetch multiple related records in one query
const entities = await db.query(`
  SELECT * FROM entities WHERE symbol = ANY($1::text[])
`, [symbols]);
```

3. **Connection Pooling**:
```typescript
// Ensure proper connection pool configuration
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

This migration will ensure the backend properly handles the new normalized schema while maintaining API compatibility and improving data consistency.