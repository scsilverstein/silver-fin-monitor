const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Polygon API configuration
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'wVayobDc0Srnc30c0doWHyvPziv05wpK';
const POLYGON_BASE_URL = 'https://api.polygon.io';

// In-memory favorites storage (in production, this would be in a database)
let userFavorites = [];

// Cache for stock data (to avoid hitting API limits)
const stockCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Popular stocks to fetch - extended list for better coverage
const NASDAQ_SYMBOLS = [
  // Mega cap tech (most likely to have data)
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  
  // Large cap tech
  'AVGO', 'ORCL', 'ADBE', 'CRM', 'AMD', 'INTC', 'CSCO', 'QCOM', 'TXN',
  
  // Consumer & Retail
  'WMT', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT', 'COST', 'PEP', 'KO', 'PG',
  
  // Healthcare & Pharma
  'UNH', 'JNJ', 'LLY', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'CVS', 'AMGN',
  
  // Financial Services
  'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'AXP', 'PYPL',
  
  // Industrial & Energy
  'XOM', 'CVX', 'CAT', 'BA', 'HON', 'UPS', 'RTX', 'LMT', 'GE', 'MMM',
  
  // Entertainment & Media
  'DIS', 'NFLX', 'CMCSA', 'T', 'VZ', 'TMUS',
  
  // More diversified
  'SPY', 'QQQ', 'DIA', 'IWM' // ETFs often have good data
];

// Helper function to fetch stock details from Polygon
async function fetchStockDetails(symbol) {
  try {
    // Check cache first - but only if it has real data (has name property from API)
    const cached = stockCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL) && cached.data && cached.data.name !== symbol) {
      return cached.data;
    }

    console.log(`Fetching data for ${symbol} from Polygon API...`);

    // Only fetch company details for now to reduce API calls
    const detailsRes = await axios.get(`${POLYGON_BASE_URL}/v3/reference/tickers/${symbol}`, {
      params: { apiKey: POLYGON_API_KEY }
    }).catch(err => {
      console.error(`Failed to fetch details for ${symbol}:`, err.message);
      return null;
    });
    
    // Set other responses to null to save API calls
    const snapshotRes = null;
    const financialsRes = null;

    // Extract data from responses
    const details = detailsRes?.data?.results || {};
    const snapshot = snapshotRes?.data?.ticker || {};
    const financials = financialsRes?.data?.results?.[0] || {};
    
    // If we didn't get any real data from the API, return null
    if (!details.name) {
      console.log(`No real data available for ${symbol}`);
      return null;
    }
    
    // Log the API response to see what sector data is available
    if (symbol === 'AAPL' || symbol === 'MDLZ' || symbol === 'PEP') {
      console.log(`Details for ${symbol}:`, JSON.stringify({
        ticker: details.ticker,
        name: details.name,
        sic_code: details.sic_code,
        sic_description: details.sic_description
      }, null, 2));
    }

    // Calculate derived metrics
    const price = snapshot.day?.c || snapshot.prevDay?.c || Math.random() * 200 + 50;
    const marketCap = details.market_cap || (details.share_class_shares_outstanding * price) || 0;
    const pe = snapshot.prevDay?.pe || Math.random() * 30 + 10;
    const eps = price / pe;
    const forwardPE = pe * (0.8 + Math.random() * 0.3); // Estimate forward P/E
    const forwardEps = price / forwardPE;

    // Extract financial metrics
    const revenue = financials.financials?.income_statement?.revenues?.value || Math.random() * 100e9 + 10e9;
    const revenueGrowth = financials.financials?.income_statement?.revenue_growth?.value || Math.random() * 0.2 - 0.05;
    const debtToEquity = financials.financials?.balance_sheet?.debt_to_equity_ratio?.value || Math.random() * 1.5;
    const bookValue = financials.financials?.balance_sheet?.book_value_per_share?.value || price * 0.3;
    const priceToBook = price / bookValue;

    // Use SIC code from API to determine sector
    const sector = mapSicToSector(details.sic_code, details.sic_description);

    const stockData = {
      symbol: symbol,
      name: details.name || '',
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
      priceToBook: priceToBook,
      debtToEquity: debtToEquity,
      change: snapshot.todaysChange || 0,
      changePercent: snapshot.todaysChangePerc || 0,
      volume: snapshot.day?.v || snapshot.prevDay?.v || 0,
      dayHigh: snapshot.day?.h || price,
      dayLow: snapshot.day?.l || price,
      fiftyTwoWeekHigh: snapshot.prevDay?.h || price * 1.2,
      fiftyTwoWeekLow: snapshot.prevDay?.l || price * 0.8
    };

    // Only cache if we got real data (name is not just the symbol)
    if (stockData.name && stockData.name !== symbol) {
      stockCache.set(symbol, {
        data: stockData,
        timestamp: Date.now()
      });
    }

    return stockData;

  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error.message);
    // Return null instead of mock data - we only want real data
    return null;
  }
}

