const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function createTables() {
  const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: { persistSession: false }
    }
  );

  console.log('Creating timeframe analysis tables...');

  try {
    // First, check if tables exist
    console.log('Checking if timeframe_analysis table exists...');
    const { data: existingTables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'timeframe_analysis');

    if (existingTables && existingTables.length > 0) {
      console.log('timeframe_analysis table already exists!');
      return;
    }

    console.log('Creating timeframe_analysis table...');
    // Create timeframe_analysis table
    const { error: table1Error } = await supabase.rpc('exec_sql', { 
      sql: `
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
      `
    });

    if (table1Error) {
      console.error('Error creating timeframe_analysis table:', table1Error);
    } else {
      console.log('timeframe_analysis table created successfully');
    }

    console.log('Creating indexes...');
    // Create indexes
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_timeframe_analysis_type_date ON timeframe_analysis(timeframe_type, analysis_date DESC);
        CREATE INDEX IF NOT EXISTS idx_timeframe_analysis_timeframe ON timeframe_analysis(timeframe_start, timeframe_end);
        CREATE INDEX IF NOT EXISTS idx_timeframe_analysis_created ON timeframe_analysis(created_at DESC);
      `
    });

    console.log('Indexes created successfully');

    console.log('Creating timeframe_predictions table...');
    // Create timeframe_predictions table
    const { error: table2Error } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (table2Error) {
      console.error('Error creating timeframe_predictions table:', table2Error);
    } else {
      console.log('timeframe_predictions table created successfully');
    }

    console.log('Creating timeframe prediction indexes...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_timeframe_predictions_analysis ON timeframe_predictions(timeframe_analysis_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_timeframe_predictions_type ON timeframe_predictions(prediction_type, based_on_timeframe);
      `
    });

    console.log('All tables and indexes created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error.message);
  }
}

createTables();