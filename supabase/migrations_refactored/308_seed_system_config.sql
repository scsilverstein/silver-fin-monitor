-- Seed system configuration
-- System-wide configuration settings and parameters

-- Insert system configuration settings
INSERT INTO system_config (category, key, value, description, is_public) VALUES
-- Application Settings
('app', 'version', '"1.0.0"', 'Current application version', true),
('app', 'environment', '"production"', 'Current environment', true),
('app', 'maintenance_mode', 'false', 'Enable maintenance mode', false),
('app', 'feature_flags', '{"options_trading": true, "crypto_tracking": false, "ml_predictions": true}', 'Feature toggle flags', false),

-- API Configuration
('api', 'rate_limit_requests', '1000', 'API rate limit requests per hour', false),
('api', 'rate_limit_window', '3600', 'API rate limit window in seconds', false),
('api', 'max_request_size', '10485760', 'Maximum API request size in bytes (10MB)', false),
('api', 'timeout_seconds', '30', 'API request timeout in seconds', false),
('api', 'cors_origins', '["https://silverfinmonitor.com", "https://app.silverfinmonitor.com"]', 'Allowed CORS origins', false),

-- Database Settings
('database', 'connection_pool_size', '20', 'Database connection pool size', false),
('database', 'query_timeout', '30000', 'Database query timeout in milliseconds', false),
('database', 'backup_retention_days', '30', 'Database backup retention period', false),
('database', 'vacuum_schedule', '"0 2 * * 0"', 'Weekly vacuum schedule (cron format)', false),

-- Queue Configuration
('queue', 'default_priority', '5', 'Default job priority (1-10)', false),
('queue', 'max_retries', '3', 'Maximum job retry attempts', false),
('queue', 'retry_delay_base', '1000', 'Base retry delay in milliseconds', false),
('queue', 'cleanup_interval', '3600', 'Job cleanup interval in seconds', false),
('queue', 'max_concurrent_jobs', '10', 'Maximum concurrent job processing', false),

-- Cache Settings
('cache', 'default_ttl', '3600', 'Default cache TTL in seconds', false),
('cache', 'max_memory_mb', '1024', 'Maximum cache memory usage in MB', false),
('cache', 'cleanup_interval', '300', 'Cache cleanup interval in seconds', false),
('cache', 'compression_enabled', 'true', 'Enable cache compression', false),

-- Feed Processing Configuration
('feeds', 'update_interval_default', '3600', 'Default feed update interval in seconds', false),
('feeds', 'update_interval_high_priority', '900', 'High priority feed interval in seconds', false),
('feeds', 'content_processing_timeout', '300', 'Content processing timeout in seconds', false),
('feeds', 'max_content_length', '50000', 'Maximum content length for processing', false),
('feeds', 'duplicate_detection_window', '86400', 'Duplicate detection window in seconds', false),

-- AI and Analysis Settings
('ai', 'openai_model_primary', '"gpt-4"', 'Primary OpenAI model for analysis', false),
('ai', 'openai_model_fallback', '"gpt-3.5-turbo"', 'Fallback OpenAI model', false),
('ai', 'max_tokens_analysis', '4000', 'Maximum tokens for analysis requests', false),
('ai', 'temperature', '0.1', 'AI model temperature setting', false),
('ai', 'confidence_threshold', '0.7', 'Minimum confidence threshold for predictions', false),
('ai', 'daily_analysis_time', '"06:00"', 'Daily analysis generation time (UTC)', false),

-- Market Data Settings
('market_data', 'trading_hours_start', '"09:30"', 'Market opening time (EST)', true),
('market_data', 'trading_hours_end', '"16:00"', 'Market closing time (EST)', true),
('market_data', 'weekend_updates', 'false', 'Enable weekend data updates', false),
('market_data', 'premarket_hours', 'true', 'Include pre-market data', true),
('market_data', 'afterhours_updates', 'true', 'Include after-hours data', true),

-- Alert System Configuration
('alerts', 'max_alerts_per_user', '100', 'Maximum alerts per user', false),
('alerts', 'default_cooldown_minutes', '60', 'Default alert cooldown period', false),
('alerts', 'batch_processing_size', '50', 'Alert batch processing size', false),
('alerts', 'email_rate_limit', '10', 'Email alerts per hour per user', false),
('alerts', 'push_notification_enabled', 'true', 'Enable push notifications', false),

