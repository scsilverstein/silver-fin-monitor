const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// API configurations
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'wVayobDc0Srnc30c0doWHyvPziv05wpK';
const POLYGON_BASE_URL = 'https://api.polygon.io';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

// In-memory favorites storage
let userFavorites = [];

// Cache for stock data
const stockCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting tracking
const rateLimits = {
  polygon: {
    count: 0,
    resetTime: Date.now() + 60000,
    limit: 5
  },
  alphaVantage: {
    count: 0,
    resetTime: Date.now() + 60000,
    limit: 5
  }
};

// Popular stocks to fetch
const STOCK_SYMBOLS = [
  // Tech giants
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
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

// Sector mapping for Alpha Vantage
const SECTOR_MAP = {
  // Tech
  'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 
  'NVDA': 'Technology', 'META': 'Technology', 'ADBE': 'Technology',
  'CRM': 'Technology', 'AMD': 'Technology', 'INTC': 'Technology',
  'CSCO': 'Technology', 'ORCL': 'Technology',
  
  // Consumer
  'AMZN': 'Consumer Discretionary', 'TSLA': 'Consumer Discretionary',
  'WMT': 'Consumer Discretionary', 'HD': 'Consumer Discretionary',
  'MCD': 'Consumer Discretionary', 'NKE': 'Consumer Discretionary',
  'SBUX': 'Consumer Discretionary', 'DIS': 'Consumer Discretionary',
  'NFLX': 'Communication Services',
  
  // Consumer Staples
  'COST': 'Consumer Staples', 'PEP': 'Consumer Staples', 'KO': 'Consumer Staples',
  
  // Healthcare
  'UNH': 'Healthcare', 'JNJ': 'Healthcare', 'PFE': 'Healthcare',
  'ABBV': 'Healthcare', 'CVS': 'Healthcare', 'LLY': 'Healthcare',
  
  // Financial
  'JPM': 'Financials', 'V': 'Financials', 'MA': 'Financials',
  'BAC': 'Financials', 'WFC': 'Financials', 'GS': 'Financials',
  
  // Industrial
  'BA': 'Industrials', 'CAT': 'Industrials', 'HON': 'Industrials',
  'UPS': 'Industrials', 'MMM': 'Industrials',
  
  // Energy
  'XOM': 'Energy', 'CVX': 'Energy'
};

// Check rate limits
function checkRateLimit(provider) {
  const now = Date.now();
  const limit = rateLimits[provider];
  
  // Reset counter if time window has passed
  if (now >= limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + 60000; // Reset for next minute
  }
  
  if (limit.count >= limit.limit) {
    return false; // Rate limit exceeded
  }
  
  limit.count++;
  return true;
}

// Map SIC code to GICS sector (for Polygon data)
function mapSicToSector(sicCode, sicDescription) {
  if (!sicCode) return 'Technology';
  
  const code = parseInt(sicCode);
  
  // Using standard SIC code ranges to map to GICS sectors
  if (code >= 100 && code <= 999) return 'Agriculture';
  else if (code >= 1000 && code <= 1499) return 'Energy';
  else if (code >= 1500 && code <= 1799) return 'Industrials';
  else if (code >= 2000 && code <= 2099) return 'Consumer Staples';
  else if (code >= 2100 && code <= 2199) return 'Consumer Staples';
  else if (code >= 2200 && code <= 2299) return 'Consumer Discretionary';
  else if (code >= 2300 && code <= 2399) return 'Consumer Discretionary';
  else if (code >= 2400 && code <= 2499) return 'Materials';
  else if (code >= 2500 && code <= 2599) return 'Consumer Discretionary';
  else if (code >= 2600 && code <= 2699) return 'Materials';
  else if (code >= 2700 && code <= 2799) return 'Communication Services';
  else if (code >= 2800 && code <= 2899) return 'Materials';
  else if (code >= 2900 && code <= 2999) return 'Energy';
  else if (code >= 3000 && code <= 3099) return 'Materials';
  else if (code >= 3100 && code <= 3199) return 'Consumer Discretionary';
  else if (code >= 3200 && code <= 3299) return 'Materials';
  else if (code >= 3300 && code <= 3399) return 'Materials';
  else if (code >= 3400 && code <= 3499) return 'Industrials';
  else if (code >= 3500 && code <= 3599) return 'Technology';
  else if (code >= 3600 && code <= 3699) return 'Technology';
  else if (code >= 3700 && code <= 3799) return 'Industrials';
  else if (code >= 3800 && code <= 3899) return 'Healthcare';
  else if (code >= 3900 && code <= 3999) return 'Consumer Discretionary';
  else if (code >= 4000 && code <= 4799) return 'Industrials';
  else if (code >= 4800 && code <= 4899) return 'Communication Services';
  else if (code >= 4900 && code <= 4999) return 'Utilities';
  else if (code >= 5000 && code <= 5199) return 'Consumer Discretionary';
  else if (code >= 5200 && code <= 5999) return 'Consumer Discretionary';
  else if (code >= 6000 && code <= 6199) return 'Financials';
  else if (code >= 6200 && code <= 6299) return 'Financials';
  else if (code >= 6300 && code <= 6499) return 'Financials';
  else if (code >= 6500 && code <= 6599) return 'Real Estate';
  else if (code >= 6700 && code <= 6799) return 'Financials';
  else if (code >= 6800 && code <= 6899) return 'Real Estate';
  else if (code >= 7000 && code <= 7099) return 'Consumer Discretionary';
  else if (code >= 7200 && code <= 7299) return 'Consumer Discretionary';
  else if (code >= 7370 && code <= 7379) return 'Technology';
  else if (code >= 7300 && code <= 7369) return 'Industrials';
  else if (code >= 7380 && code <= 7399) return 'Industrials';
  else if (code >= 7500 && code <= 7599) return 'Industrials';
  else if (code >= 7800 && code <= 7999) return 'Communication Services';
  else if (code >= 8000 && code <= 8099) return 'Healthcare';
  else if (code >= 8200 && code <= 8299) return 'Consumer Discretionary';
  else if (code >= 8700 && code <= 8799) return 'Industrials';
  
  // Default based on description if code doesn't match
  if (sicDescription) {
    const desc = sicDescription.toLowerCase();
    if (desc.includes('computer') || desc.includes('software')) return 'Technology';
    if (desc.includes('pharmaceutical') || desc.includes('biotech')) return 'Healthcare';
    if (desc.includes('bank') || desc.includes('finance')) return 'Financials';
    if (desc.includes('food') || desc.includes('beverage')) return 'Consumer Staples';
    if (desc.includes('communication') || desc.includes('media')) return 'Communication Services';
  }
  
  return 'Technology'; // Default
}

// Fetch from Polygon
async function fetchFromPolygon(symbol) {
  if (!checkRateLimit('polygon')) {
    console.log('Polygon rate limit reached');
    return null;
  }

  try {
    console.log(`Fetching ${symbol} from Polygon...`);
    
    const detailsRes = await axios.get(`${POLYGON_BASE_URL}/v3/reference/tickers/${symbol}`, {
      params: { apiKey: POLYGON_API_KEY }
    }).catch(err => {
      console.error(`Polygon API error for ${symbol}:`, err.message);
      return null;
    });
    
    if (!detailsRes || !detailsRes.data?.results) {
      return null;
    }
    
    const details = detailsRes.data.results;
    
    // Calculate metrics
    const price = Math.random() * 200 + 50; // Mock price for now
    const marketCap = details.market_cap || (price * 1e9);
    const pe = Math.random() * 30 + 10;
    const eps = price / pe;
    const forwardPE = pe * (0.8 + Math.random() * 0.3);
    const forwardEps = price / forwardPE;
    const revenue = Math.random() * 100e9 + 10e9;
    const revenueGrowth = Math.random() * 0.2 - 0.05;
    
    const sector = mapSicToSector(details.sic_code, details.sic_description);
    
    return {
      symbol: symbol,
      name: details.name || symbol,
      sector: sector,
      industry: details.sic_description || '',
      marketCap: marketCap,
      price: price,
      pe: pe,
      forwardPE: forwardPE,
      currentRevenue: revenue,
      guidedRevenue: revenue * (1 + revenueGrowth),
      revenueGrowth: revenueGrowth,
      eps: eps,
      forwardEps: forwardEps,
      priceToBook: Math.random() * 10 + 1,
      debtToEquity: Math.random() * 2,
      change: (Math.random() - 0.5) * 10,
      changePercent: (Math.random() - 0.5) * 5,
      volume: Math.random() * 50e6,
      dayHigh: price * 1.02,
      dayLow: price * 0.98,
      fiftyTwoWeekHigh: price * 1.5,
      fiftyTwoWeekLow: price * 0.7,
      dataSource: 'polygon'
    };
    
  } catch (error) {
    console.error(`Error fetching from Polygon for ${symbol}:`, error.message);
    return null;
  }
}

// Fetch from Alpha Vantage
async function fetchFromAlphaVantage(symbol) {
  if (ALPHA_VANTAGE_API_KEY === 'demo') {
    console.log('Alpha Vantage requires a valid API key (not demo)');
    return null;
  }
  
  if (!checkRateLimit('alphaVantage')) {
    console.log('Alpha Vantage rate limit reached');
    return null;
  }

  try {
    console.log(`Fetching ${symbol} from Alpha Vantage...`);
    
    const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY
      }
    });
    
    if (response.data['Information'] && response.data['Information'].includes('demo')) {
      console.error('Alpha Vantage demo key detected - need real API key');
      return null;
    }
    
    if (response.data['Note']) {
      console.error('Alpha Vantage API call frequency limit reached');
      return null;
    }
    
    const quote = response.data['Global Quote'];
    if (!quote || Object.keys(quote).length === 0) {
      return null;
    }
    
    const price = parseFloat(quote['05. price']);
    const pe = Math.random() * 25 + 10;
    const revenue = Math.random() * 50e9 + 10e9;
    const revenueGrowth = Math.random() * 0.2 - 0.05;
    
    return {
      symbol: quote['01. symbol'],
      name: `${quote['01. symbol']} Corp`,
      sector: SECTOR_MAP[symbol] || 'Technology',
      industry: SECTOR_MAP[symbol] || 'General',
      price: price,
      open: parseFloat(quote['02. open']),
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      volume: parseInt(quote['06. volume']),
      previousClose: parseFloat(quote['08. previous close']),
      change: parseFloat(quote['09. change']),
      changePercent: quote['10. change percent'],
      marketCap: price * 1000000000,
      pe: pe,
      forwardPE: pe * 0.9,
      eps: price / pe,
      forwardEps: price / (pe * 0.9),
      currentRevenue: revenue,
      guidedRevenue: revenue * (1 + revenueGrowth),
      revenueGrowth: revenueGrowth,
      priceToBook: Math.random() * 5 + 1,
      debtToEquity: Math.random() * 1.5,
      dayHigh: parseFloat(quote['03. high']),
      dayLow: parseFloat(quote['04. low']),
      fiftyTwoWeekHigh: parseFloat(quote['03. high']) * 1.2,
      fiftyTwoWeekLow: parseFloat(quote['04. low']) * 0.8,
      dataSource: 'alphaVantage'
    };
    
  } catch (error) {
    console.error(`Error fetching from Alpha Vantage for ${symbol}:`, error.message);
    return null;
  }
}

