const { timeframeAnalysisService } = require('./dist/services/ai/simple-timeframe-analysis.js');

async function testTimeframeAnalysis() {
  try {
    console.log('Testing timeframe analysis service...');

    // Test 1: Calculate timeframe bounds
    console.log('\n1. Testing timeframe bounds calculation...');
    const weeklyBounds = timeframeAnalysisService.calculateTimeframeBounds('weekly', new Date('2025-01-20'));
    console.log('Weekly bounds:', {
      start: weeklyBounds.start.toDateString(),
      end: weeklyBounds.end.toDateString(),
      period: weeklyBounds.period
    });

    const monthlyBounds = timeframeAnalysisService.calculateTimeframeBounds('monthly', new Date('2025-01-20'));
    console.log('Monthly bounds:', {
      start: monthlyBounds.start.toDateString(),
      end: monthlyBounds.end.toDateString(),
      period: monthlyBounds.period
    });

    // Test 2: Get content for timeframe (this will test the database connection)
    console.log('\n2. Testing content retrieval...');
    try {
      const content = await timeframeAnalysisService.getContentForTimeframe(weeklyBounds);
      console.log(`Found ${content.length} content items for the week`);
    } catch (error) {
      console.log('Content retrieval failed (expected if no data):', error.message);
    }

    console.log('\nTimeframe analysis service test completed!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testTimeframeAnalysis();