-- Security Settings
('security', 'jwt_expiry_hours', '24', 'JWT token expiry in hours', false),
('security', 'password_min_length', '8', 'Minimum password length', false),
('security', 'session_timeout_minutes', '480', 'User session timeout in minutes', false),
('security', 'max_login_attempts', '5', 'Maximum login attempts before lockout', false),
('security', 'lockout_duration_minutes', '30', 'Account lockout duration', false),

-- Monitoring and Logging
('monitoring', 'log_level', '"info"', 'Application log level', false),
('monitoring', 'metrics_retention_days', '90', 'Metrics data retention period', false),
('monitoring', 'health_check_interval', '60', 'Health check interval in seconds', false),
('monitoring', 'error_notification_threshold', '10', 'Error count threshold for notifications', false),

-- Data Retention Policies
('retention', 'raw_feeds_days', '180', 'Raw feeds retention period in days', false),
('retention', 'processed_content_days', '365', 'Processed content retention period', false),
('retention', 'stock_data_years', '5', 'Stock data retention period in years', false),
('retention', 'predictions_days', '730', 'Predictions retention period in days', false),
('retention', 'audit_logs_days', '2555', 'Audit logs retention period (7 years)', false),

-- Performance Thresholds
('performance', 'api_response_time_ms', '500', 'Target API response time in milliseconds', false),
('performance', 'page_load_time_ms', '3000', 'Target page load time in milliseconds', false),
('performance', 'database_query_time_ms', '1000', 'Database query performance threshold', false),
('performance', 'feed_processing_time_s', '300', 'Feed processing time threshold in seconds', false),

-- Business Logic Settings
('business', 'min_prediction_confidence', '0.6', 'Minimum confidence for public predictions', true),
('business', 'max_portfolio_positions', '50', 'Maximum positions per portfolio', true),
('business', 'default_watchlist_size', '25', 'Default watchlist size limit', true),
('business', 'sentiment_analysis_window', '7', 'Sentiment analysis window in days', true),

-- Integration Settings
('integrations', 'webhook_timeout_seconds', '30', 'Webhook request timeout', false),
('integrations', 'api_key_rotation_days', '90', 'API key rotation period', false),
('integrations', 'external_data_cache_hours', '4', 'External data cache duration', false),

-- Notification Settings
('notifications', 'email_from_address', '"noreply@silverfinmonitor.com"', 'Email sender address', false),
('notifications', 'email_from_name', '"Silver Fin Monitor"', 'Email sender name', false),
('notifications', 'support_email', '"support@silverfinmonitor.com"', 'Support contact email', true),
('notifications', 'daily_digest_time', '"08:00"', 'Daily digest email time (user timezone)', false),

-- Analytics and Tracking
('analytics', 'user_activity_tracking', 'true', 'Enable user activity tracking', false),
('analytics', 'performance_tracking', 'true', 'Enable performance analytics', false),
('analytics', 'prediction_accuracy_tracking', 'true', 'Track prediction accuracy metrics', false),
('analytics', 'anonymize_user_data', 'true', 'Anonymize user data in analytics', false),

-- Experimental Features
('experimental', 'ai_model_ensemble', 'false', 'Enable AI model ensemble for predictions', false),
('experimental', 'real_time_sentiment', 'false', 'Enable real-time sentiment analysis', false),
('experimental', 'options_scanner', 'true', 'Enable options flow scanner', false),
('experimental', 'crypto_integration', 'false', 'Enable cryptocurrency tracking', false),

-- System Limits
('limits', 'max_concurrent_users', '1000', 'Maximum concurrent users', false),
('limits', 'max_api_calls_per_minute', '100', 'API calls per minute per user', false),
('limits', 'max_file_upload_mb', '50', 'Maximum file upload size in MB', false),
('limits', 'max_search_results', '100', 'Maximum search results per query', false)