// Fetch stock data with fallback
async function fetchStockData(symbol) {
  // Check cache first
  const cached = stockCache.get(symbol);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`Returning cached data for ${symbol}`);
    return cached.data;
  }
  
  // Try Polygon first
  let data = await fetchFromPolygon(symbol);
  
  // If Polygon fails, try Alpha Vantage
  if (!data) {
    console.log(`Polygon failed for ${symbol}, trying Alpha Vantage...`);
    data = await fetchFromAlphaVantage(symbol);
  }
  
  // Cache the result if we got data
  if (data) {
    stockCache.set(symbol, {
      data: data,
      timestamp: Date.now()
    });
  }
  
  return data;
}

// Calculate expected growth
function calculateExpectedGrowth(stock) {
  const peGrowth = stock.pe && stock.forwardPE && stock.pe > 0 
    ? ((stock.pe - stock.forwardPE) / stock.pe) * 100 
    : 0;
  
  const revenueGrowth = stock.revenueGrowth * 100;
  
  const epsGrowth = stock.eps && stock.forwardEps && stock.eps > 0
    ? ((stock.forwardEps - stock.eps) / stock.eps) * 100
    : 0;
  
  return (peGrowth * 0.4) + (revenueGrowth * 0.4) + (epsGrowth * 0.2);
}

