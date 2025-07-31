const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Mock stock data - expanded list
const mockStocks = [
  // Technology
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    marketCap: 3000000000000,
    price: 238.26,
    pe: 32.5,
    forwardPE: 29.25,
    currentRevenue: 394328000000,
    guidedRevenue: 410101120000,
    revenueGrowth: 0.04,
    eps: 6.01,
    forwardEps: 6.611,
    priceToBook: 47.2,
    debtToEquity: 1.95
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    sector: 'Technology',
    industry: 'Software',
    marketCap: 3100000000000,
    price: 411.22,
    pe: 35.8,
    forwardPE: 32.22,
    currentRevenue: 245122000000,
    guidedRevenue: 257128100000,
    revenueGrowth: 0.049,
    eps: 11.49,
    forwardEps: 12.639,
    priceToBook: 14.8,
    debtToEquity: 0.69
  },
  {
    symbol: 'INTC',
    name: 'Intel Corporation',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 80000000000,
    price: 19.05,
    pe: 12.2,
    forwardPE: 10.98,
    currentRevenue: 79024000000,
    guidedRevenue: 85000000000,
    revenueGrowth: 0.076,
    eps: 1.56,
    forwardEps: 1.716,
    priceToBook: 1.1,
    debtToEquity: 0.82
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 2800000000000,
    price: 115.04,
    pe: 65.2,
    forwardPE: 45.5,
    currentRevenue: 126000000000,
    guidedRevenue: 153720000000,
    revenueGrowth: 0.22,
    eps: 14.2,
    forwardEps: 17.04,
    priceToBook: 58.1,
    debtToEquity: 0.41
  },
  {
    symbol: 'CSCO',
    name: 'Cisco Systems Inc.',
    sector: 'Technology',
    industry: 'Networking Equipment',
    marketCap: 196000000000,
    price: 48.92,
    pe: 14.3,
    forwardPE: 12.87,
    currentRevenue: 57000000000,
    guidedRevenue: 60420000000,
    revenueGrowth: 0.06,
    eps: 3.42,
    forwardEps: 3.762,
    priceToBook: 3.2,
    debtToEquity: 0.45
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    sector: 'Technology',
    industry: 'Internet Services',
    marketCap: 2100000000000,
    price: 141.80,
    pe: 26.4,
    forwardPE: 23.76,
    currentRevenue: 307394000000,
    guidedRevenue: 322563700000,
    revenueGrowth: 0.05,
    eps: 5.37,
    forwardEps: 5.907,
    priceToBook: 6.5,
    debtToEquity: 0.11
  },
  {
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    sector: 'Technology',
    industry: 'Social Media',
    marketCap: 1250000000000,
    price: 488.54,
    pe: 27.1,
    forwardPE: 24.39,
    currentRevenue: 134902000000,
    guidedRevenue: 156486320000,
    revenueGrowth: 0.16,
    eps: 11.56,
    forwardEps: 12.716,
    priceToBook: 8.9,
    debtToEquity: 0.37
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    sector: 'Consumer Discretionary',
    industry: 'E-Commerce',
    marketCap: 1850000000000,
    price: 178.22,
    pe: 50.3,
    forwardPE: 35.21,
    currentRevenue: 574785000000,
    guidedRevenue: 609272100000,
    revenueGrowth: 0.06,
    eps: 8.53,
    forwardEps: 10.236,
    priceToBook: 8.3,
    debtToEquity: 0.82
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    sector: 'Consumer Discretionary',
    industry: 'Electric Vehicles',
    marketCap: 790000000000,
    price: 248.50,
    pe: 71.9,
    forwardPE: 50.33,
    currentRevenue: 96773000000,
    guidedRevenue: 115159870000,
    revenueGrowth: 0.19,
    eps: 5.53,
    forwardEps: 7.195,
    priceToBook: 15.3,
    debtToEquity: 0.28
  },
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 235000000000,
    price: 145.25,
    pe: 45.8,
    forwardPE: 32.06,
    currentRevenue: 24000000000,
    guidedRevenue: 29760000000,
    revenueGrowth: 0.24,
    eps: 3.17,
    forwardEps: 4.119,
    priceToBook: 4.2,
    debtToEquity: 0.04
  },
  {
    symbol: 'ORCL',
    name: 'Oracle Corporation',
    sector: 'Technology',
    industry: 'Software',
    marketCap: 380000000000,
    price: 138.50,
    pe: 22.7,
    forwardPE: 19.495,
    currentRevenue: 50000000000,
    guidedRevenue: 54000000000,
    revenueGrowth: 0.08,
    eps: 6.10,
    forwardEps: 7.015,
    priceToBook: 21.3,
    debtToEquity: 8.47
  },
  {
    symbol: 'CRM',
    name: 'Salesforce Inc.',
    sector: 'Technology',
    industry: 'Software',
    marketCap: 260000000000,
    price: 269.13,
    pe: 48.5,
    forwardPE: 35.58,
    currentRevenue: 34857000000,
    guidedRevenue: 38342700000,
    revenueGrowth: 0.10,
    eps: 5.55,
    forwardEps: 6.66,
    priceToBook: 3.8,
    debtToEquity: 0.19
  },
  // Healthcare
  {
    symbol: 'JNJ',
    name: 'Johnson & Johnson',
    sector: 'Healthcare',
    industry: 'Pharmaceuticals',
    marketCap: 390000000000,
    price: 152.45,
    pe: 24.8,
    forwardPE: 22.32,
    currentRevenue: 100000000000,
    guidedRevenue: 105000000000,
    revenueGrowth: 0.05,
    eps: 6.15,
    forwardEps: 6.765,
    priceToBook: 5.9,
    debtToEquity: 0.62
  },
  {
    symbol: 'PFE',
    name: 'Pfizer Inc.',
    sector: 'Healthcare',
    industry: 'Pharmaceuticals',
    marketCap: 165000000000,
    price: 29.20,
    pe: 18.5,
    forwardPE: 14.8,
    currentRevenue: 100330000000,
    guidedRevenue: 95313500000,
    revenueGrowth: -0.05,
    eps: 1.58,
    forwardEps: 1.896,
    priceToBook: 1.8,
    debtToEquity: 0.67
  },
  {
    symbol: 'UNH',
    name: 'UnitedHealth Group',
    sector: 'Healthcare',
    industry: 'Health Insurance',
    marketCap: 495000000000,
    price: 535.70,
    pe: 27.2,
    forwardPE: 24.48,
    currentRevenue: 371622000000,
    guidedRevenue: 397735540000,
    revenueGrowth: 0.07,
    eps: 19.70,
    forwardEps: 21.67,
    priceToBook: 6.3,
    debtToEquity: 0.74
  },
  // Financial
  {
    symbol: 'JPM',
    name: 'JPMorgan Chase & Co.',
    sector: 'Financial',
    industry: 'Banking',
    marketCap: 550000000000,
    price: 188.65,
    pe: 11.5,
    forwardPE: 10.35,
    currentRevenue: 158000000000,
    guidedRevenue: 165900000000,
    revenueGrowth: 0.05,
    eps: 16.40,
    forwardEps: 18.04,
    priceToBook: 1.8,
    debtToEquity: 2.5
  },
  {
    symbol: 'BAC',
    name: 'Bank of America',
    sector: 'Financial',
    industry: 'Banking',
    marketCap: 280000000000,
    price: 35.80,
    pe: 12.3,
    forwardPE: 10.455,
    currentRevenue: 98000000000,
    guidedRevenue: 102900000000,
    revenueGrowth: 0.05,
    eps: 2.91,
    forwardEps: 3.201,
    priceToBook: 1.2,
    debtToEquity: 2.8
  },
  {
    symbol: 'V',
    name: 'Visa Inc.',
    sector: 'Financial',
    industry: 'Payment Processing',
    marketCap: 520000000000,
    price: 252.45,
    pe: 30.5,
    forwardPE: 27.45,
    currentRevenue: 32653000000,
    guidedRevenue: 35591770000,
    revenueGrowth: 0.09,
    eps: 8.28,
    forwardEps: 9.108,
    priceToBook: 13.5,
    debtToEquity: 0.62
  },
  // Consumer
  {
    symbol: 'WMT',
    name: 'Walmart Inc.',
    sector: 'Consumer Staples',
    industry: 'Retail',
    marketCap: 450000000000,
    price: 165.85,
    pe: 28.7,
    forwardPE: 25.83,
    currentRevenue: 648125000000,
    guidedRevenue: 680531250000,
    revenueGrowth: 0.05,
    eps: 5.78,
    forwardEps: 6.358,
    priceToBook: 6.8,
    debtToEquity: 0.58
  },
  {
    symbol: 'PG',
    name: 'Procter & Gamble',
    sector: 'Consumer Staples',
    industry: 'Household Products',
    marketCap: 380000000000,
    price: 161.25,
    pe: 26.8,
    forwardPE: 24.12,
    currentRevenue: 84039000000,
    guidedRevenue: 87400560000,
    revenueGrowth: 0.04,
    eps: 6.02,
    forwardEps: 6.622,
    priceToBook: 8.2,
    debtToEquity: 0.61
  },
  {
    symbol: 'KO',
    name: 'Coca-Cola Company',
    sector: 'Consumer Staples',
    industry: 'Beverages',
    marketCap: 270000000000,
    price: 62.35,
    pe: 25.9,
    forwardPE: 23.31,
    currentRevenue: 45754000000,
    guidedRevenue: 48041700000,
    revenueGrowth: 0.05,
    eps: 2.41,
    forwardEps: 2.651,
    priceToBook: 11.2,
    debtToEquity: 1.73
  },
  {
    symbol: 'NKE',
    name: 'Nike Inc.',
    sector: 'Consumer Discretionary',
    industry: 'Apparel',
    marketCap: 125000000000,
    price: 81.50,
    pe: 22.4,
    forwardPE: 20.16,
    currentRevenue: 51217000000,
    guidedRevenue: 53777850000,
    revenueGrowth: 0.05,
    eps: 3.64,
    forwardEps: 4.004,
    priceToBook: 12.5,
    debtToEquity: 0.74
  },
  // Energy
  {
    symbol: 'XOM',
    name: 'Exxon Mobil',
    sector: 'Energy',
    industry: 'Oil & Gas',
    marketCap: 450000000000,
    price: 108.75,
    pe: 11.2,
    forwardPE: 10.08,
    currentRevenue: 413680000000,
    guidedRevenue: 392996000000,
    revenueGrowth: -0.05,
    eps: 9.71,
    forwardEps: 10.681,
    priceToBook: 2.1,
    debtToEquity: 0.21
  },
  {
    symbol: 'CVX',
    name: 'Chevron Corporation',
    sector: 'Energy',
    industry: 'Oil & Gas',
    marketCap: 280000000000,
    price: 147.30,
    pe: 13.8,
    forwardPE: 12.42,
    currentRevenue: 200949000000,
    guidedRevenue: 190901550000,
    revenueGrowth: -0.05,
    eps: 10.68,
    forwardEps: 11.748,
    priceToBook: 1.7,
    debtToEquity: 0.15
  },
  // Additional Tech
  {
    symbol: 'ADBE',
    name: 'Adobe Inc.',
    sector: 'Technology',
    industry: 'Software',
    marketCap: 255000000000,
    price: 565.51,
    pe: 42.3,
    forwardPE: 35.525,
    currentRevenue: 19409000000,
    guidedRevenue: 21544190000,
    revenueGrowth: 0.11,
    eps: 13.37,
    forwardEps: 15.389,
    priceToBook: 16.8,
    debtToEquity: 0.41
  },
  {
    symbol: 'NFLX',
    name: 'Netflix Inc.',
    sector: 'Communication Services',
    industry: 'Streaming',
    marketCap: 215000000000,
    price: 483.35,
    pe: 38.5,
    forwardPE: 30.8,
    currentRevenue: 33723000000,
    guidedRevenue: 37764960000,
    revenueGrowth: 0.12,
    eps: 12.55,
    forwardEps: 15.060,
    priceToBook: 12.4,
    debtToEquity: 0.75
  },
  {
    symbol: 'QCOM',
    name: 'QUALCOMM Inc.',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 175000000000,
    price: 157.45,
    pe: 19.5,
    forwardPE: 16.575,
    currentRevenue: 38621000000,
    guidedRevenue: 42483100000,
    revenueGrowth: 0.10,
    eps: 8.08,
    forwardEps: 9.292,
    priceToBook: 6.8,
    debtToEquity: 0.64
  },
  {
    symbol: 'AVGO',
    name: 'Broadcom Inc.',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 680000000000,
    price: 164.25,
    pe: 28.9,
    forwardPE: 23.12,
    currentRevenue: 38858000000,
    guidedRevenue: 44286720000,
    revenueGrowth: 0.14,
    eps: 5.68,
    forwardEps: 6.816,
    priceToBook: 11.3,
    debtToEquity: 1.73
  },
  {
    symbol: 'TXN',
    name: 'Texas Instruments',
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 155000000000,
    price: 168.90,
    pe: 24.3,
    forwardPE: 21.87,
    currentRevenue: 17519000000,
    guidedRevenue: 18370430000,
    revenueGrowth: 0.05,
    eps: 6.95,
    forwardEps: 7.645,
    priceToBook: 10.2,
    debtToEquity: 0.54
  }
];

