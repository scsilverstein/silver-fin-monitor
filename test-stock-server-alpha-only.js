const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Alpha Vantage API configuration
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

// In-memory favorites storage
let userFavorites = [];

// Cache for stock data
const stockCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache to minimize API calls

// Popular stocks to fetch
const STOCK_SYMBOLS = [
  // Tech giants
  'IBM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  // More tech
  'ADBE', 'CRM', 'AMD', 'INTC', 'CSCO', 'ORCL',
  // Consumer
  'WMT', 'HD', 'MCD', 'NKE', 'SBUX', 'COST', 'PEP', 'KO',
  // Healthcare
  'UNH', 'JNJ', 'PFE', 'ABBV', 'CVS', 'LLY',
  // Financial
  'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS',
  // Industrial
  'BA', 'CAT', 'HON', 'UPS', 'MMM',
  // Energy
  'XOM', 'CVX',
  // Entertainment
  'DIS', 'NFLX'
];

// Rate limiting tracking
let apiCallCount = 0;
let lastResetTime = Date.now();

function checkRateLimit() {
  const now = Date.now();
  
  // Reset counter every minute
  if (now - lastResetTime > 60000) {
    apiCallCount = 0;
    lastResetTime = now;
  }
  
  // Free tier: 5 calls per minute
  if (apiCallCount >= 5) {
    console.log('Rate limit reached, waiting for reset...');
    return false;
  }
  
  apiCallCount++;
  return true;
}

// Helper function to fetch company overview from Alpha Vantage
async function fetchCompanyOverview(symbol) {
  try {
    // Check cache first
    const cacheKey = `overview_${symbol}`;
    const cached = stockCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`Returning cached overview for ${symbol}`);
      return cached.data;
    }

    if (!checkRateLimit()) {
      return null;
    }

    console.log(`Fetching overview for ${symbol} from Alpha Vantage...`);

    const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
      params: {
        function: 'OVERVIEW',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY
      }
    });

    // Check for API key issues
    if (response.data['Information']) {
      console.error('Alpha Vantage API issue:', response.data['Information']);
      return null;
    }

    const data = response.data;
    
    // Check if we got valid data
    if (!data.Symbol) {
      console.log(`No overview data available for ${symbol}`);
      return null;
    }

    // Cache the result
    stockCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });

    return data;

  } catch (error) {
    console.error(`Error fetching overview for ${symbol}:`, error.message);
    return null;
  }
}

// Helper function to fetch quote from Alpha Vantage
async function fetchStockQuote(symbol) {
  try {
    // Check cache first
    const cacheKey = `quote_${symbol}`;
    const cached = stockCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`Returning cached quote for ${symbol}`);
      return cached.data;
    }

    if (!checkRateLimit()) {
      return null;
    }

    console.log(`Fetching quote for ${symbol} from Alpha Vantage...`);

    const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY
      }
    });

    // Check for API key issues
    if (response.data['Information']) {
      console.error('Alpha Vantage API issue:', response.data['Information']);
      return null;
    }

    const quote = response.data['Global Quote'];
    if (!quote || Object.keys(quote).length === 0) {
      console.log(`No quote data available for ${symbol}`);
      return null;
    }

    // Cache the result
    stockCache.set(cacheKey, {
      data: quote,
      timestamp: Date.now()
    });

    return quote;

  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error.message);
    return null;
  }
}