// Calculate value score
function calculateValueScore(stock) {
  let score = 0;
  
  if (stock.pe && stock.pe > 0 && stock.pe < 20) {
    score += (20 - stock.pe) * 2;
  }
  
  if (stock.forwardPE && stock.forwardPE > 0 && stock.forwardPE < 18) {
    score += (18 - stock.forwardPE) * 2;
  }
  
  const growth = calculateExpectedGrowth(stock);
  if (growth > 0) {
    score += Math.min(growth, 30);
  }
  
  if (stock.priceToBook && stock.priceToBook < 3) {
    score += (3 - stock.priceToBook) * 5;
  }
  
  if (stock.debtToEquity && stock.debtToEquity < 1) {
    score += (1 - stock.debtToEquity) * 10;
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
      service: 'test-stock-server-hybrid',
      dataSources: {
        polygon: { 
          available: true,
          rateLimit: `${rateLimits.polygon.count}/${rateLimits.polygon.limit}`,
          apiKey: POLYGON_API_KEY ? 'configured' : 'missing'
        },
        alphaVantage: { 
          available: ALPHA_VANTAGE_API_KEY !== 'demo',
          rateLimit: `${rateLimits.alphaVantage.count}/${rateLimits.alphaVantage.limit}`,
          apiKey: ALPHA_VANTAGE_API_KEY === 'demo' ? 'demo (not valid)' : 'configured'
        }
      }
    }
  });
});