ON CONFLICT (category, key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

-- Insert default user roles and permissions
INSERT INTO user_roles (name, description, permissions, is_default) VALUES
('viewer', 'Read-only access to public data and personal portfolios',
 jsonb_build_object(
   'read', ARRAY['dashboard', 'market_data', 'analysis', 'predictions', 'own_portfolio'],
   'write', ARRAY['own_portfolio', 'watchlists', 'alerts'],
   'admin', ARRAY[]::TEXT[]
 ), true),

('trader', 'Enhanced access with trading capabilities and advanced analytics',
 jsonb_build_object(
   'read', ARRAY['dashboard', 'market_data', 'analysis', 'predictions', 'own_portfolio', 'advanced_charts', 'options_data'],
   'write', ARRAY['own_portfolio', 'watchlists', 'alerts', 'trades', 'trading_strategies'],
   'admin', ARRAY[]::TEXT[]
 ), false),

('analyst', 'Professional access with research tools and custom alerts',
 jsonb_build_object(
   'read', ARRAY['dashboard', 'market_data', 'analysis', 'predictions', 'portfolios', 'advanced_charts', 'options_data', 'research_tools'],
   'write', ARRAY['portfolios', 'watchlists', 'alerts', 'trades', 'trading_strategies', 'custom_analysis'],
   'admin', ARRAY[]::TEXT[]
 ), false),

('premium', 'Full access to all features and real-time data',
 jsonb_build_object(
   'read', ARRAY['dashboard', 'market_data', 'analysis', 'predictions', 'portfolios', 'advanced_charts', 'options_data', 'research_tools', 'real_time_data'],
   'write', ARRAY['portfolios', 'watchlists', 'alerts', 'trades', 'trading_strategies', 'custom_analysis', 'api_access'],
   'admin', ARRAY[]::TEXT[]
 ), false),

('admin', 'Full system administration access',
 jsonb_build_object(
   'read', ARRAY['*'],
   'write', ARRAY['*'],
   'admin', ARRAY['user_management', 'system_config', 'feed_management', 'analytics']
 ), false)

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- Insert system notification templates
INSERT INTO notification_templates (name, type, subject_template, body_template, variables) VALUES
('welcome_email', 'email', 'Welcome to Silver Fin Monitor!',
 'Hi {{user_name}},\n\nWelcome to Silver Fin Monitor! Your account has been successfully created.\n\nYou can now:\n- Track your favorite stocks\n- Set up custom alerts\n- View AI-powered market analysis\n- Create and manage portfolios\n\nBest regards,\nThe Silver Fin Monitor Team',
 ARRAY['user_name', 'user_email']),

('alert_notification', 'email', 'Alert: {{alert_title}}',
 'Alert triggered for {{symbol}}:\n\n{{alert_message}}\n\nCurrent Price: ${{current_price}}\nChange: {{change_percent}}%\n\nTriggered at: {{timestamp}}\n\nView details: {{dashboard_link}}',
 ARRAY['alert_title', 'symbol', 'alert_message', 'current_price', 'change_percent', 'timestamp', 'dashboard_link']),

('daily_digest', 'email', 'Your Daily Market Digest - {{date}}',
 'Good morning {{user_name}},\n\nHere''s your daily market summary:\n\n{{market_summary}}\n\n**Your Watchlist Updates:**\n{{watchlist_updates}}\n\n**Active Alerts:**\n{{active_alerts}}\n\n**Top Predictions:**\n{{top_predictions}}\n\nHave a great trading day!\n\nBest regards,\nSilver Fin Monitor',
 ARRAY['user_name', 'date', 'market_summary', 'watchlist_updates', 'active_alerts', 'top_predictions']),

('system_maintenance', 'email', 'Scheduled Maintenance Notification',
 'Dear {{user_name}},\n\nWe will be performing scheduled maintenance on {{maintenance_date}} from {{start_time}} to {{end_time}} UTC.\n\nDuring this time, the system will be temporarily unavailable.\n\n**What to expect:**\n- Brief service interruption\n- No data loss\n- Improved performance after completion\n\nWe apologize for any inconvenience.\n\nBest regards,\nSilver Fin Monitor Team',
 ARRAY['user_name', 'maintenance_date', 'start_time', 'end_time'])

ON CONFLICT (name, type) DO UPDATE SET
    subject_template = EXCLUDED.subject_template,
    body_template = EXCLUDED.body_template,
    variables = EXCLUDED.variables,
    updated_at = NOW();

-- Add table comments
COMMENT ON TABLE system_config IS 'System-wide configuration settings and parameters';
COMMENT ON TABLE user_roles IS 'User roles and their associated permissions';
COMMENT ON TABLE notification_templates IS 'Templates for system notifications and emails';