import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

dotenv.config({ path: resolve('.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMigration() {
  try {
    console.log('Running timeframe analysis migration...');
    
    // Run individual statements through SQL query
    const createTable1 = `
      CREATE TABLE timeframe_analysis (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timeframe_type VARCHAR(20) NOT NULL CHECK (timeframe_type IN ('daily', 'weekly', 'monthly')),
          timeframe_start DATE NOT NULL,
          timeframe_end DATE NOT NULL,
          analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
          market_sentiment VARCHAR(50) NOT NULL,
          key_themes TEXT[] DEFAULT '{}',
          overall_summary TEXT NOT NULL,
          ai_analysis JSONB DEFAULT '{}',
          confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
          sources_analyzed INTEGER DEFAULT 0,
          content_distribution JSONB DEFAULT '{}',
          trend_analysis JSONB DEFAULT '{}',
          comparison_data JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(timeframe_type, timeframe_start, timeframe_end)
      );
    `;
    
    const createTable2 = `
      CREATE TABLE timeframe_predictions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timeframe_analysis_id UUID NOT NULL REFERENCES timeframe_analysis(id) ON DELETE CASCADE,
          prediction_type VARCHAR(100) NOT NULL,
          prediction_text TEXT NOT NULL,
          confidence_level FLOAT CHECK (confidence_level BETWEEN 0 AND 1),
          time_horizon VARCHAR(50) NOT NULL,
          prediction_data JSONB DEFAULT '{}',
          based_on_timeframe VARCHAR(20) NOT NULL,
          timeframe_start DATE NOT NULL,
          timeframe_end DATE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    // Execute table creation
    console.log('Creating timeframe_analysis table...');
    let { error } = await supabase.rpc('query', { query: createTable1 });
    if (error && !error.message.includes('already exists')) {
      console.error('Failed to create timeframe_analysis table:', error);
      return;
    }
    
    console.log('Creating timeframe_predictions table...');
    ({ error } = await supabase.rpc('query', { query: createTable2 }));
    if (error && !error.message.includes('already exists')) {
      console.error('Failed to create timeframe_predictions table:', error);
      return;
    }
    
    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_timeframe_analysis_type_date ON timeframe_analysis(timeframe_type, analysis_date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_timeframe_analysis_timeframe ON timeframe_analysis(timeframe_start, timeframe_end)',
      'CREATE INDEX IF NOT EXISTS idx_timeframe_analysis_created ON timeframe_analysis(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_timeframe_predictions_analysis ON timeframe_predictions(timeframe_analysis_id, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_timeframe_predictions_type ON timeframe_predictions(prediction_type, based_on_timeframe)'
    ];
    
    for (const indexSql of indexes) {
      console.log('Creating index...');
      ({ error } = await supabase.rpc('query', { query: indexSql }));
      if (error) {
        console.error('Index creation failed:', error);
      }
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

runMigration();