// Stock screener endpoint
app.get('/api/v1/stocks/screener', async (req, res) => {
  console.log('Stock screener endpoint hit - fetching data from available sources');
  
  try {
    const stockData = [];
    
    // Process stocks with minimal delay between providers
    for (let i = 0; i < STOCK_SYMBOLS.length; i++) {
      const symbol = STOCK_SYMBOLS[i];
      const data = await fetchStockData(symbol);
      
      if (data) {
        stockData.push(data);
      }
      
      // Small delay to prevent overwhelming the APIs
      if (i < STOCK_SYMBOLS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
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
    
    // Show data source statistics
    const sourceStats = stocksWithExtras.reduce((acc, stock) => {
      acc[stock.dataSource] = (acc[stock.dataSource] || 0) + 1;
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: stocksWithExtras,
      meta: {
        total: stocksWithExtras.length,
        timestamp: new Date(),
        sources: sourceStats,
        rateLimits: {
          polygon: `${rateLimits.polygon.count}/${rateLimits.polygon.limit}`,
          alphaVantage: `${rateLimits.alphaVantage.count}/${rateLimits.alphaVantage.limit}`
        }
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
    const stockData = await fetchStockData(symbol);
    
    if (!stockData) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found'
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
    'Technology',
    'Healthcare',
    'Financials',
    'Consumer Discretionary',
    'Communication Services',
    'Industrials',
    'Consumer Staples',
    'Energy',
    'Utilities',
    'Real Estate',
    'Materials'
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
  console.log(`Hybrid stock server running on http://localhost:${PORT}`);
  console.log(`Primary: Polygon API | Fallback: Alpha Vantage`);
  console.log(`Stock screener endpoint: http://localhost:${PORT}/api/v1/stocks/screener`);
  console.log('');
  console.log('Data Sources:');
  console.log(`- Polygon: ${POLYGON_API_KEY ? 'Configured' : 'Missing API key'}`);
  console.log(`- Alpha Vantage: ${ALPHA_VANTAGE_API_KEY === 'demo' ? 'Demo key (not valid for real data)' : 'Configured'}`);
  console.log('');
  if (ALPHA_VANTAGE_API_KEY === 'demo') {
    console.log('To enable Alpha Vantage fallback:');
    console.log('1. Get a free API key from https://www.alphavantage.co/support/#api-key');
    console.log('2. Set: export ALPHA_VANTAGE_API_KEY=your_api_key_here');
  }
});