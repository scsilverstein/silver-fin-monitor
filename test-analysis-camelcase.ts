#!/usr/bin/env npx tsx

// Test script to verify analysis endpoints return camelCase fields

async function testAnalysisEndpoints() {
  const baseUrl = 'http://localhost:3001/api';
  
  // First, let's login to get a token
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'demo@example.com',
      password: 'demo123'
    })
  });
  
  if (!loginResponse.ok) {
    console.error('Login failed:', await loginResponse.text());
    return;
  }
  
  const { data: authData } = await loginResponse.json();
  const token = authData.token;
  
  console.log('✅ Logged in successfully');
  
  // Test 1: Get latest analysis
  console.log('\n📋 Testing /api/analysis/latest...');
  const latestResponse = await fetch(`${baseUrl}/analysis/latest`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (latestResponse.ok) {
    const { data } = await latestResponse.json();
    console.log('Response fields:', Object.keys(data || {}));
    
    if (data) {
      // Check for camelCase fields
      const expectedCamelCase = ['analysisDate', 'marketSentiment', 'keyThemes', 'overallSummary', 'aiAnalysis', 'confidenceScore', 'sourcesAnalyzed', 'createdAt'];
      const unexpectedSnakeCase = ['analysis_date', 'market_sentiment', 'key_themes', 'overall_summary', 'ai_analysis', 'confidence_score', 'sources_analyzed', 'created_at'];
      
      const hasCamelCase = expectedCamelCase.filter(field => field in data);
      const hasSnakeCase = unexpectedSnakeCase.filter(field => field in data);
      
      console.log('✅ CamelCase fields found:', hasCamelCase);
      console.log('❌ Snake_case fields found:', hasSnakeCase);
      
      if (hasSnakeCase.length > 0) {
        console.error('⚠️  WARNING: Found snake_case fields that should be camelCase!');
      }
      
      if (data.analysisDate) {
        console.log('✅ analysisDate field is present:', data.analysisDate);
      } else {
        console.error('❌ analysisDate field is missing!');
      }
    } else {
      console.log('ℹ️  No analysis data available');
    }
  } else {
    console.error('❌ Failed to get latest analysis:', await latestResponse.text());
  }
  
  // Test 2: Get all analyses
  console.log('\n📋 Testing /api/analysis (list)...');
  const listResponse = await fetch(`${baseUrl}/analysis?limit=5`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (listResponse.ok) {
    const { data } = await listResponse.json();
    console.log(`Found ${data?.length || 0} analyses`);
    
    if (data && data.length > 0) {
      const firstAnalysis = data[0];
      console.log('First analysis fields:', Object.keys(firstAnalysis));
      
      if (firstAnalysis.analysisDate) {
        console.log('✅ analysisDate field is present:', firstAnalysis.analysisDate);
      } else {
        console.error('❌ analysisDate field is missing!');
      }
    }
  } else {
    console.error('❌ Failed to get analyses list:', await listResponse.text());
  }
  
  // Test 3: Get dashboard overview
  console.log('\n📋 Testing /api/dashboard/overview...');
  const dashboardResponse = await fetch(`${baseUrl}/dashboard/overview`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (dashboardResponse.ok) {
    const { data } = await dashboardResponse.json();
    
    if (data?.latestAnalysis) {
      console.log('Latest analysis fields:', Object.keys(data.latestAnalysis));
      
      if (data.latestAnalysis.analysisDate) {
        console.log('✅ analysisDate field is present:', data.latestAnalysis.analysisDate);
      } else {
        console.error('❌ analysisDate field is missing!');
      }
    } else {
      console.log('ℹ️  No latest analysis in dashboard');
    }
  } else {
    console.error('❌ Failed to get dashboard overview:', await dashboardResponse.text());
  }
  
  // Test 4: Get trends
  console.log('\n📋 Testing /api/dashboard/trends...');
  const trendsResponse = await fetch(`${baseUrl}/dashboard/trends?days=7`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (trendsResponse.ok) {
    const { data } = await trendsResponse.json();
    
    if (data?.dailyAnalyses && data.dailyAnalyses.length > 0) {
      const firstAnalysis = data.dailyAnalyses[0];
      console.log('First daily analysis fields:', Object.keys(firstAnalysis));
      
      if (firstAnalysis.analysisDate) {
        console.log('✅ analysisDate field is present:', firstAnalysis.analysisDate);
      } else {
        console.error('❌ analysisDate field is missing!');
      }
    } else {
      console.log('ℹ️  No daily analyses in trends');
    }
  } else {
    console.error('❌ Failed to get trends:', await trendsResponse.text());
  }
  
  console.log('\n✅ Test completed!');
}

// Run the test
testAnalysisEndpoints().catch(console.error);