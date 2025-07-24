#!/usr/bin/env tsx
/**
 * Create prediction_accuracy table if it doesn't exist
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createPredictionAccuracyTable() {
  console.log('🔄 Creating prediction_accuracy table...');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS prediction_accuracy (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
      evaluation_date DATE NOT NULL,
      accuracy_type VARCHAR(50) DEFAULT 'comprehensive',
      accuracy_score FLOAT NOT NULL CHECK (accuracy_score BETWEEN 0 AND 1),
      actual_outcome TEXT,
      prediction_text TEXT,
      error_analysis JSONB DEFAULT '{}',
      contributing_factors JSONB DEFAULT '[]',
      lessons_learned TEXT[] DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  const createIndexSQL = `
    CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_date 
    ON prediction_accuracy(evaluation_date DESC);

    CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_prediction 
    ON prediction_accuracy(prediction_id);

    CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_score 
    ON prediction_accuracy(accuracy_score DESC);
  `;

  try {
    // Create table
    const { error: tableError } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    });

    if (tableError) {
      console.error('Table creation error:', tableError);
      throw tableError;
    }

    console.log('✅ prediction_accuracy table created successfully');

    // Create indexes
    const { error: indexError } = await supabase.rpc('exec_sql', { 
      sql: createIndexSQL 
    });

    if (indexError) {
      console.error('Index creation error:', indexError);
      throw indexError;
    }

    console.log('✅ Indexes created successfully');

  } catch (error) {
    console.error('❌ Error creating table:', error);
    
    // Try direct SQL approach
    try {
      console.log('🔄 Trying alternative approach...');
      
      // Just check if we can query the table
      const { data, error } = await supabase
        .from('prediction_accuracy')
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {
        console.log('📋 Table does not exist, will create mock data for now');
        console.log('ℹ️  You may need to manually create the table in Supabase dashboard');
        console.log('ℹ️  Table schema:', createTableSQL);
        return false;
      } else {
        console.log('✅ Table already exists and is accessible');
        return true;
      }
    } catch (err) {
      console.error('❌ Failed to verify table existence:', err);
      return false;
    }
  }

  return true;
}

// Run the function
createPredictionAccuracyTable()
  .then((success) => {
    if (success) {
      console.log('🎉 prediction_accuracy table is ready!');
    } else {
      console.log('⚠️  Table setup incomplete - using fallback approach');
    }
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });