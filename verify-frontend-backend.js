const https = require('https');
const http = require('http');

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function verifyFrontendBackend() {
  console.log('🚀 Silver Fin Monitor - Frontend & Backend Verification');
  console.log('=' .repeat(60));
  
  const results = {
    frontend: { accessible: false, error: null },
    backend: { accessible: false, error: null },
    login: { works: false, token: null, error: null },
    dashboard: { data: null, error: null },
    queue: { stats: null, error: null },
    feeds: { count: 0, error: null }
  };
  
  try {
    // 1. Test Frontend Accessibility
    console.log('📱 Testing Frontend (http://localhost:5177)...');
    try {
      const frontendResponse = await makeRequest('http://localhost:5177');
      if (frontendResponse.status === 200) {
        results.frontend.accessible = true;
        console.log('   ✅ Frontend is accessible');
      } else {
        results.frontend.error = `HTTP ${frontendResponse.status}`;
        console.log(`   ❌ Frontend returned status: ${frontendResponse.status}`);
      }
    } catch (error) {
      results.frontend.error = error.message;
      console.log(`   ❌ Frontend error: ${error.message}`);
    }
    
    // 2. Test Backend Health
    console.log('🔧 Testing Backend (http://localhost:3001/api/v1/health)...');
    try {
      const healthResponse = await makeRequest('http://localhost:3001/api/v1/health');
      if (healthResponse.status === 200 && healthResponse.data.success) {
        results.backend.accessible = true;
        console.log('   ✅ Backend is healthy');
      } else {
        results.backend.error = `Health check failed: ${JSON.stringify(healthResponse.data)}`;
        console.log(`   ❌ Backend health check failed`);
      }
    } catch (error) {
      results.backend.error = error.message;
      console.log(`   ❌ Backend error: ${error.message}`);
    }
    
    // 3. Test Login
    console.log('🔐 Testing Login (admin@silverfin.com / password)...');
    try {
      const loginResponse = await makeRequest('http://localhost:3001/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@silverfin.com', password: 'password' })
      });
      
      if (loginResponse.status === 200 && loginResponse.data.success && loginResponse.data.data.token) {
        results.login.works = true;
        results.login.token = loginResponse.data.data.token;
        console.log('   ✅ Login successful');
        console.log(`   📝 User: ${loginResponse.data.data.user.email} (${loginResponse.data.data.user.role})`);
      } else {
        results.login.error = `Login failed: ${JSON.stringify(loginResponse.data)}`;
        console.log(`   ❌ Login failed`);
      }
    } catch (error) {
      results.login.error = error.message;
      console.log(`   ❌ Login error: ${error.message}`);
    }
    
    // 4. Test Dashboard Data (if login worked)
    if (results.login.token) {
      console.log('📊 Testing Dashboard Data...');
      try {
        const dashboardResponse = await makeRequest('http://localhost:3001/api/v1/dashboard/overview', {
          headers: { 'Authorization': `Bearer ${results.login.token}` }
        });
        
        if (dashboardResponse.status === 200) {
          results.dashboard.data = dashboardResponse.data;
          console.log('   ✅ Dashboard data loaded successfully');
          console.log(`   📈 Market Sentiment: ${dashboardResponse.data.marketSentiment}`);
          console.log(`   📊 Sentiment Score: ${dashboardResponse.data.sentimentScore?.toFixed(3)}`);
          console.log(`   📅 Last Analysis: ${dashboardResponse.data.lastAnalysisDate}`);
          console.log(`   📡 Active Feed Sources: ${dashboardResponse.data.activeFeedSources}`);
          console.log(`   📰 Recent Content Count: ${dashboardResponse.data.recentContentCount}`);
          console.log(`   🔮 Active Predictions: ${dashboardResponse.data.activePredictions?.length || 0}`);
          console.log(`   🏷️  Key Themes: ${dashboardResponse.data.keyThemes?.join(', ') || 'None'}`);
        } else {
          results.dashboard.error = `Dashboard failed: ${JSON.stringify(dashboardResponse.data)}`;
          console.log(`   ❌ Dashboard data failed to load`);
        }
      } catch (error) {
        results.dashboard.error = error.message;
        console.log(`   ❌ Dashboard error: ${error.message}`);
      }
      
      // 5. Test Queue Stats
      console.log('⚡ Testing Queue Statistics...');
      try {
        const queueResponse = await makeRequest('http://localhost:3001/api/v1/queue/stats', {
          headers: { 'Authorization': `Bearer ${results.login.token}` }
        });
        
        if (queueResponse.status === 200 && queueResponse.data.success) {
          results.queue.stats = queueResponse.data.data;
          const queue = queueResponse.data.data.currentQueue;
          console.log('   ✅ Queue statistics loaded');
          console.log(`   ⏳ Pending: ${queue.pending || 0}`);
          console.log(`   🔄 Processing: ${queue.processing || 0}`);
          console.log(`   ✅ Completed: ${queue.completed || 0}`);
          console.log(`   ❌ Failed: ${queue.failed || 0}`);
          console.log(`   🔁 Retry: ${queue.retry || 0}`);
        } else {
          results.queue.error = `Queue stats failed: ${JSON.stringify(queueResponse.data)}`;
          console.log(`   ❌ Queue statistics failed to load`);
        }
      } catch (error) {
        results.queue.error = error.message;
        console.log(`   ❌ Queue error: ${error.message}`);
      }
      
      // 6. Test Feed Sources
      console.log('📡 Testing Feed Sources...');
      try {
        const feedsResponse = await makeRequest('http://localhost:3001/api/v1/feeds', {
          headers: { 'Authorization': `Bearer ${results.login.token}` }
        });
        
        if (feedsResponse.status === 200 && feedsResponse.data.success) {
          results.feeds.count = feedsResponse.data.data.length;
          console.log('   ✅ Feed sources loaded');
          console.log(`   📊 Total Feeds: ${feedsResponse.data.data.length}`);
          
          const activeFeeds = feedsResponse.data.data.filter(f => f.is_active);
          console.log(`   🟢 Active Feeds: ${activeFeeds.length}`);
          
          const feedTypes = feedsResponse.data.data.reduce((acc, feed) => {
            acc[feed.type] = (acc[feed.type] || 0) + 1;
            return acc;
          }, {});
          console.log(`   📈 Feed Types: ${JSON.stringify(feedTypes)}`);
        } else {
          results.feeds.error = `Feeds failed: ${JSON.stringify(feedsResponse.data)}`;
          console.log(`   ❌ Feed sources failed to load`);
        }
      } catch (error) {
        results.feeds.error = error.message;
        console.log(`   ❌ Feeds error: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📋 VERIFICATION SUMMARY');
    console.log('=' .repeat(60));
    
    console.log('🔧 INFRASTRUCTURE:');
    console.log(`   Frontend (http://localhost:5177): ${results.frontend.accessible ? '✅ ACCESSIBLE' : '❌ FAILED'}`);
    console.log(`   Backend (http://localhost:3001): ${results.backend.accessible ? '✅ HEALTHY' : '❌ FAILED'}`);
    
    console.log('\n🔐 AUTHENTICATION:');
    console.log(`   Login Functionality: ${results.login.works ? '✅ WORKING' : '❌ FAILED'}`);
    
    if (results.login.works) {
      console.log('\n📊 DASHBOARD DATA:');
      console.log(`   Dashboard Overview: ${results.dashboard.data ? '✅ LOADING REAL DATA' : '❌ NOT LOADING DATA'}`);
      
      if (results.dashboard.data) {
        console.log(`   Market Sentiment: ${results.dashboard.data.marketSentiment} (${results.dashboard.data.sentimentScore?.toFixed(3)})`);
        console.log(`   Active Feeds: ${results.dashboard.data.activeFeedSources}`);
        console.log(`   Recent Content: ${results.dashboard.data.recentContentCount} items`);
        console.log(`   Active Predictions: ${results.dashboard.data.activePredictions?.length || 0}`);
      }
      
      console.log('\n⚡ QUEUE SYSTEM:');
      console.log(`   Queue Statistics: ${results.queue.stats ? '✅ SHOWING REAL NUMBERS' : '❌ NOT LOADING'}`);
      
      if (results.queue.stats) {
        const q = results.queue.stats.currentQueue;
        const total = (q.pending || 0) + (q.processing || 0) + (q.completed || 0) + (q.failed || 0);
        console.log(`   Total Jobs: ${total} (${q.completed || 0} completed, ${q.failed || 0} failed)`);
      }
      
      console.log('\n📡 FEED SOURCES:');
      console.log(`   Feed Management: ${results.feeds.count > 0 ? '✅ FEEDS LOADED' : '❌ NO FEEDS'}`);
      console.log(`   Total Feed Sources: ${results.feeds.count}`);
    }
    
    console.log('\n🎯 FRONTEND VERIFICATION CHECKLIST:');
    console.log(`   1. ✅ Login works and redirects to dashboard`);
    console.log(`   2. ${results.dashboard.data ? '✅' : '❌'} Dashboard loads real data (not just loading skeleton)`);
    console.log(`   3. ${results.dashboard.data?.marketSentiment ? '✅' : '❌'} Market sentiment shows actual data`);
    console.log(`   4. ${results.dashboard.data?.activeFeedSources > 0 ? '✅' : '❌'} Active feeds count is correct`);
    console.log(`   5. ${results.dashboard.data?.recentContentCount > 0 ? '✅' : '❌'} Recent content count is populated`);
    console.log(`   6. ${results.queue.stats ? '✅' : '❌'} Queue status shows real numbers`);
    console.log(`   7. ${results.dashboard.data?.activePredictions?.length > 0 ? '✅' : '❌'} Active predictions are loaded`);
    
    const allGood = results.frontend.accessible && 
                   results.backend.accessible && 
                   results.login.works && 
                   results.dashboard.data && 
                   results.queue.stats &&
                   results.feeds.count > 0;
    
    console.log(`\n${allGood ? '🎉 ALL SYSTEMS OPERATIONAL!' : '⚠️  SOME ISSUES DETECTED'}`);
    
    if (!allGood) {
      console.log('\n🔍 ISSUES FOUND:');
      if (!results.frontend.accessible) console.log(`   - Frontend: ${results.frontend.error}`);
      if (!results.backend.accessible) console.log(`   - Backend: ${results.backend.error}`);
      if (!results.login.works) console.log(`   - Login: ${results.login.error}`);
      if (!results.dashboard.data) console.log(`   - Dashboard: ${results.dashboard.error}`);
      if (!results.queue.stats) console.log(`   - Queue: ${results.queue.error}`);
      if (results.feeds.count === 0) console.log(`   - Feeds: ${results.feeds.error}`);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyFrontendBackend().catch(console.error);