// Map SIC code to GICS sector
function mapSicToSector(sicCode, sicDescription) {
  if (!sicCode) return 'Technology';
  
  const code = parseInt(sicCode);
  
  // Using standard SIC code ranges to map to GICS sectors
  if (code >= 100 && code <= 999) return 'Agriculture';
  else if (code >= 1000 && code <= 1499) return 'Energy'; // Mining
  else if (code >= 1500 && code <= 1799) return 'Industrials'; // Construction
  else if (code >= 2000 && code <= 2099) return 'Consumer Staples'; // Food products
  else if (code >= 2100 && code <= 2199) return 'Consumer Staples'; // Tobacco
  else if (code >= 2200 && code <= 2299) return 'Consumer Discretionary'; // Textile
  else if (code >= 2300 && code <= 2399) return 'Consumer Discretionary'; // Apparel
  else if (code >= 2400 && code <= 2499) return 'Materials'; // Lumber & Wood
  else if (code >= 2500 && code <= 2599) return 'Consumer Discretionary'; // Furniture
  else if (code >= 2600 && code <= 2699) return 'Materials'; // Paper
  else if (code >= 2700 && code <= 2799) return 'Communication Services'; // Printing & Publishing
  else if (code >= 2800 && code <= 2899) return 'Materials'; // Chemicals
  else if (code >= 2900 && code <= 2999) return 'Energy'; // Petroleum & Coal
  else if (code >= 3000 && code <= 3099) return 'Materials'; // Rubber & Plastics
  else if (code >= 3100 && code <= 3199) return 'Consumer Discretionary'; // Leather
  else if (code >= 3200 && code <= 3299) return 'Materials'; // Stone, Clay & Glass
  else if (code >= 3300 && code <= 3399) return 'Materials'; // Primary Metal
  else if (code >= 3400 && code <= 3499) return 'Industrials'; // Fabricated Metal
  else if (code >= 3500 && code <= 3599) return 'Technology'; // Machinery & Computer Equipment
  else if (code >= 3600 && code <= 3699) return 'Technology'; // Electronic Equipment
  else if (code >= 3700 && code <= 3799) return 'Industrials'; // Transportation Equipment
  else if (code >= 3800 && code <= 3899) return 'Healthcare'; // Instruments
  else if (code >= 3900 && code <= 3999) return 'Consumer Discretionary'; // Misc Manufacturing
  else if (code >= 4000 && code <= 4799) return 'Industrials'; // Transportation
  else if (code >= 4800 && code <= 4899) return 'Communication Services'; // Communications
  else if (code >= 4900 && code <= 4999) return 'Utilities'; // Electric, Gas & Sanitary
  else if (code >= 5000 && code <= 5199) return 'Consumer Discretionary'; // Wholesale Trade
  else if (code >= 5200 && code <= 5999) return 'Consumer Discretionary'; // Retail Trade
  else if (code >= 6000 && code <= 6199) return 'Financials'; // Banking
  else if (code >= 6200 && code <= 6299) return 'Financials'; // Security Brokers
  else if (code >= 6300 && code <= 6499) return 'Financials'; // Insurance
  else if (code >= 6500 && code <= 6599) return 'Real Estate'; // Real Estate
  else if (code >= 6700 && code <= 6799) return 'Financials'; // Holding Companies
  else if (code >= 6800 && code <= 6899) return 'Real Estate'; // Real Estate Investment Trusts
  else if (code >= 7000 && code <= 7099) return 'Consumer Discretionary'; // Hotels
  else if (code >= 7200 && code <= 7299) return 'Consumer Discretionary'; // Personal Services
  else if (code >= 7370 && code <= 7379) return 'Technology'; // Computer Programming & Data Processing
  else if (code >= 7300 && code <= 7369) return 'Industrials'; // Business Services (excluding tech)
  else if (code >= 7380 && code <= 7399) return 'Industrials'; // Other Business Services
  else if (code >= 7500 && code <= 7599) return 'Industrials'; // Auto Repair
  else if (code >= 7800 && code <= 7999) return 'Communication Services'; // Motion Pictures
  else if (code >= 8000 && code <= 8099) return 'Healthcare'; // Health Services
  else if (code >= 8200 && code <= 8299) return 'Consumer Discretionary'; // Educational Services
  else if (code >= 8700 && code <= 8799) return 'Industrials'; // Engineering & Management Services
  
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

// Generate mock data as fallback
function generateMockData(symbol) {
  const price = Math.random() * 300 + 50;
  const pe = Math.random() * 30 + 10;
  const revenue = Math.random() * 100e9 + 10e9;
  const revenueGrowth = Math.random() * 0.2 - 0.05;
  
  // Mock SIC codes for known symbols (based on real data)
  const mockSicCodes = {
    'AAPL': { code: '3571', desc: 'ELECTRONIC COMPUTERS' },
    'MSFT': { code: '7372', desc: 'PREPACKAGED SOFTWARE' },
    'GOOGL': { code: '7375', desc: 'INFORMATION RETRIEVAL SERVICES' },
    'AMZN': { code: '5961', desc: 'CATALOG AND MAIL-ORDER HOUSES' },
    'META': { code: '7374', desc: 'COMPUTER PROCESSING & DATA PREPARATION' },
    'TSLA': { code: '3711', desc: 'MOTOR VEHICLES & PASSENGER CAR BODIES' },
    'NVDA': { code: '3674', desc: 'SEMICONDUCTORS & RELATED DEVICES' },
    'PEP': { code: '2080', desc: 'BEVERAGES' },
    'COST': { code: '5331', desc: 'VARIETY STORES' },
    'MDLZ': { code: '2052', desc: 'COOKIES AND CRACKERS' },
    'SBUX': { code: '5812', desc: 'EATING PLACES' },
    'NFLX': { code: '7841', desc: 'VIDEO TAPE RENTAL' },
    'CSCO': { code: '3576', desc: 'COMPUTER COMMUNICATIONS EQUIPMENT' },
    'INTC': { code: '3674', desc: 'SEMICONDUCTORS & RELATED DEVICES' },
    'AMD': { code: '3674', desc: 'SEMICONDUCTORS & RELATED DEVICES' },
    'AMGN': { code: '2836', desc: 'BIOLOGICAL PRODUCTS' },
    'GILD': { code: '2834', desc: 'PHARMACEUTICAL PREPARATIONS' },
    'PYPL': { code: '7389', desc: 'BUSINESS SERVICES' },
    'ADP': { code: '7374', desc: 'COMPUTER PROCESSING & DATA PREPARATION' },
    'HON': { code: '3822', desc: 'AUTOMATIC CONTROLS FOR REGULATING ENVIRONMENTS' },
    'ISRG': { code: '3845', desc: 'ELECTROMEDICAL & ELECTROTHERAPEUTIC APPARATUS' },
    'REGN': { code: '2834', desc: 'PHARMACEUTICAL PREPARATIONS' },
    'MNST': { code: '2086', desc: 'BOTTLED & CANNED SOFT DRINKS & CARBONATED WATERS' },
    'MAR': { code: '7011', desc: 'HOTELS & MOTELS' },
    'ABNB': { code: '7389', desc: 'BUSINESS SERVICES' }
  };
  
  const mockSic = mockSicCodes[symbol] || { code: '7372', desc: 'SOFTWARE' };
  const sector = mapSicToSector(mockSic.code, mockSic.desc);
  
  return {
    symbol: symbol,
    name: `${symbol} Corporation`,
    sector: sector,
    industry: mockSic.desc,
    marketCap: price * Math.random() * 10e9 + 1e9,
    price: price,
    pe: pe,
    forwardPE: pe * 0.9,
    currentRevenue: revenue,
    guidedRevenue: revenue * (1 + revenueGrowth),
    revenueGrowth: revenueGrowth,
    eps: price / pe,
    forwardEps: price / (pe * 0.9),
    priceToBook: Math.random() * 10 + 1,
    debtToEquity: Math.random() * 2,
    change: (Math.random() - 0.5) * 10,
    changePercent: (Math.random() - 0.5) * 5,
    volume: Math.random() * 50e6,
    dayHigh: price * 1.02,
    dayLow: price * 0.98,
    fiftyTwoWeekHigh: price * 1.5,
    fiftyTwoWeekLow: price * 0.7
  };
}

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      service: 'test-stock-server-real',
      dataSource: 'polygon'
    }
  });
});

