const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Mock analysis data
const mockAnalysisData = [
  {
    id: '1',
    analysis_date: '2024-01-15',
    market_sentiment: 'bullish',
    key_themes: ['Tech earnings', 'Fed policy', 'Inflation concerns'],
    overall_summary: 'Markets showed strong bullish sentiment today as tech earnings exceeded expectations. The Federal Reserve indicated a possible pause in rate hikes, boosting investor confidence. However, inflation concerns remain elevated with CPI data showing persistent price pressures.',
    confidence_score: 0.85,
    sources_analyzed: 45,
    ai_analysis: {
      market_drivers: ['Strong tech earnings', 'Fed dovish stance'],
      risk_factors: ['Inflation persistence', 'Geopolitical tensions']
    }
  },
  {
    id: '2',
    analysis_date: '2024-01-14',
    market_sentiment: 'neutral',
    key_themes: ['Mixed signals', 'Energy sector', 'China reopening'],
    overall_summary: 'Markets traded sideways yesterday with mixed signals from various sectors. Energy stocks rose on higher oil prices while consumer discretionary fell. China reopening continues to provide support but concerns about global growth persist.',
    confidence_score: 0.72,
    sources_analyzed: 38,
    ai_analysis: {
      market_drivers: ['China reopening', 'Energy sector strength'],
      risk_factors: ['Global growth concerns', 'Consumer spending']
    }
  },
  {
    id: '3',
    analysis_date: '2024-01-13',
    market_sentiment: 'bearish',
    key_themes: ['Recession fears', 'Banking stress', 'Dollar strength'],
    overall_summary: 'Markets fell sharply last week as recession fears intensified. Banking sector showed increased stress with regional banks under pressure. The dollar gained strength against major currencies, adding pressure to emerging markets.',
    confidence_score: 0.78,
    sources_analyzed: 52,
    ai_analysis: {
      market_drivers: ['Recession fears', 'Banking sector concerns'],
      risk_factors: ['Credit conditions', 'Dollar strength']
    }
  },
  {
    id: '4',
    analysis_date: '2024-01-12',
    market_sentiment: 'bullish',
    key_themes: ['AI boom', 'Jobs data', 'Earnings season'],
    overall_summary: 'Technology stocks surged this month on AI optimism. Strong jobs data increased confidence in economic resilience. Q4 earnings season kicked off with banks reporting better than expected results.',
    confidence_score: 0.82,
    sources_analyzed: 41,
    ai_analysis: {
      market_drivers: ['AI technology boom', 'Strong employment'],
      risk_factors: ['Valuation concerns', 'Rate uncertainty']
    }
  },
  {
    id: '5',
    analysis_date: '2024-01-11',
    market_sentiment: 'neutral',
    key_themes: ['Bond yields', 'Commodity prices', 'European outlook'],
    overall_summary: 'Bond yields stabilized after recent volatility. Commodity prices showed mixed trends with gold rising and oil declining. European economic outlook improved with better than expected PMI data.',
    confidence_score: 0.69,
    sources_analyzed: 35,
    ai_analysis: {
      market_drivers: ['Yield stabilization', 'European recovery'],
      risk_factors: ['Commodity volatility', 'Policy divergence']
    }
  }
];

// API endpoints
app.get('/api/v1/analysis', (req, res) => {
  const { startDate, endDate, limit } = req.query;
  
  // Filter by date range if provided
  let filteredData = mockAnalysisData;
  
  if (startDate && endDate) {
    filteredData = mockAnalysisData.filter(item => {
      return item.analysis_date >= startDate && item.analysis_date <= endDate;
    });
  }
  
  // Apply limit
  if (limit) {
    filteredData = filteredData.slice(0, parseInt(limit));
  }
  
  res.json({
    success: true,
    data: filteredData
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test API server running on port ${PORT}`);
});