// Combine overview and quote data into our format
async function fetchCompleteStockData(symbol) {
  // Try to get both overview and quote data
  const [overview, quote] = await Promise.all([
    fetchCompanyOverview(symbol),
    fetchStockQuote(symbol)
  ]);

  // If we don't have overview data, we can't proceed
  if (!overview) {
    return null;
  }

  // Use quote data for current price if available, otherwise use overview data
  const currentPrice = quote 
    ? parseFloat(quote['05. price']) 
    : parseFloat(overview['50DayMovingAverage']) || 100;

  // Build our standard stock data format
  const stockData = {
    // Basic info
    symbol: overview.Symbol,
    name: overview.Name,
    sector: overview.Sector || 'Unknown',
    industry: overview.Industry || 'Unknown',
    
    // Price data (from quote if available)
    price: currentPrice,
    change: quote ? parseFloat(quote['09. change']) : 0,
    changePercent: quote ? parseFloat(quote['10. change percent'].replace('%', '')) : 0,
    volume: quote ? parseInt(quote['06. volume']) : parseInt(overview.SharesOutstanding) * 0.01,
    
    // Market data
    marketCap: parseFloat(overview.MarketCapitalization) || 0,
    
    // Valuation metrics
    pe: parseFloat(overview.PERatio) || parseFloat(overview.TrailingPE) || 0,
    forwardPE: parseFloat(overview.ForwardPE) || parseFloat(overview.PERatio) * 0.9 || 0,
    pegRatio: parseFloat(overview.PEGRatio) || 0,
    priceToBook: parseFloat(overview.PriceToBookRatio) || 0,
    
    // Financial metrics
    eps: parseFloat(overview.EPS) || parseFloat(overview.DilutedEPSTTM) || 0,
    forwardEps: parseFloat(overview.EPS) * 1.1 || 0, // Estimate
    currentRevenue: parseFloat(overview.RevenueTTM) || 0,
    guidedRevenue: parseFloat(overview.RevenueTTM) * 1.05 || 0, // Estimate 5% growth
    revenueGrowth: parseFloat(overview.QuarterlyRevenueGrowthYOY) || 0,
    profitMargin: parseFloat(overview.ProfitMargin) || 0,
    operatingMargin: parseFloat(overview.OperatingMarginTTM) || 0,
    
    // Returns
    roe: parseFloat(overview.ReturnOnEquityTTM) || 0,
    roa: parseFloat(overview.ReturnOnAssetsTTM) || 0,
    
    // Other metrics
    bookValue: parseFloat(overview.BookValue) || 0,
    debtToEquity: 0.5, // Not provided by Alpha Vantage overview
    beta: parseFloat(overview.Beta) || 1,
    
    // Dividend info
    dividendYield: parseFloat(overview.DividendYield) || 0,
    dividendPerShare: parseFloat(overview.DividendPerShare) || 0,
    
    // Price ranges
    dayHigh: quote ? parseFloat(quote['03. high']) : currentPrice * 1.01,
    dayLow: quote ? parseFloat(quote['04. low']) : currentPrice * 0.99,
    fiftyTwoWeekHigh: parseFloat(overview['52WeekHigh']) || currentPrice * 1.2,
    fiftyTwoWeekLow: parseFloat(overview['52WeekLow']) || currentPrice * 0.8,
    
    // Moving averages
    ma50: parseFloat(overview['50DayMovingAverage']) || currentPrice,
    ma200: parseFloat(overview['200DayMovingAverage']) || currentPrice,
    
    // Analyst data
    analystTargetPrice: parseFloat(overview.AnalystTargetPrice) || currentPrice * 1.1,
    analystRating: {
      strongBuy: parseInt(overview.AnalystRatingStrongBuy) || 0,
      buy: parseInt(overview.AnalystRatingBuy) || 0,
      hold: parseInt(overview.AnalystRatingHold) || 0,
      sell: parseInt(overview.AnalystRatingSell) || 0,
      strongSell: parseInt(overview.AnalystRatingStrongSell) || 0
    }
  };

  return stockData;
}

// Calculate expected growth based on available metrics
function calculateExpectedGrowth(stock) {
  // PE-based growth (if forward PE is lower than trailing PE, it suggests growth)
  const peGrowth = stock.pe && stock.forwardPE && stock.pe > 0 
    ? ((stock.pe - stock.forwardPE) / stock.pe) * 100 
    : 0;
  
  // Revenue growth (use actual data if available)
  const revenueGrowth = stock.revenueGrowth * 100;
  
  // EPS growth estimate
  const epsGrowth = stock.eps && stock.forwardEps && stock.eps > 0
    ? ((stock.forwardEps - stock.eps) / stock.eps) * 100
    : 0;
  
  // PEG ratio adjustment (lower PEG suggests better growth prospects)
  const pegAdjustment = stock.pegRatio && stock.pegRatio > 0 && stock.pegRatio < 2
    ? (2 - stock.pegRatio) * 10
    : 0;
  
  // Weighted average
  return (peGrowth * 0.3) + (revenueGrowth * 0.4) + (epsGrowth * 0.2) + (pegAdjustment * 0.1);
}

// Calculate value score
function calculateValueScore(stock) {
  let score = 0;
  
  // Low P/E ratio (compared to market average of ~20)
  if (stock.pe && stock.pe > 0 && stock.pe < 20) {
    score += (20 - stock.pe) * 2;
  }
  
  // Low forward P/E
  if (stock.forwardPE && stock.forwardPE > 0 && stock.forwardPE < 18) {
    score += (18 - stock.forwardPE) * 2;
  }
  
  // Low PEG ratio (< 1 is considered undervalued)
  if (stock.pegRatio && stock.pegRatio > 0 && stock.pegRatio < 1) {
    score += (1 - stock.pegRatio) * 20;
  }
  
  // Positive expected growth
  const growth = calculateExpectedGrowth(stock);
  if (growth > 0) {
    score += Math.min(growth, 30);
  }
  
  // Low price to book ratio
  if (stock.priceToBook && stock.priceToBook < 3) {
    score += (3 - stock.priceToBook) * 5;
  }
  
  // High ROE (> 15% is good)
  if (stock.roe > 0.15) {
    score += stock.roe * 50;
  }
  
  // Analyst sentiment
  if (stock.analystRating) {
    const totalRatings = Object.values(stock.analystRating).reduce((a, b) => a + b, 0);
    if (totalRatings > 0) {
      const bullishRatings = stock.analystRating.strongBuy + stock.analystRating.buy;
      const bullishPercent = bullishRatings / totalRatings;
      score += bullishPercent * 20;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      service: 'test-stock-server-alpha-only',
      dataSource: 'alphavantage',
      apiKey: ALPHA_VANTAGE_API_KEY === 'demo' ? 'demo (limited data)' : 'configured',
      rateLimit: {
        used: apiCallCount,
        limit: 5,
        resetsIn: Math.max(0, 60 - Math.floor((Date.now() - lastResetTime) / 1000)) + ' seconds'
      }
    }
  });
});