// In-memory favorites storage (in production, this would be in a database)
let userFavorites = [];

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      service: 'test-stock-server'
    }
  });
});

// Stock screener endpoint
app.get('/api/v1/stocks/screener', (req, res) => {
  console.log('Stock screener endpoint hit');
  
  // Apply filters if provided
  let filteredStocks = [...mockStocks];
  
  if (req.query.sector && req.query.sector !== 'All Sectors') {
    filteredStocks = filteredStocks.filter(stock => stock.sector === req.query.sector);
  }
  
  if (req.query.minPE) {
    filteredStocks = filteredStocks.filter(stock => stock.pe >= parseFloat(req.query.minPE));
  }
  
  if (req.query.maxPE) {
    filteredStocks = filteredStocks.filter(stock => stock.pe <= parseFloat(req.query.maxPE));
  }
  
  // Add favorite status to each stock
  const stocksWithFavorites = filteredStocks.map(stock => ({
    ...stock,
    isFavorite: userFavorites.includes(stock.symbol)
  }));
  
  res.json({
    success: true,
    data: stocksWithFavorites,
    meta: {
      total: stocksWithFavorites.length,
      timestamp: new Date()
    }
  });
});

// Get sectors
app.get('/api/v1/stocks/sectors', (req, res) => {
  const sectors = [...new Set(mockStocks.map(stock => stock.sector))].sort();
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
  console.log(`Test stock server running on http://localhost:${PORT}`);
  console.log(`Stock screener endpoint: http://localhost:${PORT}/api/v1/stocks/screener`);
});