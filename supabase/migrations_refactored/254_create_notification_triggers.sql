-- Create notification triggers
-- Triggers for automated notifications and alerts

-- Trigger function for cache invalidation
CREATE OR REPLACE FUNCTION invalidate_cache_trigger()
RETURNS TRIGGER AS $$
DECLARE
    cache_keys TEXT[];
    cache_key TEXT;
BEGIN
    -- Determine cache keys to invalidate based on table and operation
    CASE TG_TABLE_NAME
        WHEN 'stock_data' THEN
            cache_keys := ARRAY[
                'stock:' || COALESCE(NEW.symbol, OLD.symbol),
                'stock:latest:' || COALESCE(NEW.symbol, OLD.symbol),
                'dashboard:stock_data',
                'market:summary'
            ];
            
        WHEN 'daily_analysis' THEN
            cache_keys := ARRAY[
                'analysis:' || COALESCE(NEW.analysis_date::TEXT, OLD.analysis_date::TEXT),
                'analysis:latest',
                'dashboard:analysis'
            ];
            
        WHEN 'predictions' THEN
            cache_keys := ARRAY[
                'predictions:latest',
                'dashboard:predictions'
            ];
            
        WHEN 'entities' THEN
            cache_keys := ARRAY[
                'entity:' || COALESCE(NEW.id::TEXT, OLD.id::TEXT),
                'entities:search',
                'dashboard:entities'
            ];
            
        WHEN 'portfolio_holdings' THEN
            cache_keys := ARRAY[
                'portfolio:' || COALESCE(NEW.portfolio_id::TEXT, OLD.portfolio_id::TEXT),
                'holdings:' || COALESCE(NEW.user_id::TEXT, OLD.user_id::TEXT)
            ];
            
        ELSE
            cache_keys := ARRAY['dashboard:general'];
    END CASE;
    
    -- Invalidate each cache key
    FOREACH cache_key IN ARRAY cache_keys LOOP
        PERFORM cache_delete(cache_key);
    END LOOP;
    
    -- Return appropriate record
    CASE TG_OP
        WHEN 'INSERT', 'UPDATE' THEN
            RETURN NEW;
        WHEN 'DELETE' THEN
            RETURN OLD;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for alert notifications
CREATE OR REPLACE FUNCTION alert_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
    notification_channels JSONB;
    channel TEXT;
    notification_data JSONB;
BEGIN
    -- Only process when alert is triggered
    IF NEW.status = 'triggered' AND (OLD.status IS NULL OR OLD.status != 'triggered') THEN
        
        -- Get notification channels from metadata
        notification_channels := COALESCE(NEW.metadata->'notification_channels', '["system"]');
        
        -- Prepare notification data
        notification_data := jsonb_build_object(
            'alert_id', NEW.id,
            'alert_type', NEW.alert_type,
            'symbol', NEW.symbol,
            'alert_name', NEW.alert_name,
            'conditions', NEW.conditions,
            'triggered_at', NEW.last_triggered_at,
            'user_id', NEW.user_id
        );
        
        -- Queue notifications for each channel
        FOR channel IN SELECT jsonb_array_elements_text(notification_channels) LOOP
            PERFORM enqueue_job(
                'send_notification',
                jsonb_build_object(
                    'channel', channel,
                    'type', 'alert_triggered',
                    'data', notification_data
                ),
                1  -- High priority
            );
        END LOOP;
        
        -- Update metadata to track notification sent
        NEW.metadata := COALESCE(NEW.metadata, '{}') || 
                       jsonb_build_object('notification_sent_at', NOW());
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for portfolio rebalancing notifications
CREATE OR REPLACE FUNCTION portfolio_rebalancing_trigger()
RETURNS TRIGGER AS $$
DECLARE
    portfolio_value DECIMAL(20, 2);
    allocation_percentage DECIMAL(5, 2);
    threshold_percentage DECIMAL(5, 2) := 5.0; -- 5% threshold
