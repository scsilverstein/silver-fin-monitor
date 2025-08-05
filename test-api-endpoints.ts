#!/usr/bin/env ts-node
// Test API endpoints to verify they're returning real data

import axios from 'axios';

const API_BASE = 'http://localhost:3001/api/v1';

async function testEndpoints() {
  console.log('Testing API endpoints...\n');

  const endpoints = [
    { name: 'Health Check', url: '/health', auth: false },
    { name: 'Dashboard Overview', url: '/dashboard/overview', auth: false },
    { name: 'Dashboard Trends', url: '/dashboard/trends', auth: false },
    { name: 'Dashboard Themes', url: '/dashboard/themes', auth: false },
    { name: 'Entity Analytics Dashboard', url: '/entity-analytics/dashboard', auth: false },
    { name: 'Intelligence Data Diagnostic', url: '/diagnostic/intelligence-data', auth: false },
    { name: 'Insights Dashboard', url: '/insights/dashboard', auth: false },
    { name: 'Feeds List', url: '/feeds', auth: true }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name} (${endpoint.url})...`);
      
      const config: any = {};
      if (endpoint.auth) {
        // For now, skip auth-required endpoints
        console.log(`  ⚠️  Skipping - requires authentication\n`);
        continue;
      }

      const response = await axios.get(`${API_BASE}${endpoint.url}`, config);
      
      if (response.data.success) {
        console.log(`  ✅ Success - Status: ${response.status}`);
        
        // Check if we have real data
        const data = response.data.data;
        if (data) {
          // Log some key information
          if (endpoint.url.includes('overview')) {
            console.log(`     - Latest Analysis: ${data.latestAnalysis ? 'Yes' : 'No'}`);
            console.log(`     - Feed Sources: ${data.feedStats?.total || 0}`);
            console.log(`     - Market Sentiment: ${data.marketSentiment || 'None'}`);
          } else if (endpoint.url.includes('entity-analytics')) {
            console.log(`     - Top Entities: ${data.topEntities?.length || 0}`);
            console.log(`     - Entity Types: ${Object.keys(data.entityTypes || {}).length}`);
          } else if (endpoint.url.includes('intelligence-data')) {
            console.log(`     - Total Content: ${data.summary?.totalContent || 0}`);
            console.log(`     - With Entities: ${data.summary?.withEntities || 0}`);
            console.log(`     - Recent Content: ${data.summary?.recentContent || 0}`);
          }
        }
      } else {
        console.log(`  ❌ Failed - Response indicates failure`);
      }
      console.log();
    } catch (error: any) {
      console.log(`  ❌ Error - ${error.response?.status || 'Network Error'}: ${error.message}`);
      if (error.response?.data?.error) {
        console.log(`     - Server Error: ${error.response.data.error}`);
      }
      console.log();
    }
  }
}

// Run the tests
testEndpoints().catch(console.error);