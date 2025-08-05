// Integration code to add to netlify/functions/api.ts
// This adds auto-processing triggers to the main API endpoints

// Add this helper function near the top of api.ts (after imports)
const triggerAutoProcessing = async (dataType: 'feeds' | 'earnings' | 'analysis' | 'predictions'): Promise<void> => {
  try {
    // In development, check if we're running locally
    const netlifyUrl = process.env.NETLIFY_URL || process.env.URL || 'http://localhost:8888';
    
    // Don't wait for the response - fire and forget background processing
    fetch(`${netlifyUrl}/.netlify/functions/auto-process-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'trigger',
        dataTypes: [dataType]
      })
    }).catch(error => {
      console.warn(`Background processing trigger failed for ${dataType}:`, error);
    });
    
  } catch (error) {
    console.warn(`Failed to trigger auto-processing for ${dataType}:`, error);
  }
};

// REPLACE the existing feeds endpoint (around line 417) with this:
const isExactFeedsPath = apiPath === '/feeds' || apiPath === '/api/v1/feeds';
if (isExactFeedsPath) {
  if (!supabase) {
    return createResponse(500, {
      success: false,
      error: 'Database connection not configured'
    });
  }
  
  // Handle GET requests to list all feeds
  if (httpMethod === 'GET') {
    try {
      // 🚀 TRIGGER AUTO-PROCESSING: Check if feeds need refreshing
      triggerAutoProcessing('feeds');
      
      const { data: feeds, error } = await supabase
        .from('feed_sources')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return createResponse(200, {
        success: true,
        data: feeds || [],
        meta: {
          total: feeds?.length || 0,
          timestamp: new Date().toISOString(),
          autoProcessingTriggered: true // Indicate that background processing was triggered
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch feeds'
      });
    }
  }
}

// MODIFY the earnings calendar endpoint (around line 1677) - ADD this line after the try block starts:
// 🚀 TRIGGER AUTO-PROCESSING: Check if earnings need refreshing
triggerAutoProcessing('earnings');

// The rest of the earnings endpoint logic stays the same...

// MODIFY any daily analysis endpoints to include:
// 🚀 TRIGGER AUTO-PROCESSING: Check if analysis needs generation  
triggerAutoProcessing('analysis');

// MODIFY any predictions endpoints to include:
// 🚀 TRIGGER AUTO-PROCESSING: Check if predictions need generation
triggerAutoProcessing('predictions');

// Example of full integration for earnings endpoint:
/* 
// Earnings calendar endpoint - GET /earnings/calendar/:year/:month
if (httpMethod === 'GET' && (apiPath.match(/\/earnings\/calendar\/\d{4}\/\d{1,2}$/) || apiPath.includes('/earnings/calendar/2025/7'))) {
  if (!supabase) {
    return createResponse(500, {
      success: false,
      error: 'Database connection not configured'
    });
  }
  
  try {
    // 🚀 TRIGGER AUTO-PROCESSING: Check if earnings need refreshing
    triggerAutoProcessing('earnings');
    
    // Extract year and month from path
    let year: number, month: number;
    
    if (apiPath.includes('/earnings/calendar/2025/7')) {
      year = 2025;
      month = 7;
    } else {
      const match = apiPath.match(/\/earnings\/calendar\/(\d{4})\/(\d{1,2})$/);
      year = match ? parseInt(match[1]) : new Date().getFullYear();
      month = match ? parseInt(match[2]) : new Date().getMonth() + 1;
    }

    // Create date range for the requested month
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: earnings, error } = await supabase
      .from('earnings_calendar')
      .select('*')
      .gte('earnings_date', startDate)
      .lte('earnings_date', endDate)
      .order('earnings_date', { ascending: true });

    if (error) throw error;

    // Group earnings by date for calendar format
    const calendar: Record<string, any[]> = {};
    
    earnings?.forEach(earning => {
      const date = earning.earnings_date;
      if (!calendar[date]) {
        calendar[date] = [];
      }
      
      // Calculate days until earnings
      const earningsDate = new Date(earning.earnings_date);
      const today = new Date();
      const daysUntil = Math.ceil((earningsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      calendar[date].push({
        ...earning,
        days_until: daysUntil,
        reporting_status: earning.status || 'scheduled'
      });
    });

    return createResponse(200, {
      success: true,
      data: {
        year,
        month,
        calendar
      },
      meta: {
        total: earnings?.length || 0,
        dateRange: { startDate, endDate },
        timestamp: new Date().toISOString(),
        autoProcessingTriggered: true
      }
    });
  } catch (error) {
    return createResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch earnings calendar'
    });
  }
}
*/