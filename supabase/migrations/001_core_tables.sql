-- Silver Fin Monitor - Core Database Schema
-- Migration 001: Core Tables (5 business + 2 infrastructure)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Feed Sources Configuration
CREATE TABLE feed_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('podcast', 'rss', 'youtube', 'api', 'multi_source')),
    url TEXT NOT NULL,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw Feed Data
CREATE TABLE raw_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    title VARCHAR(500),
    description TEXT,
    content TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    external_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_id, external_id)
);

-- Processed Content
CREATE TABLE processed_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_feed_id UUID NOT NULL REFERENCES raw_feeds(id) ON DELETE CASCADE,
    processed_text TEXT,
    key_topics TEXT[] DEFAULT '{}',
    sentiment_score FLOAT CHECK (sentiment_score BETWEEN -1 AND 1),
    entities JSONB DEFAULT '{}',
    summary TEXT,
    processing_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Market Analysis
CREATE TABLE daily_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    market_sentiment VARCHAR(50),
    key_themes TEXT[] DEFAULT '{}',
    overall_summary TEXT,
    ai_analysis JSONB DEFAULT '{}',
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    sources_analyzed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(analysis_date)
);

-- Predictions
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_analysis_id UUID REFERENCES daily_analysis(id),
    prediction_type VARCHAR(100),
    prediction_text TEXT,
    confidence_level FLOAT CHECK (confidence_level BETWEEN 0 AND 1),
    time_horizon VARCHAR(50) CHECK (time_horizon IN ('1_week', '1_month', '3_months', '6_months', '1_year')),
    prediction_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Database-Based Job Queue (replaces Bull/Redis)
CREATE TABLE job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Database-Based Simple Cache (replaces Redis)
CREATE TABLE cache_store (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_feed_sources_updated_at BEFORE UPDATE ON feed_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();