BEGIN
    -- Only check on updates
    IF TG_OP = 'UPDATE' THEN
        -- Get total portfolio value
        SELECT SUM(position_value) INTO portfolio_value
        FROM portfolio_holdings 
        WHERE portfolio_id = NEW.portfolio_id;
        
        IF portfolio_value > 0 THEN
            -- Calculate new allocation percentage
            allocation_percentage := (NEW.position_value / portfolio_value) * 100;
            
            -- Check if allocation has changed significantly
            IF ABS(allocation_percentage - COALESCE((OLD.position_value / portfolio_value) * 100, 0)) > threshold_percentage THEN
                -- Queue rebalancing notification
                PERFORM enqueue_job(
                    'portfolio_rebalancing_check',
                    jsonb_build_object(
                        'portfolio_id', NEW.portfolio_id,
                        'user_id', NEW.user_id,
                        'symbol', NEW.symbol,
                        'new_allocation', allocation_percentage,
                        'trigger', 'allocation_change'
                    ),
                    3  -- Medium priority
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for earnings date notifications
CREATE OR REPLACE FUNCTION earnings_notification_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify about new earnings data
    IF TG_OP = 'INSERT' THEN
        PERFORM enqueue_job(
            'earnings_notification',
            jsonb_build_object(
                'symbol', NEW.symbol,
                'report_date', NEW.report_date,
                'surprise_percent', NEW.surprise_percent,
                'actual_eps', NEW.actual_eps,
                'estimated_eps', NEW.estimated_eps
            ),
            2  -- Medium-high priority
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for news analysis notifications
CREATE OR REPLACE FUNCTION news_analysis_trigger()
RETURNS TRIGGER AS $$
DECLARE
    symbol TEXT;
BEGIN
    -- Process news items with high importance or strong sentiment
    IF NEW.importance > 8 OR ABS(COALESCE(NEW.sentiment_score, 0)) > 0.8 THEN
        -- Extract symbols from the news
        IF array_length(NEW.symbols, 1) > 0 THEN
            FOREACH symbol IN ARRAY NEW.symbols LOOP
                PERFORM enqueue_job(
                    'high_impact_news',
                    jsonb_build_object(
                        'symbol', symbol,
                        'title', NEW.title,
                        'sentiment_score', NEW.sentiment_score,
                        'importance', NEW.importance,
                        'published_at', NEW.published_at,
                        'source', NEW.source
                    ),
                    2  -- Medium-high priority
                );
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for system health monitoring
CREATE OR REPLACE FUNCTION system_health_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Monitor job queue for stuck or failed jobs
    IF TG_TABLE_NAME = 'job_queue' THEN
        -- Alert on high failure rate
        IF NEW.status = 'failed' THEN
            -- Check if failure rate is high in last hour
            PERFORM enqueue_job(
                'system_health_check',
                jsonb_build_object(
                    'type', 'job_failure',
                    'job_type', NEW.job_type,
                    'error_message', NEW.error_message,
                    'timestamp', NOW()
                ),
                1  -- High priority
            );
        END IF;
        
        -- Alert on stuck processing jobs
        IF NEW.status = 'processing' AND NEW.started_at < NOW() - INTERVAL '1 hour' THEN
            PERFORM enqueue_job(
                'system_health_check',
                jsonb_build_object(
                    'type', 'stuck_job',
                    'job_id', NEW.id,
                    'job_type', NEW.job_type,
                    'started_at', NEW.started_at
                ),
                1  -- High priority
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply cache invalidation triggers
CREATE TRIGGER invalidate_cache_stock_data
    AFTER INSERT OR UPDATE OR DELETE ON stock_data
    FOR EACH ROW EXECUTE FUNCTION invalidate_cache_trigger();

CREATE TRIGGER invalidate_cache_daily_analysis
    AFTER INSERT OR UPDATE OR DELETE ON daily_analysis
    FOR EACH ROW EXECUTE FUNCTION invalidate_cache_trigger();

CREATE TRIGGER invalidate_cache_predictions
    AFTER INSERT OR UPDATE OR DELETE ON predictions
    FOR EACH ROW EXECUTE FUNCTION invalidate_cache_trigger();

CREATE TRIGGER invalidate_cache_entities
    AFTER INSERT OR UPDATE OR DELETE ON entities
    FOR EACH ROW EXECUTE FUNCTION invalidate_cache_trigger();

CREATE TRIGGER invalidate_cache_portfolio_holdings
    AFTER INSERT OR UPDATE OR DELETE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION invalidate_cache_trigger();

-- Apply notification triggers
CREATE TRIGGER alert_notification
    BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION alert_notification_trigger();

CREATE TRIGGER portfolio_rebalancing_notification
    AFTER UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION portfolio_rebalancing_trigger();

CREATE TRIGGER earnings_notification
    AFTER INSERT ON earnings_data
    FOR EACH ROW EXECUTE FUNCTION earnings_notification_trigger();

CREATE TRIGGER news_analysis_notification
    AFTER INSERT OR UPDATE ON news_items
    FOR EACH ROW EXECUTE FUNCTION news_analysis_trigger();

CREATE TRIGGER system_health_monitoring
    AFTER INSERT OR UPDATE ON job_queue
    FOR EACH ROW EXECUTE FUNCTION system_health_trigger();

-- Add trigger comments
COMMENT ON FUNCTION invalidate_cache_trigger IS 'Invalidate relevant cache entries when data changes';
COMMENT ON FUNCTION alert_notification_trigger IS 'Send notifications when alerts are triggered';
COMMENT ON FUNCTION portfolio_rebalancing_trigger IS 'Check for portfolio rebalancing needs';
COMMENT ON FUNCTION earnings_notification_trigger IS 'Notify about new earnings data';
COMMENT ON FUNCTION news_analysis_trigger IS 'Process high-impact news items';
COMMENT ON FUNCTION system_health_trigger IS 'Monitor system health and alert on issues';

COMMENT ON TRIGGER invalidate_cache_stock_data ON stock_data IS 'Invalidate stock data cache on changes';
COMMENT ON TRIGGER invalidate_cache_daily_analysis ON daily_analysis IS 'Invalidate analysis cache on changes';
COMMENT ON TRIGGER invalidate_cache_predictions ON predictions IS 'Invalidate predictions cache on changes';
COMMENT ON TRIGGER invalidate_cache_entities ON entities IS 'Invalidate entities cache on changes';
COMMENT ON TRIGGER invalidate_cache_portfolio_holdings ON portfolio_holdings IS 'Invalidate portfolio cache on changes';

COMMENT ON TRIGGER alert_notification ON alerts IS 'Send notifications for triggered alerts';
COMMENT ON TRIGGER portfolio_rebalancing_notification ON portfolio_holdings IS 'Check portfolio rebalancing needs';
COMMENT ON TRIGGER earnings_notification ON earnings_data IS 'Process new earnings data';
COMMENT ON TRIGGER news_analysis_notification ON news_items IS 'Process high-impact news';
COMMENT ON TRIGGER system_health_monitoring ON job_queue IS 'Monitor system health via job queue';