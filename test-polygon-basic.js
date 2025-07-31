require('dotenv').config();

async function testBasicAPI() {
  const baseURL = 'http://localhost:3001/api/v1';
  
  try {
    // Test 1: Get sectors
    console.log('1. Fetching sectors...');
    const sectorsResponse = await fetch(`${baseURL}/stocks/sectors`);
    const sectors = await sectorsResponse.json();
    console.log('Sectors:', sectors);
    
    // Test 2: Get stocks without filters
    console.log('\n2. Fetching all stocks...');
    const allStocksResponse = await fetch(`${baseURL}/stocks/screener`);
    const allStocks = await allStocksResponse.json();
    console.log('Total stocks:', allStocks.data?.length || 0);
    if (allStocks.data && allStocks.data.length > 0) {
      console.log('Sample stock:', allStocks.data[0]);
    }
    
    // Test 3: Get technology stocks with P/E filter
    console.log('\n3. Fetching Technology stocks with P/E < 30...');
    const techStocksResponse = await fetch(`${baseURL}/stocks/screener?sector=Technology&maxPE=30`);
    const techStocks = await techStocksResponse.json();
    console.log('Technology stocks with P/E < 30:', techStocks.data?.length || 0);
    if (techStocks.data && techStocks.data.length > 0) {
      techStocks.data.slice(0, 3).forEach(stock => {
        console.log(`- ${stock.symbol}: P/E=${stock.pe.toFixed(2)}, Price=$${stock.price.toFixed(2)}`);
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testBasicAPI();