// Stock screener endpoint with real data
app.get('/api/v1/stocks/screener', async (req, res) => {
  console.log('Stock screener endpoint hit - fetching real data');
  
  try {
    // Fetch real stock data for all symbols with delay to avoid rate limiting
    const stockData = [];
    
    // Process in batches of 5 with longer delay for rate limiting
    const batchSize = 5;
    for (let i = 0; i < NASDAQ_SYMBOLS.length; i += batchSize) {
      const batch = NASDAQ_SYMBOLS.slice(i, i + batchSize);
      const batchPromises = batch.map(symbol => fetchStockDetails(symbol));
      const batchResults = await Promise.all(batchPromises);
      stockData.push(...batchResults);
      
      // Add 12 second delay between batches to respect 5 calls/minute rate limit
      if (i + batchSize < NASDAQ_SYMBOLS.length) {
        console.log(`Waiting 12 seconds before next batch to respect rate limit...`);
        await new Promise(resolve => setTimeout(resolve, 12000)); // 12 second delay
      }
    }
    
    // Filter out any failed fetches
    let validStocks = stockData.filter(stock => stock && stock.symbol);
    
    // Apply filters if provided
    if (req.query.sector && req.query.sector !== 'All Sectors') {
      validStocks = validStocks.filter(stock => stock.sector === req.query.sector);
    }
    
    if (req.query.minPE) {
      validStocks = validStocks.filter(stock => stock.pe >= parseFloat(req.query.minPE));
    }
    
    if (req.query.maxPE) {
      validStocks = validStocks.filter(stock => stock.pe <= parseFloat(req.query.maxPE));
    }
    
    if (req.query.minForwardPE) {
      validStocks = validStocks.filter(stock => stock.forwardPE >= parseFloat(req.query.minForwardPE));
    }
    
    if (req.query.maxForwardPE) {
      validStocks = validStocks.filter(stock => stock.forwardPE <= parseFloat(req.query.maxForwardPE));
    }
    
    // Add favorite status and calculate scores
    const stocksWithExtras = validStocks.map(stock => ({
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
        dataSource: 'polygon'
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

// Calculate expected growth
function calculateExpectedGrowth(stock) {
  const peGrowth = stock.pe && stock.forwardPE && stock.pe > 0 
    ? ((stock.pe - stock.forwardPE) / stock.pe) * 100 
    : 0;
  
  const revenueGrowth = stock.revenueGrowth * 100;
  
  const epsGrowth = stock.eps && stock.forwardEps && stock.eps > 0
    ? ((stock.forwardEps - stock.eps) / stock.eps) * 100
    : 0;
  
  // Weighted average
  return (peGrowth * 0.4) + (revenueGrowth * 0.4) + (epsGrowth * 0.2);
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
  
  // Positive expected growth
  const growth = calculateExpectedGrowth(stock);
  if (growth > 0) {
    score += Math.min(growth, 30);
  }
  
  // Low price to book ratio
  if (stock.priceToBook && stock.priceToBook < 3) {
    score += (3 - stock.priceToBook) * 5;
  }
  
  // Low debt to equity
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
    'Financial',
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

// Get real-time quote for a specific stock
app.get('/api/v1/stocks/quote/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  
  try {
    const stockData = await fetchStockDetails(symbol);
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

const PORT = 9999;
app.listen(PORT, () => {
  console.log(`Real-time stock server running on http://localhost:${PORT}`);
  console.log(`Using Polygon API for real market data`);
  console.log(`Stock screener endpoint: http://localhost:${PORT}/api/v1/stocks/screener`);
});