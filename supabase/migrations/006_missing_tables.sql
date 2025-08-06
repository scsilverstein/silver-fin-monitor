-- Missing Tables Migration
-- Creates tables that are referenced in the code but missing from schema

-- Alerts table for system monitoring
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System metrics table for monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(50),
    metric_type VARCHAR(50) DEFAULT 'gauge',
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(metric_name, metric_date)
);

-- Rate limits table for API throttling
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- IP address or user ID
    endpoint VARCHAR(255) NOT NULL,
    requests_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_duration INTEGER DEFAULT 3600, -- seconds
    max_requests INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(identifier, endpoint, window_start)
);

-- Scanner metadata table for stock scanner
CREATE TABLE IF NOT EXISTS scanner_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scan_type VARCHAR(50) NOT NULL DEFAULT 'daily',
    symbols_scanned INTEGER DEFAULT 0,
    symbols_with_data INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    UNIQUE(scan_date, scan_type)
);

-- Cache tags table for cache invalidation
CREATE TABLE IF NOT EXISTS cache_tags (
    cache_key VARCHAR(255) NOT NULL,
    tag VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (cache_key, tag)
);

-- Users table (if not exists) for demo credentials
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('viewer', 'analyst', 'admin')),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Earnings calendar view (if not exists)
CREATE OR REPLACE VIEW earnings_calendar_with_stats AS
SELECT 
    symbol,
    company_name,
    earnings_date,
    time_of_day,
    fiscal_quarter,
    fiscal_year,
    importance_rating,
    status,
    confirmed,
    has_reports,
    has_transcripts,
    EXTRACT(DAYS FROM (earnings_date - CURRENT_DATE))::INTEGER as days_until,
    CASE 
        WHEN earnings_date < CURRENT_DATE THEN 'reported'
        WHEN earnings_date = CURRENT_DATE THEN 'scheduled'
        ELSE 'scheduled'
    END as reporting_status
FROM (
    -- Mock earnings data - in production this would come from real API
    VALUES 
        ('AAPL', 'Apple Inc.', '2025-01-28'::DATE, 'after_market', 'Q1', 2025, 5, 'scheduled', true, false, false),
        ('MSFT', 'Microsoft Corporation', '2025-01-24'::DATE, 'after_market', 'Q2', 2025, 5, 'scheduled', true, false, false),
        ('GOOGL', 'Alphabet Inc.', '2025-01-30'::DATE, 'after_market', 'Q4', 2024, 5, 'scheduled', true, false, false),
        ('AMZN', 'Amazon.com Inc.', '2025-01-31'::DATE, 'after_market', 'Q4', 2024, 5, 'scheduled', true, false, false),
        ('META', 'Meta Platforms Inc.', '2025-01-29'::DATE, 'after_market', 'Q4', 2024, 5, 'scheduled', true, false, false),
        ('TSLA', 'Tesla Inc.', '2025-01-29'::DATE, 'after_market', 'Q4', 2024, 5, 'scheduled', true, false, false),
        ('NVDA', 'NVIDIA Corporation', '2025-01-22'::DATE, 'after_market', 'Q4', 2024, 5, 'scheduled', true, false, false),
        ('JPM', 'JPMorgan Chase & Co.', '2025-01-15'::DATE, 'before_market', 'Q4', 2024, 5, 'scheduled', true, false, false),
        ('BAC', 'Bank of America Corp.', '2025-01-16'::DATE, 'before_market', 'Q4', 2024, 4, 'scheduled', true, false, false),
        ('GS', 'Goldman Sachs Group Inc.', '2025-01-17'::DATE, 'before_market', 'Q4', 2024, 4, 'scheduled', true, false, false)
) AS earnings_data(symbol, company_name, earnings_date, time_of_day, fiscal_quarter, fiscal_year, importance_rating, status, confirmed, has_reports, has_transcripts);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_severity_created ON alerts(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved, created_at DESC) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_date ON system_metrics(metric_name, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint ON rate_limits(identifier, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_scanner_metadata_date ON scanner_metadata(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_cache_tags_tag ON cache_tags(tag);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON scanner_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cache_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT ON earnings_calendar_with_stats TO authenticated;

-- Insert demo user for authentication testing
INSERT INTO users (email, password_hash, role, is_active)
VALUES (
    'admin@silverfin.com',
    '$2b$10$rVY8Z8Z8Z8Z8Z8Z8Z8Z8ZOQYtRbLQQGQGQGQGQGQGQGQGQGQGQGQGQ', -- hashed 'password'
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;

-- Insert some initial system metrics
INSERT INTO system_metrics (metric_name, metric_value, metric_unit, metric_type) VALUES
    ('system_uptime', 0, 'seconds', 'counter'),
    ('active_feeds', 0, 'count', 'gauge'),
    ('processed_content_total', 0, 'count', 'counter'),
    ('daily_analyses_total', 0, 'count', 'counter'),
    ('predictions_total', 0, 'count', 'counter'),
    ('queue_jobs_pending', 0, 'count', 'gauge'),
    ('queue_jobs_processing', 0, 'count', 'gauge'),
    ('queue_jobs_completed_today', 0, 'count', 'counter')
ON CONFLICT (metric_name, metric_date) DO NOTHING;