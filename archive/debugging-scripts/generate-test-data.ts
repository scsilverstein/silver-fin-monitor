import 'dotenv/config';
import { supabase } from '../src/services/database/client';
import { queueService } from '../src/services/database/queue';
import { feedProcessor } from '../src/services/feeds/processor';
import { openAIService } from '../src/services/ai/openai.service';
import { logger } from '../src/utils/logger';

async function generateTestData() {
  logger.info('Starting test data generation...');

  try {
    // 1. Create test feed sources if they don't exist
    const testSources = [
      {
        name: 'TechCrunch',
        type: 'rss',
        url: 'https://techcrunch.com/feed/',
        config: {
          categories: ['technology', 'startup', 'ai'],
          priority: 'high',
          update_frequency: 'hourly'
        }
      },
      {
        name: 'Financial Times - Markets',
        type: 'rss',
        url: 'https://www.ft.com/markets?format=rss',
        config: {
          categories: ['finance', 'markets', 'analysis'],
          priority: 'high',
          update_frequency: '15min'
        }
      },
      {
        name: 'Bloomberg Technology',
        type: 'rss',
        url: 'https://feeds.bloomberg.com/technology/news.rss',
        config: {
          categories: ['technology', 'finance', 'markets'],
          priority: 'medium',
          update_frequency: 'hourly'
        }
      }
    ];

    // Insert feed sources
    for (const source of testSources) {
      const { data: existing } = await supabase
        .from('feed_sources')
        .select('id')
        .eq('url', source.url)
        .single();

      if (!existing) {
        const { data, error } = await supabase
          .from('feed_sources')
          .insert({
            ...source,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          logger.error(`Failed to create feed source ${source.name}:`, error);
        } else {
          logger.info(`Created feed source: ${source.name} (${data.id})`);
          
          // Queue feed fetch job
          await queueService.enqueue('feed_fetch', {
            sourceId: data.id,
            sourceName: source.name
          }, 1);
        }
      } else {
        logger.info(`Feed source already exists: ${source.name}`);
        
        // Queue feed fetch job anyway
        await queueService.enqueue('feed_fetch', {
          sourceId: existing.id,
          sourceName: source.name
        }, 1);
      }
    }

    // 2. Create some test predictions if daily analysis exists
    const { data: latestAnalysis } = await supabase
      .from('daily_analysis')
      .select('*')
      .order('analysis_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestAnalysis) {
      logger.info('No daily analysis found. Creating one...');
      
      // Get some processed content to analyze
      const { data: processedContent } = await supabase
        .from('processed_content')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (processedContent && processedContent.length > 0) {
        // Queue daily analysis generation
        await queueService.enqueue('daily_analysis', {
          date: new Date().toISOString().split('T')[0],
          force: true
        }, 1);
        
        logger.info('Queued daily analysis generation');
      } else {
        logger.warn('No processed content available for analysis');
      }
    } else {
      logger.info(`Latest daily analysis found: ${latestAnalysis.analysis_date}`);
      
      // Check if it has predictions
      const { data: predictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('daily_analysis_id', latestAnalysis.id);

      if (!predictions || predictions.length === 0) {
        logger.info('No predictions found. Generating...');
        
        // Generate predictions for the analysis
        await queueService.enqueue('generate_predictions', {
          analysisId: latestAnalysis.id
        }, 1);
      }
    }

    // 3. Add some stock symbols for the scanner
    const stockSymbols = [
      { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', market_cap_category: 'mega' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software', market_cap_category: 'mega' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Services', market_cap_category: 'mega' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', industry: 'E-commerce', market_cap_category: 'mega' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', market_cap_category: 'mega' },
      { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary', industry: 'Automobiles', market_cap_category: 'large' },
      { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Social Media', market_cap_category: 'large' },
      { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', sector: 'Financials', industry: 'Insurance', market_cap_category: 'large' }
    ];

    for (const stock of stockSymbols) {
      const { data: existing } = await supabase
        .from('stock_symbols')
        .select('id')
        .eq('symbol', stock.symbol)
        .single();

      if (!existing) {
        const { data, error } = await supabase
          .from('stock_symbols')
          .insert({
            ...stock,
            is_active: true,
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          logger.error(`Failed to create stock symbol ${stock.symbol}:`, error);
        } else {
          logger.info(`Created stock symbol: ${stock.symbol}`);
        }
      } else {
        logger.info(`Stock symbol already exists: ${stock.symbol}`);
      }
    }

    logger.info('Test data generation completed!');
    logger.info('Please run the queue worker to process the queued jobs.');
  } catch (error) {
    logger.error('Test data generation failed:', error);
    process.exit(1);
  }
}

// Run the script
generateTestData()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });