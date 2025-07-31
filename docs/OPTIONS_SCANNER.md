# Options Scanner Feature

## Overview

The Options Scanner is a comprehensive tech stock options analysis system that identifies high-value opportunities in the options market. It focuses on technology sector stocks and provides advanced analysis including value scoring, unusual activity detection, and strategy recommendations.

## Key Features

### 1. Tech Stock Universe
- **40+ Major Tech Stocks**: Covers mega-cap to growth stocks
- **Categories**: Software, Hardware, Semiconductors, Cloud, AI, EV Tech, Fintech, etc.
- **Priority-Based Scanning**: Higher liquidity stocks scanned more frequently

### 2. Options Data Analysis
- **Real-time Market Data**: Via Polygon.io API
- **Greeks Calculation**: Delta, Gamma, Theta, Vega, Rho
- **IV Analysis**: Rank and percentile calculations
- **Value Scoring**: Proprietary algorithm for opportunity identification

### 3. Scoring System
- **Value Score (0-100)**: Pricing efficiency based on IV, spread, liquidity
- **Opportunity Score (0-100)**: Profit potential considering probability and time
- **Risk-Adjusted Score (0-100)**: Balanced risk/reward assessment

### 4. Strategy Recommendations
- **Market Condition Based**: Adapts to high/low IV environments
- **Multiple Strategies**: Covered calls, cash-secured puts, spreads, etc.
- **Rationale Provided**: Clear explanation for each recommendation

## API Endpoints

### Initialize Tech Universe
```bash
POST /api/v1/options/tech-universe/initialize
```
Sets up the initial list of tech stocks to monitor.

### Get Latest Scan Results
```bash
GET /api/v1/options/scan/latest
```
Returns the most recent comprehensive scan results.

### Run Tech Options Scan
```bash
POST /api/v1/options/scan/run
```
Triggers a new scan (queued for background processing).

### Get Options Chain
```bash
GET /api/v1/options/chain/{symbol}
```
Retrieves options chain for a specific tech stock.

### Analyze Specific Option
```bash
GET /api/v1/options/analyze/{contractId}
```
Detailed analysis of a single option contract.

### Search Options
```bash
GET /api/v1/options/search?minVolume=100&minValueScore=70
```
Search options by various criteria.

### Get Unusual Activity
```bash
GET /api/v1/options/unusual-activity
```
Returns options with unusual trading patterns.

### Get Value Opportunities
```bash
GET /api/v1/options/value-opportunities?minScore=80
```
High-scoring value opportunities in tech options.

### Tech Categories Overview
```bash
GET /api/v1/options/tech-categories
```
Summary of all tech categories and their stocks.

## Database Schema

### Core Tables
- `options_contracts`: Master list of all option contracts
- `options_market_data`: Real-time pricing and Greeks
- `options_value_analysis`: Calculated scores and recommendations
- `options_scanner_results`: Daily scan results
- `tech_stock_universe`: Curated tech stocks list

## Usage Examples

### 1. Initialize and Run First Scan
```javascript
// Initialize tech stocks
const initResponse = await fetch('/api/v1/options/tech-universe/initialize', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Trigger scan
const scanResponse = await fetch('/api/v1/options/scan/run', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### 2. Get High-Value Opportunities
```javascript
const opportunities = await fetch('/api/v1/options/value-opportunities?minScore=75', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await opportunities.json();
// Returns top opportunities with scores, recommendations, and rationale
```

### 3. Monitor Specific Stock Options
```javascript
const nvdaOptions = await fetch('/api/v1/options/chain/NVDA', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const chain = await nvdaOptions.json();
// Returns full options chain grouped by expiration
```

## Scoring Algorithm Details

### Value Score Components
1. **IV Rank (25%)**: Lower rank = better value
2. **Spread Quality (25%)**: Tighter bid-ask = higher score
3. **Liquidity (25%)**: Volume and open interest
4. **Underpricing (25%)**: Theoretical vs market price

### Opportunity Score Components
1. **Probability of Profit (30%)**: Statistical calculation
2. **Liquidity Activity (20%)**: Volume/OI ratio
3. **Time Frame (20%)**: Optimal 30-60 DTE preferred
4. **IV Position (15%)**: Current vs historical
5. **Value Discrepancy (15%)**: Significant underpricing

## Configuration

### Environment Variables
```env
POLYGON_API_KEY=your_polygon_api_key
```

### Scan Parameters
- Default scan window: 7-90 days to expiration
- Minimum volume: 50 contracts
- Minimum open interest: 100 contracts
- Maximum spread ratio: 20%

## Background Jobs

### Daily Tech Options Scan
- Runs at 9:30 AM EST (market open)
- Analyzes all active tech stocks
- Generates alerts for high-value opportunities

### Unusual Activity Detection
- Runs every 30 minutes during market hours
- Identifies volume spikes and IV changes
- Triggers detailed analysis for anomalies

## Performance Considerations

### Caching Strategy
- Options chains: 15 minutes
- Analysis results: 15 minutes
- Scanner results: 1 hour

### Rate Limiting
- Polygon API: 5 requests/second (basic tier)
- Batch processing for efficiency
- Circuit breaker pattern for resilience

## Future Enhancements

1. **Multi-Leg Strategies**: Spreads, straddles, iron condors
2. **Earnings Play Detection**: Pre-earnings opportunity identification
3. **Historical Backtesting**: Strategy performance validation
4. **Real-time Alerts**: WebSocket-based notifications
5. **Portfolio Integration**: Track and analyze positions

## Troubleshooting

### Common Issues

1. **No Data Returned**
   - Verify Polygon API key is valid
   - Check if markets are open
   - Ensure tech universe is initialized

2. **Slow Performance**
   - Monitor cache hit rates
   - Check database query performance
   - Verify API rate limits

3. **Missing Greeks**
   - Some contracts may not have Greeks data
   - Fallback calculations implemented
   - Check data provider status

## Support

For issues or questions, please check:
- API logs for detailed error messages
- Database migration status
- Queue worker health
- Polygon API status page