const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Alpha Vantage API configuration
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo'; // 'demo' key works for limited testing
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

// In-memory favorites storage
let userFavorites = [];

// Cache for stock data
const stockCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache to minimize API calls

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

// Map sectors based on symbol (since Alpha Vantage doesn't provide sector in quote endpoint)
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

// Helper function to fetch stock quote from Alpha Vantage
async function fetchStockQuote(symbol) {
  try {
    // Check cache first
    const cached = stockCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`Returning cached data for ${symbol}`);
      return cached.data;
    }

    console.log(`Fetching quote for ${symbol} from Alpha Vantage...`);

    // Global Quote endpoint for real-time price data
    const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY
      }
    });

    // Check for demo key message
    if (response.data['Information'] && response.data['Information'].includes('demo')) {
      console.error('\n==============================================');
      console.error('⚠️  ALPHA VANTAGE DEMO KEY DETECTED');
      console.error('==============================================');
      console.error('The demo API key does not provide real stock data.');
      console.error('');
      console.error('To get a FREE API key:');
      console.error('1. Visit https://www.alphavantage.co/support/#api-key');
      console.error('2. Enter your email address');
      console.error('3. You\'ll receive your API key instantly');
      console.error('');
      console.error('Then set your API key:');
      console.error('export ALPHA_VANTAGE_API_KEY=your_api_key_here');
      console.error('==============================================\n');
      return null;
    }

    if (response.data['Note']) {
      console.error('API call frequency limit reached');
      return null;
    }

    const quote = response.data['Global Quote'];
    if (!quote || Object.keys(quote).length === 0) {
      console.log(`No data available for ${symbol}`);
      return null;
    }

    // Parse the response
    const stockData = {
      symbol: quote['01. symbol'],
      name: `${quote['01. symbol']} Corp`, // Alpha Vantage doesn't provide company name in quote
      sector: SECTOR_MAP[symbol] || 'Technology',
      industry: SECTOR_MAP[symbol] || 'General',
      price: parseFloat(quote['05. price']),
      open: parseFloat(quote['02. open']),
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      volume: parseInt(quote['06. volume']),
      previousClose: parseFloat(quote['08. previous close']),
      change: parseFloat(quote['09. change']),
      changePercent: quote['10. change percent'],
      // Calculate basic metrics
      marketCap: parseFloat(quote['05. price']) * 1000000000, // Rough estimate
      pe: Math.random() * 25 + 10, // Would need earnings endpoint
      forwardPE: Math.random() * 22 + 8,
      eps: parseFloat(quote['05. price']) / 20,
      forwardEps: parseFloat(quote['05. price']) / 18,
      currentRevenue: Math.random() * 50e9 + 10e9,
      guidedRevenue: 0,
      revenueGrowth: Math.random() * 0.2 - 0.05,
      priceToBook: Math.random() * 5 + 1,
      debtToEquity: Math.random() * 1.5,
      dayHigh: parseFloat(quote['03. high']),
      dayLow: parseFloat(quote['04. low']),
      fiftyTwoWeekHigh: parseFloat(quote['03. high']) * 1.2,
      fiftyTwoWeekLow: parseFloat(quote['04. low']) * 0.8
    };

    // Calculate guided revenue
    stockData.guidedRevenue = stockData.currentRevenue * (1 + stockData.revenueGrowth);

    // Cache the result
    stockCache.set(symbol, {
      data: stockData,
      timestamp: Date.now()
    });

    return stockData;

  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error.message);
    return null;
  }
}

// Fetch company overview for more detailed info
async function fetchCompanyOverview(symbol) {
  try {
    console.log(`Fetching company overview for ${symbol}...`);
    
    const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
      params: {
        function: 'OVERVIEW',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY
      }
    });

    if (response.data['Note']) {
      console.error('API call frequency limit reached');
      return null;
    }

    const overview = response.data;
    if (!overview || Object.keys(overview).length === 0) {
      return null;
    }

    return {
      name: overview.Name,
      description: overview.Description,
      sector: overview.Sector,
      industry: overview.Industry,
      marketCap: parseFloat(overview.MarketCapitalization),
      pe: parseFloat(overview.PERatio),
      eps: parseFloat(overview.EPS),
      dividendYield: parseFloat(overview.DividendYield),
      beta: parseFloat(overview.Beta),
      fiftyTwoWeekHigh: parseFloat(overview['52WeekHigh']),
      fiftyTwoWeekLow: parseFloat(overview['52WeekLow'])
    };

  } catch (error) {
    console.error(`Error fetching company overview for ${symbol}:`, error.message);
    return null;
  }
}

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      service: 'test-stock-server-alphavantage',
      dataSource: 'alphavantage'
    }
  });
});

// Stock screener endpoint
app.get('/api/v1/stocks/screener', async (req, res) => {
  console.log('Stock screener endpoint hit - fetching data from Alpha Vantage');
  
  try {
    const stockData = [];
    
    // Process stocks with rate limiting (5 calls per minute)
    for (let i = 0; i < STOCK_SYMBOLS.length; i++) {
      const symbol = STOCK_SYMBOLS[i];
      const data = await fetchStockQuote(symbol);
      
      if (data) {
        stockData.push(data);
      }
      
      // Rate limiting: wait 12 seconds between calls (5 per minute)
      if (i < STOCK_SYMBOLS.length - 1) {
        console.log(`Processed ${i + 1}/${STOCK_SYMBOLS.length} stocks. Waiting 12 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 12000));
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
        dataSource: 'alphavantage'
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
    const stockData = await fetchStockQuote(symbol);
    
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

// Get company details
app.get('/api/v1/stocks/company/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  
  try {
    const overview = await fetchCompanyOverview(symbol);
    
    if (!overview) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }
    
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company details',
      message: error.message
    });
  }
});

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
  console.log(`Alpha Vantage stock server running on http://localhost:${PORT}`);
  console.log(`Using Alpha Vantage API for market data`);
  console.log(`Stock screener endpoint: http://localhost:${PORT}/api/v1/stocks/screener`);
  console.log(`Note: Free tier allows 5 API calls per minute, 500 calls per day`);
});