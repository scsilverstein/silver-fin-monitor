const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'YOUR_API_KEY';
const POLYGON_BASE_URL = 'https://api.polygon.io';
const PORT = 9999;

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 12000; // 12 seconds between requests (5 per minute)

// Cache
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

// In-memory favorites
const favorites = new Set();

// Sample stock symbols to track
const STOCK_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 
  'TSLA', 'NVDA', 'JPM', 'JNJ', 'V',
  'WMT', 'PG', 'MA', 'UNH', 'HD',
  'DIS', 'BAC', 'ADBE', 'NFLX', 'CRM'
];

// Helper function to enforce rate limiting
async function rateLimitedRequest() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

// Get cached data or fetch new
function getCachedOrFetch(key, fetchFn) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache hit for ${key}`);
    return Promise.resolve(cached.data);
  }
  
  return fetchFn().then(data => {
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}

// Fetch stock details from Polygon
async function fetchStockDetails(symbol) {
  try {
    await rateLimitedRequest();
    
    // Get ticker details
    const detailsUrl = `${POLYGON_BASE_URL}/v3/reference/tickers/${symbol}?apiKey=${POLYGON_API_KEY}`;
    const detailsResponse = await axios.get(detailsUrl);
    const details = detailsResponse.data.results;
    
    return details;
  } catch (error) {
    console.error(`Error fetching details for ${symbol}:`, error.message);
    throw error;
  }
}

// Fetch stock quote from Polygon
async function fetchStockQuote(symbol) {
  try {
    await rateLimitedRequest();
    
    // Get previous day's data (most recent for free tier)
    const quoteUrl = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    const quoteResponse = await axios.get(quoteUrl);
    const quote = quoteResponse.data.results?.[0];
    
    if (!quote) {
      throw new Error('No quote data available');
    }
    
    return quote;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error.message);
    throw error;
  }
}

// Fetch financials including revenue
async function fetchFinancials(symbol) {
  try {
    await rateLimitedRequest();
    
    // Get financials data
    const financialsUrl = `${POLYGON_BASE_URL}/vX/reference/financials?ticker=${symbol}&limit=4&apiKey=${POLYGON_API_KEY}`;
    const financialsResponse = await axios.get(financialsUrl);
    const financials = financialsResponse.data.results;
    
    return financials;
  } catch (error) {
    console.error(`Error fetching financials for ${symbol}:`, error.message);
    return [];
  }
}

// Process stock data
async function processStock(symbol) {
  try {
    const cacheKey = `stock_${symbol}`;
    
    return await getCachedOrFetch(cacheKey, async () => {
      const [details, quote, financials] = await Promise.all([
        fetchStockDetails(symbol),
        fetchStockQuote(symbol),
        fetchFinancials(symbol)
      ]);
      
      // Extract latest financials
      const latestFinancial = financials?.[0];
      const previousFinancial = financials?.[1];
      
      // Calculate revenue growth
      let revenueGrowth = null;
      let latestRevenue = null;
      let guidanceRevenue = null;
      
      if (latestFinancial?.financials?.income_statement?.revenues) {
        latestRevenue = latestFinancial.financials.income_statement.revenues.value;
        
        if (previousFinancial?.financials?.income_statement?.revenues) {
          const previousRevenue = previousFinancial.financials.income_statement.revenues.value;
          revenueGrowth = ((latestRevenue - previousRevenue) / previousRevenue) * 100;
        }
      }
      
      // Extract comprehensive income statement data
      const incomeStatement = latestFinancial?.financials?.income_statement || {};
      
      // Map sector properly
      const sectorMap = {
        'Technology': 'Technology',
        'Healthcare': 'Healthcare',
        'Financials': 'Financial Services',
        'Finance': 'Financial Services',
        'Consumer Discretionary': 'Consumer Cyclical',
        'Consumer Staples': 'Consumer Defensive',
        'Industrials': 'Industrials',
        'Energy': 'Energy',
        'Materials': 'Basic Materials',
        'Real Estate': 'Real Estate',
        'Utilities': 'Utilities',
        'Communication Services': 'Communication Services'
      };
      
      const sector = sectorMap[details.sic_description] || 'Other';
      
      // Calculate value score
      const currentPrice = quote.c;
      const eps = incomeStatement.basic_earnings_per_share?.value || 0;
      const pe = eps > 0 ? currentPrice / eps : null;
      
      let valueScore = 50;
      if (pe && pe > 0) {
        if (pe < 15) valueScore = 80;
        else if (pe < 20) valueScore = 70;
        else if (pe < 25) valueScore = 60;
        else if (pe < 30) valueScore = 50;
        else if (pe < 40) valueScore = 40;
        else valueScore = 30;
      }
      
      // Calculate expected growth based on revenue trend
      const expectedGrowth = revenueGrowth || 0;
      
      return {
        symbol: symbol,
        name: details.name,
        sector: sector,
        industry: details.sic_description,
        price: currentPrice,
        previousClose: quote.c,
        change: quote.c - quote.o,
        changePercent: ((quote.c - quote.o) / quote.o) * 100,
        volume: quote.v,
        marketCap: details.market_cap || (quote.c * details.share_class_shares_outstanding),
        pe: pe,
        forwardPE: pe, // Polygon doesn't provide forward PE on free tier
        dividendYield: null,
        week52High: null,
        week52Low: null,
        valueScore: valueScore,
        expectedGrowth: expectedGrowth,
        isFavorite: favorites.has(symbol),
        // Financial data
        revenue: latestRevenue,
        revenueGrowth: revenueGrowth,
        revenueQuarter: latestFinancial?.fiscal_period,
        revenueYear: latestFinancial?.fiscal_year,
        // Additional income statement items
        grossProfit: incomeStatement.gross_profit?.value,
        operatingIncome: incomeStatement.operating_income_loss?.value,
        netIncome: incomeStatement.net_income_loss?.value,
        eps: eps,
        // Guidance placeholder (would need to parse from news/filings)
        guidanceRevenue: guidanceRevenue,
        guidanceEPS: null
      };
    });
  } catch (error) {
    console.error(`Error processing ${symbol}:`, error.message);
    return null;
  }
}

// Routes
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      service: 'Polygon Stock Data Service',
      status: 'healthy',
      apiKey: POLYGON_API_KEY ? 'configured' : 'missing',
      provider: 'Polygon.io'
    }
  });
});

app.get('/api/v1/stocks/screener', async (req, res) => {
  try {
    console.log('Fetching stock data from Polygon...');
    
    const results = [];
    const errors = [];
    
    // Process stocks one by one due to rate limiting
    for (const symbol of STOCK_SYMBOLS) {
      try {
        console.log(`Processing ${symbol}...`);
        const stockData = await processStock(symbol);
        if (stockData) {
          results.push(stockData);
        }
      } catch (error) {
        errors.push({ symbol, error: error.message });
      }
    }
    
    // Sort by market cap
    results.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    
    res.json({
      success: true,
      data: results,
      meta: {
        total: results.length,
        errors: errors.length,
        provider: 'Polygon.io',
        rateLimit: '5 calls/minute, unlimited daily'
      }
    });
  } catch (error) {
    console.error('Screener error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/v1/stocks/quote/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    console.log(`Fetching individual quote for ${symbol}...`);
    
    const stockData = await processStock(symbol);
    
    if (!stockData) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found'
      });
    }
    
    res.json({
      success: true,
      data: stockData
    });
  } catch (error) {
    console.error('Quote error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/v1/stocks/financials/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const cacheKey = `financials_${symbol}`;
    
    const financials = await getCachedOrFetch(cacheKey, async () => {
      return await fetchFinancials(symbol);
    });
    
    res.json({
      success: true,
      data: {
        symbol,
        financials,
        quarterlyRevenue: financials.map(f => ({
          period: `${f.fiscal_year} ${f.fiscal_period}`,
          revenue: f.financials?.income_statement?.revenues?.value,
          netIncome: f.financials?.income_statement?.net_income_loss?.value,
          eps: f.financials?.income_statement?.basic_earnings_per_share?.value
        }))
      }
    });
  } catch (error) {
    console.error('Financials error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Favorites management
app.post('/api/v1/stocks/favorites/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  favorites.add(symbol);
  res.json({ success: true, message: `${symbol} added to favorites` });
});

app.delete('/api/v1/stocks/favorites/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  favorites.delete(symbol);
  res.json({ success: true, message: `${symbol} removed from favorites` });
});

app.get('/api/v1/stocks/favorites', (req, res) => {
  res.json({ 
    success: true, 
    data: Array.from(favorites) 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Polygon Stock Server running on port ${PORT}`);
  console.log(`API Key: ${POLYGON_API_KEY ? 'Configured' : 'Missing - set POLYGON_API_KEY'}`);
  console.log('Rate limit: 5 requests per minute, unlimited daily');
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/v1/health`);
  console.log(`  GET  http://localhost:${PORT}/api/v1/stocks/screener`);
  console.log(`  GET  http://localhost:${PORT}/api/v1/stocks/quote/:symbol`);
  console.log(`  GET  http://localhost:${PORT}/api/v1/stocks/financials/:symbol`);
  console.log('');
  
  if (!POLYGON_API_KEY || POLYGON_API_KEY === 'YOUR_API_KEY') {
    console.log('⚠️  WARNING: No API key configured!');
    console.log('Get your free API key at: https://polygon.io/');
    console.log('Then set: export POLYGON_API_KEY=your_key_here');
  }
});