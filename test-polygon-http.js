require('dotenv').config();

async function testPolygonHttpService() {
  const baseURL = 'http://localhost:3001/api/v1';
  
  console.log('Testing Polygon HTTP Service...');
  
  try {
    // Test connection to our API first
    console.log('1. Testing sectors endpoint...');
    const sectorsResponse = await fetch(`${baseURL}/stocks/sectors`);
    
    if (!sectorsResponse.ok) {
      console.error('Sectors endpoint failed:', sectorsResponse.status);
      return;
    }
    
    const sectors = await sectorsResponse.json();
    console.log('✅ Sectors:', sectors.data);
    
    // Test stock screener endpoint
    console.log('\n2. Testing stock screener endpoint...');
    const screenerResponse = await fetch(`${baseURL}/stocks/screener?limit=10`);
    
    if (!screenerResponse.ok) {
      console.error('Screener endpoint failed:', screenerResponse.status, await screenerResponse.text());
      return;
    }
    
    const screenerData = await screenerResponse.json();
    console.log('✅ Screener data:');
    console.log('- Total stocks:', screenerData.data?.length || 0);
    
    if (screenerData.data && screenerData.data.length > 0) {
      console.log('- Sample stocks:');
      screenerData.data.slice(0, 3).forEach(stock => {
        console.log(`  ${stock.symbol}: ${stock.name} - $${stock.price?.toFixed(2)} (P/E: ${stock.pe?.toFixed(1)})`);
      });
    }
    
    // Test with filters
    console.log('\n3. Testing with Technology filter...');
    const techResponse = await fetch(`${baseURL}/stocks/screener?sector=Technology&maxPE=30`);
    
    if (techResponse.ok) {
      const techData = await techResponse.json();
      console.log('✅ Technology stocks with P/E < 30:', techData.data?.length || 0);
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPolygonHttpService();