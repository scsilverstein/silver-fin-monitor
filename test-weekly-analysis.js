require('dotenv').config();

async function testWeeklyAnalysis() {
  try {
    console.log('Testing weekly analysis generation...');
    
    // Import the service after environment is loaded
    const { timeframeAnalysisService } = await import('./dist/services/ai/simple-timeframe-analysis.js');
    
    console.log('1. Testing timeframe bounds calculation...');
    const bounds = timeframeAnalysisService.calculateTimeframeBounds('weekly', new Date());
    console.log('Weekly bounds:', {
      start: bounds.start.toDateString(),
      end: bounds.end.toDateString(),
      period: bounds.period,
      type: bounds.type
    });
    
    console.log('\n2. Testing content retrieval...');
    const content = await timeframeAnalysisService.getContentForTimeframe(bounds);
    console.log(`Found ${content.length} content items for analysis`);
    
    if (content.length > 0) {
      console.log('Sample content:', {
        id: content[0].id,
        source: content[0].source_name,
        sentiment: content[0].sentiment_score,
        topics: content[0].key_topics?.slice(0, 3)
      });
      
      console.log('\n3. Testing AI analysis generation...');
      const aiAnalysis = await timeframeAnalysisService.generateAIAnalysis(content.slice(0, 5), bounds);
      console.log('AI Analysis sample:', {
        marketDrivers: aiAnalysis.marketDrivers?.slice(0, 2),
        sentiment_direction: aiAnalysis.trendAnalysis?.direction
      });
      
      console.log('\n4. Testing full analysis generation...');
      const analysis = await timeframeAnalysisService.generateCompleteTimeframeAnalysis('weekly');
      console.log('Generated analysis:', {
        id: analysis.id,
        type: analysis.timeframe_type,
        sentiment: analysis.market_sentiment,
        themes_count: analysis.key_themes?.length,
        sources: analysis.sources_analyzed
      });
      
      console.log('\n✅ Weekly analysis test completed successfully!');
    } else {
      console.log('❌ No content available for analysis');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

testWeeklyAnalysis();