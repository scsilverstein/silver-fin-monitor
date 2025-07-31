const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Mock authentication middleware for testing
app.use((req, res, next) => {
  // Skip auth for testing
  req.user = { id: 'test-user', role: 'user' };
  next();
});

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Generate mock NASDAQ stock data
const generateMockStocks = () => {
  const sectors = ['Technology', 'Healthcare', 'Consumer Discretionary', 'Communication Services', 'Financials'];
  const stocks = [];
  
  // Sample NASDAQ companies
  const companies = [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
    { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Communication Services' },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary' },
    { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services' },
    { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
    { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
    { symbol: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials' },
    { symbol: 'BAC', name: 'Bank of America Corp.', sector: 'Financials' },
    { symbol: 'WFC', name: 'Wells Fargo & Co.', sector: 'Financials' },
    { symbol: 'INTC', name: 'Intel Corporation', sector: 'Technology' },
    { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
    { symbol: 'QCOM', name: 'QUALCOMM Inc.', sector: 'Technology' },
    { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology' },
    { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology' },
  ];

  companies.forEach((company) => {
    const price = Math.random() * 500 + 20;
    const pe = Math.random() * 40 + 5;
    const forwardPE = pe * (0.7 + Math.random() * 0.6); // Forward PE usually lower
    const currentRevenue = Math.random() * 100000000000 + 1000000000; // 1B to 100B
    const guidedRevenue = currentRevenue * (0.95 + Math.random() * 0.15); // -5% to +10%
    const eps = price / pe;
    const forwardEps = price / forwardPE;
    
    stocks.push({
      symbol: company.symbol,
      name: company.name,
      sector: company.sector,
      industry: company.sector + ' Industry',
      marketCap: price * (Math.random() * 1000000000 + 100000000), // 100M to 1B shares
      price: parseFloat(price.toFixed(2)),
      pe: parseFloat(pe.toFixed(2)),
      forwardPE: parseFloat(forwardPE.toFixed(2)),
      currentRevenue: currentRevenue,
      guidedRevenue: guidedRevenue,
      revenueGrowth: ((guidedRevenue - currentRevenue) / currentRevenue),
      eps: parseFloat(eps.toFixed(2)),
      forwardEps: parseFloat(forwardEps.toFixed(2)),
      priceToBook: parseFloat((Math.random() * 5 + 0.5).toFixed(2)),
      debtToEquity: parseFloat((Math.random() * 2).toFixed(2))
    });
  });

  // Add some undervalued stocks
  const undervalued = [
    { symbol: 'CSCO', name: 'Cisco Systems Inc.', sector: 'Technology' },
    { symbol: 'GILD', name: 'Gilead Sciences Inc.', sector: 'Healthcare' },
    { symbol: 'WBA', name: 'Walgreens Boots Alliance', sector: 'Consumer Staples' },
    { symbol: 'T', name: 'AT&T Inc.', sector: 'Communication Services' },
    { symbol: 'VZ', name: 'Verizon Communications', sector: 'Communication Services' },
  ];

  undervalued.forEach((company) => {
    const price = Math.random() * 50 + 10;
    const pe = Math.random() * 15 + 5; // Lower P/E for undervalued
    const forwardPE = pe * (0.6 + Math.random() * 0.3); // Better forward P/E
    const currentRevenue = Math.random() * 50000000000 + 10000000000;
    const guidedRevenue = currentRevenue * (1.05 + Math.random() * 0.1); // Positive growth
    const eps = price / pe;
    const forwardEps = price / forwardPE;
    
    stocks.push({
      symbol: company.symbol,
      name: company.name,
      sector: company.sector,
      industry: company.sector + ' Industry',
      marketCap: price * (Math.random() * 500000000 + 100000000),
      price: parseFloat(price.toFixed(2)),
      pe: parseFloat(pe.toFixed(2)),
      forwardPE: parseFloat(forwardPE.toFixed(2)),
      currentRevenue: currentRevenue,
      guidedRevenue: guidedRevenue,
      revenueGrowth: ((guidedRevenue - currentRevenue) / currentRevenue),
      eps: parseFloat(eps.toFixed(2)),
      forwardEps: parseFloat(forwardEps.toFixed(2)),
      priceToBook: parseFloat((Math.random() * 2 + 0.3).toFixed(2)), // Lower P/B
      debtToEquity: parseFloat((Math.random() * 0.8).toFixed(2)) // Lower debt
    });
  });

  return stocks;
};

// Get mock data
const mockStocks = generateMockStocks();

// API endpoints
app.get('/api/v1/stocks/screener', (req, res) => {
  let filteredStocks = [...mockStocks];
  
  // Apply filters
  if (req.query.sector && req.query.sector !== 'All Sectors') {
    filteredStocks = filteredStocks.filter(stock => stock.sector === req.query.sector);
  }
  
  if (req.query.minPE) {
    filteredStocks = filteredStocks.filter(stock => stock.pe >= parseFloat(req.query.minPE));
  }
  
  if (req.query.maxPE) {
    filteredStocks = filteredStocks.filter(stock => stock.pe <= parseFloat(req.query.maxPE));
  }
  
  if (req.query.minForwardPE) {
    filteredStocks = filteredStocks.filter(stock => stock.forwardPE >= parseFloat(req.query.minForwardPE));
  }
  
  if (req.query.maxForwardPE) {
    filteredStocks = filteredStocks.filter(stock => stock.forwardPE <= parseFloat(req.query.maxForwardPE));
  }
  
  res.json({
    success: true,
    data: filteredStocks,
    meta: {
      total: filteredStocks.length,
      filters: req.query
    }
  });
});

app.get('/api/v1/stocks/sectors', (req, res) => {
  const sectors = [
    'Technology',
    'Healthcare',
    'Consumer Discretionary',
    'Communication Services',
    'Financials',
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

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Stock screener test API running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('- GET /api/v1/stocks/screener');
  console.log('- GET /api/v1/stocks/sectors');
});