// Stock screener endpoint
app.get('/api/v1/stocks/screener', async (req, res) => {
  console.log('Stock screener endpoint hit - fetching data from Alpha Vantage');
  
  try {
    const stockData = [];
    
    // Process stocks with rate limiting
    for (let i = 0; i < STOCK_SYMBOLS.length; i++) {
      const symbol = STOCK_SYMBOLS[i];
      
      console.log(`\nProcessing ${symbol} (${i + 1}/${STOCK_SYMBOLS.length})`);
      
      const data = await fetchCompleteStockData(symbol);
      
      if (data) {
        stockData.push(data);
      }
      
      // Check if we need to wait for rate limit reset
      if (apiCallCount >= 5 && i < STOCK_SYMBOLS.length - 1) {
        const waitTime = 60000 - (Date.now() - lastResetTime);
        if (waitTime > 0) {
          console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
          await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
        }
      }
    }
    
    // Filter by sector if provided
    let filteredStocks = stockData;
    if (req.query.sector && req.query.sector !== 'All Sectors') {
      filteredStocks = filteredStocks.filter(stock => stock.sector === req.query.sector);
    }
    
    // Add favorite status and calculate scores
    const stocksWithExtras = filteredStocks.map(stock => ({
      ...stock,
      isFavorite: userFavorites.includes(stock.symbol),
      expectedGrowth: calculateExpectedGrowth(stock),
      valueScore: calculateValueScore(stock)
    }));
    
    // Sort by value score by default
    stocksWithExtras.sort((a, b) => b.valueScore - a.valueScore);
    
    res.json({
      success: true,
      data: stocksWithExtras,
      meta: {
        total: stocksWithExtras.length,
        timestamp: new Date(),
        dataSource: 'alphavantage',
        apiCalls: apiCallCount,
        cacheHits: stockCache.size
      }
    });
    
  } catch (error) {
    console.error('Error in stock screener:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock data',
      message: error.message
    });
  }
});

// Get single stock quote
app.get('/api/v1/stocks/quote/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  
  try {
    const stockData = await fetchCompleteStockData(symbol);
    
    if (!stockData) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found or rate limit exceeded'
      });
    }
    
    res.json({
      success: true,
      data: {
        ...stockData,
        isFavorite: userFavorites.includes(symbol),
        expectedGrowth: calculateExpectedGrowth(stockData),
        valueScore: calculateValueScore(stockData)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock quote',
      message: error.message
    });
  }
});

// Get sectors
app.get('/api/v1/stocks/sectors', (req, res) => {
  const sectors = [
    'TECHNOLOGY',
    'HEALTHCARE',
    'FINANCE',
    'CONSUMER CYCLICAL',
    'COMMUNICATION SERVICES',
    'INDUSTRIALS',
    'CONSUMER DEFENSIVE',
    'ENERGY',
    'UTILITIES',
    'REAL ESTATE',
    'BASIC MATERIALS'
  ];
  
  res.json({
    success: true,
    data: sectors
  });
});

// Get user favorites
app.get('/api/v1/stocks/favorites', (req, res) => {
  res.json({
    success: true,
    data: userFavorites
  });
});

// Add to favorites
app.post('/api/v1/stocks/favorites/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  
  if (!userFavorites.includes(symbol)) {
    userFavorites.push(symbol);
  }
  
  res.json({
    success: true,
    data: { symbol, favorited: true }
  });
});

// Remove from favorites
app.delete('/api/v1/stocks/favorites/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  userFavorites = userFavorites.filter(fav => fav !== symbol);
  
  res.json({
    success: true,
    data: { symbol, favorited: false }
  });
});

const PORT = 9999;
app.listen(PORT, () => {
  console.log(`\n🚀 Alpha Vantage Stock Server`);
  console.log(`==========================================`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`API: Alpha Vantage (https://www.alphavantage.co)`);
  console.log(`Endpoints:`);
  console.log(`  - Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`  - Screener: http://localhost:${PORT}/api/v1/stocks/screener`);
  console.log(`  - Quote: http://localhost:${PORT}/api/v1/stocks/quote/:symbol`);
  console.log(`  - Favorites: http://localhost:${PORT}/api/v1/stocks/favorites`);
  console.log(`\nAPI Key Status: ${ALPHA_VANTAGE_API_KEY === 'demo' ? '⚠️  Demo (limited data)' : '✅ Configured'}`);
  console.log(`Rate Limit: 5 calls/minute, 500 calls/day`);
  console.log(`==========================================\n`);
  
  if (ALPHA_VANTAGE_API_KEY === 'demo') {
    console.log('📌 Note: The demo API key provides limited data.');
    console.log('   To access full data:');
    console.log('   1. Get a free API key from https://www.alphavantage.co/support/#api-key');
    console.log('   2. Set: export ALPHA_VANTAGE_API_KEY=your_api_key_here\n');
  }
});