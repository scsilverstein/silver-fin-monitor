"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/api.ts
var api_exports = {};
__export(api_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(api_exports);
var import_supabase_js = require("@supabase/supabase-js");
var SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
var SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
var supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? (0, import_supabase_js.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
var getStocksFromDB = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase.from("stock_symbols").select(`
      id,
      symbol,
      name,
      sector,
      industry,
      is_active
    `).eq("is_active", true);
  if (error) {
    console.error("Error fetching stocks:", error);
    return [];
  }
  return (data || []).map((stock) => ({
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector || "Technology",
    industry: stock.industry || "Technology",
    marketCap: 0,
    // These should come from market data APIs
    price: 0,
    pe: 0,
    forwardPE: 0,
    currentRevenue: 0,
    guidedRevenue: 0,
    revenueGrowth: 0,
    eps: 0,
    forwardEps: 0,
    priceToBook: 0,
    debtToEquity: 0,
    expectedGrowth: 0,
    valueScore: 0,
    isFavorite: false
  }));
};
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true"
};
var triggerAutoProcessing = async (dataType) => {
  try {
    if (!supabase) return;
    let needsProcessing = false;
    const now = /* @__PURE__ */ new Date();
    switch (dataType) {
      case "feeds":
        const { data: recentFeed } = await supabase.from("feed_sources").select("last_processed_at").eq("is_active", true).order("last_processed_at", { ascending: false }).limit(1).single();
        const feedAge = recentFeed?.last_processed_at ? now.getTime() - new Date(recentFeed.last_processed_at).getTime() : Infinity;
        if (feedAge > 4 * 60 * 60 * 1e3) {
          needsProcessing = true;
          const { data: feedSources } = await supabase.from("feed_sources").select("id").eq("is_active", true);
          if (feedSources) {
            for (const source of feedSources.slice(0, 5)) {
              await supabase.from("job_queue").insert({
                job_type: "feed_fetch",
                payload: { sourceId: source.id },
                priority: 1,
                status: "pending",
                created_at: now.toISOString()
              });
            }
            console.log(`\u{1F680} Queued ${feedSources.slice(0, 5).length} feed_fetch jobs`);
          }
        }
        break;
      case "earnings":
        const { data: recentEarnings } = await supabase.from("earnings_calendar").select("last_updated").order("last_updated", { ascending: false }).limit(1).single();
        const earningsAge = recentEarnings?.last_updated ? now.getTime() - new Date(recentEarnings.last_updated).getTime() : Infinity;
        if (earningsAge > 24 * 60 * 60 * 1e3) {
          needsProcessing = true;
          await supabase.from("job_queue").insert({
            job_type: "earnings_refresh",
            payload: { source: "auto-trigger", timestamp: now.toISOString() },
            priority: 2,
            status: "pending",
            created_at: now.toISOString()
          });
          console.log("\u{1F680} Queued earnings_refresh job");
        }
        break;
      case "analysis":
        const today = now.toISOString().split("T")[0];
        const { data: todayAnalysis } = await supabase.from("daily_analysis").select("created_at").eq("analysis_date", today).single();
        const analysisAge = todayAnalysis?.created_at ? now.getTime() - new Date(todayAnalysis.created_at).getTime() : Infinity;
        if (analysisAge > 12 * 60 * 60 * 1e3 || !todayAnalysis) {
          needsProcessing = true;
          await supabase.from("job_queue").insert({
            job_type: "daily_analysis",
            payload: { date: today, force: !todayAnalysis },
            priority: 1,
            status: "pending",
            created_at: now.toISOString()
          });
          console.log("\u{1F680} Queued daily_analysis job");
        }
        break;
      case "predictions":
        const { data: recentPrediction } = await supabase.from("predictions").select("created_at").order("created_at", { ascending: false }).limit(1).single();
        const predictionAge = recentPrediction?.created_at ? now.getTime() - new Date(recentPrediction.created_at).getTime() : Infinity;
        if (predictionAge > 6 * 60 * 60 * 1e3) {
          needsProcessing = true;
          const { data: latestAnalysis } = await supabase.from("daily_analysis").select("id, analysis_date").order("analysis_date", { ascending: false }).limit(1).single();
          if (latestAnalysis) {
            await supabase.from("job_queue").insert({
              job_type: "generate_predictions",
              payload: {
                analysisId: latestAnalysis.id,
                analysisDate: latestAnalysis.analysis_date
              },
              priority: 1,
              status: "pending",
              created_at: now.toISOString()
            });
            console.log("\u{1F680} Queued generate_predictions job");
          }
        }
        break;
    }
  } catch (error) {
    console.warn(`Failed to trigger auto-processing for ${dataType}:`, error);
  }
};
var createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...corsHeaders
  },
  body: JSON.stringify(body)
});
var handleRoute = async (event) => {
  const { path, httpMethod, headers, body } = event;
  console.log("API Request:", { path, httpMethod, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ""
    };
  }
  const apiPath = path.replace("/.netlify/functions/api", "") || path;
  console.log("Raw path:", path);
  console.log("Parsed API path:", apiPath);
  console.log("Method:", httpMethod);
  if (apiPath.includes("/earnings/calendar/")) {
    console.log("Earnings calendar path detected:", {
      apiPath,
      httpMethod,
      regexMatch: apiPath.match(/\/earnings\/calendar\/\d{4}\/\d{1,2}$/),
      includesTest: apiPath.includes("/earnings/calendar/2025/7")
    });
  }
  if (apiPath.includes("/health") || apiPath === "/api/v1/health") {
    return createResponse(200, {
      success: true,
      data: {
        status: "healthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        service: "silver-fin-monitor-netlify",
        environment: "netlify",
        path: apiPath,
        originalPath: path
      }
    });
  }
  if (apiPath.includes("/direct-test") || apiPath === "/api/v1/direct-test") {
    return createResponse(200, {
      success: true,
      data: {
        message: "Direct endpoint working in Netlify function - UPDATED",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        environment: "netlify-fixed",
        path: apiPath,
        earningsEndpointAdded: true
      }
    });
  }
  if ((apiPath.includes("/auth/login") || apiPath === "/api/v1/auth/login") && httpMethod === "POST") {
    try {
      const requestBody = JSON.parse(body || "{}");
      const { email, password } = requestBody;
      if (!email || !password) {
        return createResponse(400, {
          success: false,
          error: "Email and password required"
        });
      }
      const mockToken = `mock-jwt-token-${Date.now()}`;
      const mockUser = {
        id: "user-123",
        email,
        role: "user"
      };
      return createResponse(200, {
        success: true,
        data: {
          token: mockToken,
          user: mockUser,
          message: "Login successful"
        }
      });
    } catch (error) {
      return createResponse(400, {
        success: false,
        error: "Invalid JSON in request body"
      });
    }
  }
  if (apiPath.includes("/predictions") || apiPath === "/api/v1/analysis/predictions") {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createResponse(401, {
        success: false,
        error: "Authorization required"
      });
    }
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const { data: predictions, error } = await supabase.from("predictions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: predictions || [],
        meta: {
          total: predictions?.length || 0,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch predictions"
      });
    }
  }
  if (apiPath.includes("/stocks/screener") || apiPath === "/api/v1/stocks/screener") {
    try {
      const stocks = await getStocksFromDB();
      return createResponse(200, {
        success: true,
        data: stocks,
        meta: {
          total: stocks.length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch stocks"
      });
    }
  }
  if (apiPath.includes("/feeds/raw") || apiPath === "/api/v1/feeds/raw" || apiPath.includes("/feeds/content")) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const { data: rawFeeds, error } = await supabase.from("raw_feeds").select("*, feed_sources(name, type)").order("published_at", { ascending: false });
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: rawFeeds || [],
        meta: {
          total: rawFeeds?.length || 0,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch raw feeds"
      });
    }
  }
  const feedItemsRegex = /\/feeds\/[a-zA-Z0-9-]+\/items$/;
  const feedItemsMatch = apiPath.match(feedItemsRegex);
  console.log("Feed items check:", { apiPath, method: httpMethod, regex: feedItemsRegex.toString(), match: feedItemsMatch });
  if (httpMethod === "GET" && feedItemsMatch) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    const pathParts = apiPath.split("/");
    const feedId = pathParts[pathParts.length - 2];
    try {
      console.log("Fetching items for feedId:", feedId);
      const { data: rawFeeds, error } = await supabase.from("raw_feeds").select("*").eq("source_id", feedId).order("published_at", { ascending: false });
      console.log("Raw feeds query result:", { count: rawFeeds?.length, firstItem: rawFeeds?.[0] });
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: rawFeeds || [],
        meta: {
          total: rawFeeds?.length || 0,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch feed items"
      });
    }
  }
  if (httpMethod === "POST" && apiPath.match(/\/feeds\/[a-zA-Z0-9-]+\/process$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    const pathParts = apiPath.split("/");
    const feedId = pathParts[pathParts.length - 2];
    try {
      const { error } = await supabase.from("job_queue").insert({
        job_type: "feed_fetch",
        payload: { sourceId: feedId },
        priority: 1,
        status: "pending"
      });
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: { message: "Feed queued for processing", feedId }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to queue feed processing"
      });
    }
  }
  if (httpMethod === "PUT" && apiPath.match(/\/feeds\/[a-zA-Z0-9-]+$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    const feedId = apiPath.split("/").pop();
    const bodyData = JSON.parse(body || "{}");
    try {
      const { data: updatedFeed, error } = await supabase.from("feed_sources").update(bodyData).eq("id", feedId).select().single();
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: updatedFeed
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update feed"
      });
    }
  }
  const isExactFeedsPath = apiPath === "/feeds" || apiPath === "/api/v1/feeds";
  if (isExactFeedsPath) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    if (httpMethod === "GET") {
      try {
        triggerAutoProcessing("feeds");
        const { data: feeds, error } = await supabase.from("feed_sources").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return createResponse(200, {
          success: true,
          data: feeds || [],
          meta: {
            total: feeds?.length || 0,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            autoProcessingTriggered: true
          }
        });
      } catch (error) {
        return createResponse(500, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch feeds"
        });
      }
    }
  }
  if (httpMethod === "GET" && apiPath.match(/\/feeds\/[a-zA-Z0-9-]+$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    const feedId = apiPath.split("/").pop();
    try {
      const { data: feed, error } = await supabase.from("feed_sources").select("*").eq("id", feedId).single();
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: feed
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch feed"
      });
    }
  }
  if (apiPath.includes("/dashboard/overview") || apiPath === "/api/v1/dashboard/overview") {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createResponse(401, {
        success: false,
        error: "Authorization required"
      });
    }
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const { data: analysis } = await supabase.from("daily_analysis").select("*").order("analysis_date", { ascending: false }).limit(1).single();
      const { data: feedSources } = await supabase.from("feed_sources").select("type");
      const feedTypes = feedSources?.reduce((acc, source) => {
        acc[source.type] = (acc[source.type] || 0) + 1;
        return acc;
      }, {}) || {};
      const { count: contentCount } = await supabase.from("processed_content").select("count", { count: "exact", head: true });
      const { data: predictions } = await supabase.from("predictions").select("*").order("created_at", { ascending: false }).limit(5);
      const activeFeedSources = feedSources?.filter((f) => f.is_active !== false).length || 0;
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const { count: todayCount } = await supabase.from("processed_content").select("count", { count: "exact", head: true }).gte("created_at", today + "T00:00:00Z");
      return createResponse(200, {
        success: true,
        data: {
          // Fields expected by Dashboard component - exact field names
          totalFeeds: feedSources?.length || 0,
          activeFeeds: activeFeedSources,
          todayAnalysis: analysis ? {
            marketSentiment: analysis.market_sentiment || "neutral",
            confidenceScore: analysis.confidence_score || 0,
            keyThemes: analysis.key_themes || [],
            overallSummary: analysis.overall_summary || "No analysis available"
          } : null,
          recentPredictions: predictions || [],
          // Market sentiment
          marketSentiment: {
            label: analysis?.market_sentiment || "neutral",
            score: analysis?.confidence_score || 0,
            confidence: analysis?.confidence_score || 0
          },
          // System health
          systemHealth: {
            feedProcessing: "healthy",
            aiAnalysis: analysis ? "healthy" : "degraded",
            queueStatus: "healthy",
            lastUpdate: /* @__PURE__ */ new Date()
          },
          // Additional data for compatibility
          totalSources: feedSources?.length || 0,
          activeSources: activeFeedSources,
          todayFeeds: todayCount || 0,
          processedToday: todayCount || 0,
          sentimentScore: analysis?.confidence_score || 0,
          lastAnalysisDate: analysis?.analysis_date || null,
          confidenceScore: analysis?.confidence_score || 0,
          activeFeedSources,
          feedTypes,
          recentContentCount: contentCount || 0,
          keyThemes: analysis?.key_themes || [],
          marketDrivers: analysis?.ai_analysis?.market_drivers || [],
          riskFactors: analysis?.ai_analysis?.risk_factors || [],
          activePredictions: predictions || []
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch dashboard data"
      });
    }
  }
  if (apiPath.includes("/dashboard/stats") || apiPath === "/api/v1/dashboard/stats") {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const { count: pendingCount } = await supabase.from("job_queue").select("*", { count: "exact", head: true }).eq("status", "pending");
      const { count: processingCount } = await supabase.from("job_queue").select("*", { count: "exact", head: true }).eq("status", "processing");
      const { count: completedCount } = await supabase.from("job_queue").select("*", { count: "exact", head: true }).eq("status", "completed");
      const { count: failedCount } = await supabase.from("job_queue").select("*", { count: "exact", head: true }).eq("status", "failed");
      const { count: totalItems } = await supabase.from("raw_feeds").select("*", { count: "exact", head: true });
      const { count: processingItems } = await supabase.from("raw_feeds").select("*", { count: "exact", head: true }).eq("processing_status", "processing");
      return createResponse(200, {
        success: true,
        data: {
          queue: {
            pending: pendingCount || 0,
            processing: processingCount || 0,
            completed: completedCount || 0,
            failed: failedCount || 0
          },
          totalItems: totalItems || 0,
          processing: processingItems || 0,
          transcription: {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0
          }
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch stats"
      });
    }
  }
  if (apiPath.includes("/dashboard/trends") || apiPath === "/api/v1/dashboard/trends") {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const url = new URL(event.rawUrl);
      const days = parseInt(url.searchParams.get("days") || "7");
      const endDate = /* @__PURE__ */ new Date();
      const startDate = /* @__PURE__ */ new Date();
      startDate.setDate(startDate.getDate() - days);
      const { data: analyses } = await supabase.from("daily_analysis").select("analysis_date, market_sentiment, confidence_score").gte("analysis_date", startDate.toISOString().split("T")[0]).lte("analysis_date", endDate.toISOString().split("T")[0]).order("analysis_date", { ascending: true });
      const { data: contentVolume } = await supabase.from("processed_content").select("created_at").gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString());
      const volumeByDate = {};
      contentVolume?.forEach((item) => {
        const date = new Date(item.created_at).toISOString().split("T")[0];
        volumeByDate[date] = (volumeByDate[date] || 0) + 1;
      });
      return createResponse(200, {
        success: true,
        data: {
          marketSentiment: analyses || [],
          contentVolume: volumeByDate,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            days
          }
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch trends"
      });
    }
  }
  if (apiPath.includes("/dashboard/accuracy") || apiPath === "/api/v1/dashboard/accuracy") {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const { data: predictions } = await supabase.from("predictions").select("time_horizon, confidence_level, created_at").order("created_at", { ascending: false }).limit(100);
      const accuracyByHorizon = {};
      predictions?.forEach((pred) => {
        if (!accuracyByHorizon[pred.time_horizon]) {
          accuracyByHorizon[pred.time_horizon] = { total: 0, avgConfidence: 0 };
        }
        accuracyByHorizon[pred.time_horizon].total += 1;
        accuracyByHorizon[pred.time_horizon].avgConfidence += pred.confidence_level;
      });
      Object.keys(accuracyByHorizon).forEach((horizon) => {
        accuracyByHorizon[horizon].avgConfidence /= accuracyByHorizon[horizon].total;
      });
      return createResponse(200, {
        success: true,
        data: {
          overallAccuracy: 0.75,
          // Placeholder - implement actual accuracy tracking
          accuracyByHorizon,
          totalPredictions: predictions?.length || 0,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch accuracy data"
      });
    }
  }
  if (apiPath.includes("/dashboard/themes") || apiPath === "/api/v1/dashboard/themes") {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const url = new URL(event.rawUrl);
      const timeframe = url.searchParams.get("timeframe") || "week";
      const days = timeframe === "week" ? 7 : timeframe === "month" ? 30 : 365;
      const startDate = /* @__PURE__ */ new Date();
      startDate.setDate(startDate.getDate() - days);
      const { data: analyses } = await supabase.from("daily_analysis").select("key_themes, ai_analysis").gte("analysis_date", startDate.toISOString().split("T")[0]).order("analysis_date", { ascending: false });
      const themeCounts = {};
      const marketDrivers = {};
      const riskFactors = {};
      analyses?.forEach((analysis) => {
        analysis.key_themes?.forEach((theme) => {
          themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        });
        if (analysis.ai_analysis) {
          const aiData = analysis.ai_analysis;
          if (Array.isArray(aiData.market_drivers)) {
            aiData.market_drivers.forEach((driver) => {
              marketDrivers[driver] = (marketDrivers[driver] || 0) + 1;
            });
          }
          if (Array.isArray(aiData.risk_factors)) {
            aiData.risk_factors.forEach((risk) => {
              riskFactors[risk] = (riskFactors[risk] || 0) + 1;
            });
          }
        }
      });
      const sortByCount = (obj) => Object.entries(obj).sort(([, a], [, b]) => b - a).slice(0, 20).map(([theme, count]) => ({ theme, count }));
      return createResponse(200, {
        success: true,
        data: {
          themes: sortByCount(themeCounts),
          marketDrivers: sortByCount(marketDrivers),
          riskFactors: sortByCount(riskFactors),
          timeframe,
          period: {
            start: startDate.toISOString(),
            end: (/* @__PURE__ */ new Date()).toISOString(),
            days
          }
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch themes"
      });
    }
  }
  if (apiPath.includes("/content") || apiPath === "/api/v1/content") {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const { data: content, error } = await supabase.from("processed_content").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: content || []
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch content"
      });
    }
  }
  if (apiPath.includes("/queue/status") || apiPath === "/api/v1/queue/status") {
    return createResponse(200, {
      success: true,
      data: {
        isProcessing: true,
        // For now, assume queue is always processing
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
        // Return as ISO string for proper serialization
      }
    });
  }
  if (apiPath.includes("/queue/jobs") || apiPath === "/api/v1/queue/jobs") {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const url = new URL(event.rawUrl);
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const status = url.searchParams.get("status");
      const jobType = url.searchParams.get("jobType");
      let query = supabase.from("job_queue").select("*", { count: "exact" }).order("priority", { ascending: true }).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      if (jobType && jobType !== "all") {
        query = query.eq("job_type", jobType);
      }
      const { data: jobs, error, count } = await query;
      if (error) throw error;
      const transformedJobs = (jobs || []).map((row) => ({
        id: row.id,
        jobType: row.job_type,
        // Transform job_type to jobType
        payload: row.payload,
        priority: row.priority,
        status: row.status,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        errorMessage: row.error_message || void 0,
        scheduledAt: row.scheduled_at,
        startedAt: row.started_at || void 0,
        completedAt: row.completed_at || void 0,
        createdAt: row.created_at,
        expiresAt: row.expires_at || void 0
      }));
      return createResponse(200, {
        success: true,
        data: transformedJobs,
        meta: {
          total: count || 0,
          limit,
          offset,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch queue jobs"
      });
    }
  }
  if (apiPath.includes("/queue/stats") || apiPath === "/api/v1/queue/stats") {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const now = /* @__PURE__ */ new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1e3);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
      const { data: statusCounts } = await supabase.from("job_queue").select("status").in("status", ["pending", "processing", "completed", "failed", "retry"]);
      const counts = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retry: 0
      };
      statusCounts?.forEach((job) => {
        if (job.status in counts) {
          counts[job.status]++;
        }
      });
      const { data: jobTypes } = await supabase.from("job_queue").select("job_type");
      const jobTypeCounts = {};
      jobTypes?.forEach((job) => {
        jobTypeCounts[job.job_type] = (jobTypeCounts[job.job_type] || 0) + 1;
      });
      const { data: recentCompletions } = await supabase.from("job_queue").select("*").eq("status", "completed").gte("completed_at", oneHourAgo.toISOString()).order("completed_at", { ascending: false }).limit(10);
      const sanitizedRecentJobs = (recentCompletions || []).map((job) => {
        const sanitizeDate = (dateValue) => {
          if (!dateValue) return null;
          try {
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? null : date.toISOString();
          } catch {
            return null;
          }
        };
        return {
          ...job,
          created_at: sanitizeDate(job.created_at),
          scheduled_at: sanitizeDate(job.scheduled_at),
          started_at: sanitizeDate(job.started_at),
          completed_at: sanitizeDate(job.completed_at),
          expires_at: sanitizeDate(job.expires_at)
        };
      });
      const { data: completedJobs } = await supabase.from("job_queue").select("started_at, completed_at").eq("status", "completed").not("started_at", "is", null).not("completed_at", "is", null).gte("completed_at", oneDayAgo.toISOString());
      let avgProcessingTime = 0;
      if (completedJobs && completedJobs.length > 0) {
        const totalTime = completedJobs.reduce((sum, job) => {
          try {
            const start = new Date(job.started_at).getTime();
            const end = new Date(job.completed_at).getTime();
            if (!isNaN(start) && !isNaN(end) && end >= start) {
              return sum + (end - start);
            }
          } catch (e) {
          }
          return sum;
        }, 0);
        avgProcessingTime = completedJobs.length > 0 ? Math.round(totalTime / completedJobs.length / 1e3) : 0;
      }
      return createResponse(200, {
        success: true,
        data: {
          statusCounts: counts,
          totalJobs: statusCounts?.length || 0,
          jobTypeCounts,
          recentCompletions: recentCompletions?.length || 0,
          avgProcessingTime,
          queueHealth: counts.failed < counts.completed ? "healthy" : "degraded",
          lastHourCompletions: recentCompletions?.length || 0,
          recentJobs: sanitizedRecentJobs.slice(0, 5),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch queue stats"
      });
    }
  }
  if (apiPath.includes("/queue/worker/status") || apiPath === "/api/v1/queue/worker/status") {
    if (httpMethod === "GET") {
      if (!supabase) {
        return createResponse(500, {
          success: false,
          error: "Database connection not configured"
        });
      }
      try {
        const workerStateKey = "queue_worker_state";
        let { data: workerState } = await supabase.from("cache_store").select("value").eq("key", workerStateKey).single();
        if (!workerState) {
          const initialState = {
            isRunning: false,
            concurrency: 5,
            status: "stopped",
            lastHeartbeat: (/* @__PURE__ */ new Date()).toISOString(),
            startedAt: null,
            workerCount: 0
          };
          await supabase.from("cache_store").insert({
            key: workerStateKey,
            value: initialState,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
            // 24 hours
          });
          workerState = { value: initialState };
        }
        const state = workerState.value;
        const { count: activeJobs } = await supabase.from("job_queue").select("*", { count: "exact", head: true }).eq("status", "processing");
        const { data: activeJobsData } = await supabase.from("job_queue").select("id, created_at, priority, job_type").eq("status", "processing").order("priority", { ascending: true }).order("created_at", { ascending: true }).limit(10);
        const activeJobIds = activeJobsData?.map((job) => job.id) || [];
        const lastHeartbeat = new Date(state.lastHeartbeat || 0);
        const isStale = Date.now() - lastHeartbeat.getTime() > 5 * 60 * 1e3;
        
        // If there are active jobs, worker is definitely running regardless of heartbeat
        const hasActiveJobs = (activeJobs || 0) > 0;
        const isEffectivelyRunning = hasActiveJobs || (state.isRunning && !isStale);
        const effectiveStatus = hasActiveJobs ? "processing" : 
                               (isStale && state.isRunning ? "stale" : 
                               (state.isRunning ? "running" : "stopped"));
        
        // Calculate worker count based on active jobs and concurrency
        const maxConcurrent = state.concurrency || 5;
        const workerCount = hasActiveJobs ? Math.min(activeJobs, maxConcurrent) : 
                           (state.isRunning && !isStale ? 1 : 0);
        
        return createResponse(200, {
          success: true,
          data: {
            isRunning: isEffectivelyRunning,
            concurrency: maxConcurrent,
            activeJobs: activeJobs || 0,
            activeJobIds,
            workerCount,
            status: effectiveStatus,
            lastHeartbeat: state.lastHeartbeat,
            startedAt: state.startedAt,
            uptime: state.startedAt ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1e3) : 0
          }
        });
      } catch (error) {
        return createResponse(500, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch worker status"
        });
      }
    }
  }
  if (apiPath.includes("/queue/worker/start") || apiPath === "/api/v1/queue/worker/start") {
    if (httpMethod === "POST") {
      if (!supabase) {
        return createResponse(500, {
          success: false,
          error: "Database connection not configured"
        });
      }
      try {
        const workerStateKey = "queue_worker_state";
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const newState = {
          isRunning: true,
          concurrency: 5,
          status: "running",
          lastHeartbeat: now,
          startedAt: now,
          workerCount: 1
        };
        await supabase.from("cache_store").upsert({
          key: workerStateKey,
          value: newState,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
        });
        await supabase.from("job_queue").insert({
          job_type: "worker_heartbeat",
          payload: { action: "start", timestamp: now },
          priority: 1,
          status: "pending"
        });
        return createResponse(200, {
          success: true,
          data: {
            message: "Queue worker started successfully",
            status: "running",
            startedAt: now,
            isRunning: true,
            timestamp: now
          }
        });
      } catch (error) {
        return createResponse(500, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to start worker"
        });
      }
    }
  }
  if (apiPath.includes("/queue/worker/stop") || apiPath === "/api/v1/queue/worker/stop") {
    if (httpMethod === "POST") {
      if (!supabase) {
        return createResponse(500, {
          success: false,
          error: "Database connection not configured"
        });
      }
      try {
        const workerStateKey = "queue_worker_state";
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const { data: currentState } = await supabase.from("cache_store").select("value").eq("key", workerStateKey).single();
        const newState = {
          ...currentState?.value || {},
          isRunning: false,
          status: "stopped",
          lastHeartbeat: now,
          workerCount: 0,
          stoppedAt: now
        };
        await supabase.from("cache_store").upsert({
          key: workerStateKey,
          value: newState,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
        });
        await supabase.from("job_queue").update({
          status: "pending",
          started_at: null
        }).eq("status", "processing");
        await supabase.from("job_queue").insert({
          job_type: "worker_heartbeat",
          payload: { action: "stop", timestamp: now },
          priority: 1,
          status: "pending"
        });
        return createResponse(200, {
          success: true,
          data: {
            message: "Queue worker stopped successfully",
            status: "stopped",
            stoppedAt: now,
            isRunning: false,
            timestamp: now
          }
        });
      } catch (error) {
        return createResponse(500, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to stop worker"
        });
      }
    }
  }
  if (apiPath.includes("/queue/worker/restart") || apiPath === "/api/v1/queue/worker/restart") {
    if (httpMethod === "POST") {
      if (!supabase) {
        return createResponse(500, {
          success: false,
          error: "Database connection not configured"
        });
      }
      try {
        const workerStateKey = "queue_worker_state";
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await supabase.from("job_queue").update({
          status: "pending",
          started_at: null
        }).eq("status", "processing");
        const newState = {
          isRunning: true,
          concurrency: 5,
          status: "running",
          lastHeartbeat: now,
          startedAt: now,
          workerCount: 1,
          restartedAt: now
        };
        await supabase.from("cache_store").upsert({
          key: workerStateKey,
          value: newState,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
        });
        await supabase.from("job_queue").insert({
          job_type: "worker_heartbeat",
          payload: { action: "restart", timestamp: now },
          priority: 1,
          status: "pending"
        });
        return createResponse(200, {
          success: true,
          data: {
            message: "Queue worker restarted successfully",
            status: "running",
            startedAt: now,
            restartedAt: now,
            isRunning: true,
            timestamp: now
          }
        });
      } catch (error) {
        return createResponse(500, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to restart worker"
        });
      }
    }
  }
  if (apiPath.includes("/queue/worker/heartbeat") || apiPath === "/api/v1/queue/worker/heartbeat") {
    if (httpMethod === "POST") {
      if (!supabase) {
        return createResponse(500, {
          success: false,
          error: "Database connection not configured"
        });
      }
      try {
        const workerStateKey = "queue_worker_state";
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const { data: currentState } = await supabase.from("cache_store").select("value").eq("key", workerStateKey).single();
        if (currentState?.value?.isRunning) {
          const updatedState = {
            ...currentState.value,
            lastHeartbeat: now
          };
          await supabase.from("cache_store").update({
            value: updatedState,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
          }).eq("key", workerStateKey);
          return createResponse(200, {
            success: true,
            data: {
              message: "Worker heartbeat updated",
              lastHeartbeat: now,
              isAlive: true
            }
          });
        } else {
          return createResponse(200, {
            success: true,
            data: {
              message: "Worker is not running",
              lastHeartbeat: now,
              isAlive: false
            }
          });
        }
      } catch (error) {
        return createResponse(500, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update heartbeat"
        });
      }
    }
  }
  if (httpMethod === "POST" && apiPath.match(/\/queue\/jobs\/[a-zA-Z0-9-]+\/retry$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    const jobId = apiPath.split("/").slice(-2)[0];
    try {
      const { error } = await supabase.from("job_queue").update({
        status: "pending",
        attempts: 0,
        error_message: null,
        scheduled_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", jobId);
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: { message: "Job queued for retry", jobId }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retry job"
      });
    }
  }
  if (httpMethod === "POST" && apiPath.match(/\/queue\/jobs\/[a-zA-Z0-9-]+\/cancel$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    const jobId = apiPath.split("/").slice(-2)[0];
    try {
      const { error } = await supabase.from("job_queue").update({
        status: "failed",
        error_message: "Cancelled by user",
        completed_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", jobId).in("status", ["pending", "retry"]);
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: { message: "Job cancelled successfully", jobId }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cancel job"
      });
    }
  }
  if (httpMethod === "POST" && apiPath.match(/\/queue\/jobs\/[a-zA-Z0-9-]+\/reset$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    const jobId = apiPath.split("/").slice(-2)[0];
    try {
      const { error } = await supabase.from("job_queue").update({
        status: "pending",
        attempts: 0,
        error_message: null,
        started_at: null,
        completed_at: null,
        scheduled_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", jobId);
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: { message: "Job reset to pending", jobId }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset job"
      });
    }
  }
  if (httpMethod === "DELETE" && apiPath.match(/\/queue\/jobs\/[a-zA-Z0-9-]+$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    const jobId = apiPath.split("/").pop();
    try {
      const { error } = await supabase.from("job_queue").delete().eq("id", jobId);
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: { message: "Job deleted successfully", jobId }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete job"
      });
    }
  }
  if (apiPath.includes("/queue/jobs/retry-all-failed") || apiPath === "/api/v1/queue/jobs/retry-all-failed") {
    if (httpMethod === "POST") {
      if (!supabase) {
        return createResponse(500, {
          success: false,
          error: "Database connection not configured"
        });
      }
      try {
        const { data, error } = await supabase.from("job_queue").update({
          status: "pending",
          attempts: 0,
          error_message: null,
          scheduled_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("status", "failed").select("id");
        if (error) throw error;
        return createResponse(200, {
          success: true,
          data: {
            message: `${data?.length || 0} failed jobs queued for retry`,
            retriedCount: data?.length || 0
          }
        });
      } catch (error) {
        return createResponse(500, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to retry failed jobs"
        });
      }
    }
  }
  if (apiPath.includes("/queue/jobs/clear-failed") || apiPath === "/api/v1/queue/jobs/clear-failed") {
    if (httpMethod === "POST") {
      if (!supabase) {
        return createResponse(500, {
          success: false,
          error: "Database connection not configured"
        });
      }
      try {
        const { data, error } = await supabase.from("job_queue").delete().eq("status", "failed").select("id");
        if (error) throw error;
        return createResponse(200, {
          success: true,
          data: {
            message: `${data?.length || 0} failed jobs cleared`,
            clearedCount: data?.length || 0
          }
        });
      } catch (error) {
        return createResponse(500, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to clear failed jobs"
        });
      }
    }
  }
  if (httpMethod === "GET" && (apiPath.match(/\/earnings\/calendar\/\d{4}\/\d{1,2}$/) || apiPath.includes("/earnings/calendar/2025/7"))) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    const pathParts = apiPath.split("/");
    const year = pathParts[pathParts.length - 2];
    const month = pathParts[pathParts.length - 1];
    try {
      triggerAutoProcessing("earnings");
      const startDate = `${year}-${month.padStart(2, "0")}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
      const { data: earnings, error } = await supabase.from("earnings_calendar").select("*").gte("earnings_date", startDate).lte("earnings_date", endDate).order("earnings_date", { ascending: true }).order("importance_rating", { ascending: false }).order("symbol", { ascending: true });
      if (error) {
        throw new Error(`Failed to fetch earnings data: ${error.message}`);
      }
      const calendarData = (earnings || []).reduce((acc, item) => {
        if (!acc[item.earnings_date]) {
          acc[item.earnings_date] = [];
        }
        acc[item.earnings_date].push({
          id: item.id,
          symbol: item.symbol,
          company_name: item.company_name,
          earnings_date: item.earnings_date,
          time_of_day: item.time_of_day,
          importance_rating: item.importance_rating,
          status: item.status,
          confirmed: item.confirmed,
          has_reports: false,
          fiscal_quarter: item.fiscal_quarter,
          fiscal_year: item.fiscal_year
        });
        return acc;
      }, {});
      return createResponse(200, {
        success: true,
        data: {
          year: parseInt(year),
          month: parseInt(month),
          calendar: calendarData
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch earnings calendar"
      });
    }
  }
  if (apiPath.includes("/earnings/calendar") && apiPath.match(/\/earnings\/calendar$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const url = new URL(event.rawUrl);
      const symbol = url.searchParams.get("symbol");
      const startDate = url.searchParams.get("start_date");
      const endDate = url.searchParams.get("end_date");
      const importanceMin = url.searchParams.get("importance_min");
      const status = url.searchParams.get("status");
      const confirmedOnly = url.searchParams.get("confirmed_only");
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      let query = supabase.from("earnings_calendar").select("*", { count: "exact" });
      if (symbol) {
        query = query.eq("symbol", symbol);
      }
      if (startDate) {
        query = query.gte("earnings_date", startDate);
      }
      if (endDate) {
        query = query.lte("earnings_date", endDate);
      }
      if (importanceMin) {
        query = query.gte("importance_rating", parseInt(importanceMin));
      }
      if (status) {
        query = query.eq("status", status);
      }
      if (confirmedOnly === "true") {
        query = query.eq("confirmed", true);
      }
      query = query.order("earnings_date", { ascending: true }).order("importance_rating", { ascending: false }).order("symbol", { ascending: true }).range(offset, offset + limit - 1);
      const { data: earnings, error, count } = await query;
      if (error) {
        throw new Error(`Failed to fetch earnings calendar: ${error.message}`);
      }
      return createResponse(200, {
        success: true,
        data: earnings || [],
        meta: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + (earnings?.length || 0)
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch earnings calendar"
      });
    }
  }
  if (apiPath.includes("/earnings/upcoming") && apiPath.match(/\/earnings\/upcoming$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const url = new URL(event.rawUrl);
      const days = parseInt(url.searchParams.get("days") || "30");
      const today = /* @__PURE__ */ new Date();
      const futureDate = /* @__PURE__ */ new Date();
      futureDate.setDate(today.getDate() + days);
      const { data: earnings, error } = await supabase.from("earnings_calendar").select("*").gte("earnings_date", today.toISOString().split("T")[0]).lte("earnings_date", futureDate.toISOString().split("T")[0]).order("earnings_date", { ascending: true }).order("importance_rating", { ascending: false });
      if (error) {
        throw new Error(`Failed to fetch upcoming earnings: ${error.message}`);
      }
      return createResponse(200, {
        success: true,
        data: earnings || []
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch upcoming earnings"
      });
    }
  }
  if (apiPath.includes("/whisper/status") || apiPath === "/api/v1/whisper/status") {
    return createResponse(200, {
      success: true,
      data: {
        status: "available",
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        model: "base",
        device: "cpu"
      }
    });
  }
  console.log("Checking analysis trigger:", apiPath, "includes trigger?", apiPath.includes("/analysis/trigger"), "method:", httpMethod);
  const isAnalysisTrigger = apiPath === "/api/v1/analysis/trigger" || apiPath === "/v1/analysis/trigger" || // This is the actual path from Netlify redirect
  apiPath === "/analysis/trigger" || apiPath.endsWith("/analysis/trigger");
  console.log("isAnalysisTrigger:", isAnalysisTrigger);
  if (isAnalysisTrigger && httpMethod === "GET") {
    return createResponse(405, {
      success: false,
      error: "Method not allowed. The analysis trigger endpoint requires POST method.",
      data: {
        endpoint: "/api/v1/analysis/trigger",
        method: "POST",
        requiredBody: {
          date: "YYYY-MM-DD (optional, defaults to today)",
          force: "boolean (optional, defaults to false)"
        },
        authentication: "Bearer token required"
      }
    });
  }
  if (isAnalysisTrigger && httpMethod === "POST") {
    console.log("Analysis trigger endpoint matched!");
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createResponse(401, {
        success: false,
        error: "Authorization required"
      });
    }
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const requestBody = JSON.parse(body || "{}");
      const { date, force = false } = requestBody;
      const analysisDate = date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (!force) {
        const { data: existing } = await supabase.from("daily_analysis").select("id").eq("analysis_date", analysisDate).single();
        if (existing) {
          return createResponse(400, {
            success: false,
            error: "Analysis already exists for this date. Use force=true to regenerate."
          });
        }
      }
      const { data: job, error } = await supabase.from("job_queue").insert({
        job_type: "daily_analysis",
        payload: { date: analysisDate, force },
        priority: 1,
        status: "pending"
      }).select().single();
      if (error) throw error;
      return createResponse(200, {
        success: true,
        data: {
          jobId: job.id,
          message: "Daily analysis queued successfully",
          analysisDate
        }
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to trigger analysis"
      });
    }
  }
  if (httpMethod === "GET" && apiPath.match(/\/analysis\/\d{4}-\d{2}-\d{2}$/)) {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const dateMatch = apiPath.match(/(\d{4}-\d{2}-\d{2})$/);
      const analysisDate = dateMatch ? dateMatch[1] : null;
      if (!analysisDate) {
        return createResponse(400, {
          success: false,
          error: "Invalid date format"
        });
      }
      const { data: analysis, error } = await supabase.from("daily_analysis").select(`
          *,
          predictions:predictions (*)
        `).eq("analysis_date", analysisDate).single();
      if (error) {
        if (error.code === "PGRST116") {
          return createResponse(404, {
            success: false,
            error: "Analysis not found for this date"
          });
        }
        throw error;
      }
      return createResponse(200, {
        success: true,
        data: analysis
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch analysis"
      });
    }
  }
  if ((apiPath === "/analysis/latest" || apiPath === "/api/v1/analysis/latest" || apiPath === "/v1/analysis/latest") && httpMethod === "GET") {
    if (!supabase) {
      return createResponse(500, {
        success: false,
        error: "Database connection not configured"
      });
    }
    try {
      const { data: analysis, error } = await supabase.from("daily_analysis").select(`
          *,
          predictions:predictions (*)
        `).order("analysis_date", { ascending: false }).limit(1).single();
      if (error) {
        if (error.code === "PGRST116") {
          return createResponse(404, {
            success: false,
            error: "No analysis found"
          });
        }
        throw error;
      }
      return createResponse(200, {
        success: true,
        data: analysis
      });
    } catch (error) {
      return createResponse(500, {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch latest analysis"
      });
    }
  }
  const isAnalysisRoot = apiPath === "/analysis" || apiPath === "/api/v1/analysis" || apiPath === "/v1/analysis";
  if (isAnalysisRoot) {
    if (httpMethod === "GET") {
      if (!supabase) {
        return createResponse(500, {
          success: false,
          error: "Database connection not configured"
        });
      }
      try {
        const url = new URL(event.rawUrl);
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");
        let query = supabase.from("daily_analysis").select("*", { count: "exact" }).order("analysis_date", { ascending: false });
        if (startDate) {
          query = query.gte("analysis_date", startDate);
        }
        if (endDate) {
          query = query.lte("analysis_date", endDate);
        }
        query = query.range(offset, offset + limit - 1);
        const { data: analyses, error, count } = await query;
        if (error) throw error;
        return createResponse(200, {
          success: true,
          data: analyses || [],
          meta: {
            total: count || 0,
            limit,
            offset,
            hasMore: (count || 0) > offset + (analyses?.length || 0)
          }
        });
      } catch (error) {
        return createResponse(500, {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch analyses"
        });
      }
    }
  }
  if (apiPath === "/api/v1" || apiPath === "/") {
    return createResponse(200, {
      success: true,
      data: {
        service: "Silver Fin Monitor API",
        version: "1.0.0",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        availableEndpoints: [
          "GET /api/v1/health",
          "GET /api/v1/direct-test",
          "POST /api/v1/auth/login",
          "GET /api/v1/analysis",
          "GET /api/v1/analysis/latest",
          "GET /api/v1/analysis/{date}",
          "POST /api/v1/analysis/trigger",
          "GET /api/v1/analysis/predictions (requires auth)",
          "GET /api/v1/stocks/screener",
          "GET /api/v1/dashboard/overview (requires auth)",
          "GET /api/v1/feeds",
          "GET /api/v1/feeds/{id}/items",
          "PUT /api/v1/feeds/{id}",
          "GET /api/v1/content",
          "GET /api/v1/dashboard/stats",
          "GET /api/v1/queue/status",
          "GET /api/v1/queue/jobs",
          "GET /api/v1/queue/stats",
          "GET /api/v1/queue/worker/status",
          "POST /api/v1/queue/worker/start",
          "POST /api/v1/queue/worker/stop",
          "POST /api/v1/queue/worker/restart",
          "POST /api/v1/queue/worker/heartbeat",
          "POST /api/v1/queue/jobs/{id}/retry",
          "POST /api/v1/queue/jobs/{id}/cancel",
          "POST /api/v1/queue/jobs/{id}/reset",
          "DELETE /api/v1/queue/jobs/{id}",
          "POST /api/v1/queue/jobs/retry-all-failed",
          "POST /api/v1/queue/jobs/clear-failed",
          "GET /api/v1/earnings/calendar",
          "GET /api/v1/earnings/calendar/{year}/{month}",
          "GET /api/v1/earnings/upcoming",
          "GET /api/v1/whisper/status"
        ]
      }
    });
  }
  if (apiPath.includes("/analysis")) {
    console.log("Analysis route not matched - Debug info:", {
      apiPath,
      httpMethod,
      path,
      headers,
      bodyPreview: body ? body.substring(0, 100) : "No body"
    });
  }
  return createResponse(404, {
    success: false,
    error: `API endpoint not found: ${apiPath}`,
    data: {
      originalPath: path,
      parsedPath: apiPath,
      method: httpMethod,
      availableEndpoints: [
        "GET /api/v1/health",
        "GET /api/v1/direct-test",
        "POST /api/v1/auth/login",
        "GET /api/v1/analysis",
        "GET /api/v1/analysis/latest",
        "GET /api/v1/analysis/{date}",
        "POST /api/v1/analysis/trigger",
        "GET /api/v1/analysis/predictions",
        "GET /api/v1/stocks/screener",
        "GET /api/v1/dashboard/overview",
        "GET /api/v1/queue/worker/status",
        "POST /api/v1/queue/worker/start",
        "POST /api/v1/queue/worker/stop",
        "POST /api/v1/queue/worker/restart",
        "POST /api/v1/queue/worker/heartbeat",
        "GET /api/v1/earnings/calendar",
        "GET /api/v1/earnings/calendar/{year}/{month}",
        "GET /api/v1/earnings/upcoming"
      ]
    }
  });
};
var handler = async (event, _context) => {
  try {
    return await handleRoute(event);
  } catch (error) {
    console.error("Handler error:", error);
    return createResponse(500, {
      success: false,
      error: "Internal server error",
      data: {
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
