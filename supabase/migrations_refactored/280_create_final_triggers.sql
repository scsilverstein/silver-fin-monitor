-- Create final system triggers
-- Complete the trigger system with remaining automation

-- Trigger function for automatic data archival
CREATE OR REPLACE FUNCTION auto_archive_trigger()
RETURNS TRIGGER AS $$
DECLARE
    archive_threshold INTERVAL;
    archive_count INTEGER;
BEGIN
    -- Determine archival threshold based on table
    CASE TG_TABLE_NAME
        WHEN 'raw_feeds' THEN
            archive_threshold := INTERVAL '180 days';
        WHEN 'processed_content' THEN
            archive_threshold := INTERVAL '365 days';
        WHEN 'stock_data' THEN
            archive_threshold := INTERVAL '2 years';
        WHEN 'news_items' THEN
            archive_threshold := INTERVAL '1 year';
        ELSE
            RETURN NEW;
    END CASE;
    
    -- Archive old records (simplified - in practice would move to archive table)
    CASE TG_TABLE_NAME
        WHEN 'raw_feeds' THEN
            DELETE FROM raw_feeds 
            WHERE created_at < NOW() - archive_threshold 
            AND processing_status = 'completed';
            GET DIAGNOSTICS archive_count = ROW_COUNT;
            
        WHEN 'processed_content' THEN
            -- Keep summaries, remove full text for old content
            UPDATE processed_content 
            SET processed_text = NULL
            WHERE created_at < NOW() - archive_threshold 
            AND processed_text IS NOT NULL;
            GET DIAGNOSTICS archive_count = ROW_COUNT;
            
        WHEN 'stock_data' THEN
            -- Keep monthly snapshots, delete daily data
            DELETE FROM stock_data 
            WHERE date < NOW() - archive_threshold 
            AND EXTRACT(day FROM date) != 1;  -- Keep 1st of month
            GET DIAGNOSTICS archive_count = ROW_COUNT;
            
        WHEN 'news_items' THEN
            DELETE FROM news_items 
            WHERE published_at < NOW() - archive_threshold 
            AND importance < 5;  -- Keep high importance news
            GET DIAGNOSTICS archive_count = ROW_COUNT;
    END CASE;
    
    -- Log archival activity
    IF archive_count > 0 THEN
        PERFORM log_application_event(
            'data_archived',
            jsonb_build_object(
                'table_name', TG_TABLE_NAME,
                'records_archived', archive_count,
                'threshold', archive_threshold
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for data quality monitoring
CREATE OR REPLACE FUNCTION data_quality_monitor()
RETURNS TRIGGER AS $$
DECLARE
    quality_score DECIMAL(5, 2);
    quality_issues JSONB := '[]';
BEGIN
    -- Assess data quality based on table
    CASE TG_TABLE_NAME
        WHEN 'stock_data' THEN
            quality_score := 100;
            
            -- Check for price anomalies
            IF NEW.close > NEW.high OR NEW.close < NEW.low THEN
                quality_score := quality_score - 20;
                quality_issues := quality_issues || jsonb_build_object(
                    'issue', 'price_inconsistency',
                    'severity', 'high'
                );
            END IF;
            
            -- Check for extreme price changes
            IF ABS(COALESCE(NEW.change_percent, 0)) > 50 THEN
                quality_score := quality_score - 15;
                quality_issues := quality_issues || jsonb_build_object(
                    'issue', 'extreme_price_change',
                    'severity', 'medium'
                );
            END IF;
            
            -- Check for zero volume
            IF NEW.volume = 0 THEN
                quality_score := quality_score - 10;
                quality_issues := quality_issues || jsonb_build_object(
                    'issue', 'zero_volume',
                    'severity', 'low'
                );
            END IF;
            
        WHEN 'processed_content' THEN
            quality_score := 100;
            
            -- Check content length
            IF LENGTH(COALESCE(NEW.processed_text, '')) < 50 THEN
                quality_score := quality_score - 25;
                quality_issues := quality_issues || jsonb_build_object(
                    'issue', 'insufficient_content',
                    'severity', 'medium'
                );
            END IF;
            
            -- Check sentiment score validity
            IF NEW.sentiment_score IS NOT NULL AND 
               (NEW.sentiment_score < -1 OR NEW.sentiment_score > 1) THEN
                quality_score := quality_score - 15;
                quality_issues := quality_issues || jsonb_build_object(
                    'issue', 'invalid_sentiment',
                    'severity', 'high'
                );
            END IF;
            
        ELSE
            RETURN NEW;
    END CASE;
    
    -- Store quality assessment if issues found
    IF quality_score < 90 THEN
        INSERT INTO data_quality_log (
            table_name,
            record_id,
            quality_score,
            quality_issues,
            created_at
        ) VALUES (
            TG_TABLE_NAME,
            COALESCE(NEW.id::TEXT, 'unknown'),
            quality_score,
            quality_issues,
            NOW()
        )
        ON CONFLICT DO NOTHING;  -- In case table doesn't exist
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for metrics collection
CREATE OR REPLACE FUNCTION collect_metrics_trigger()
RETURNS TRIGGER AS $$
DECLARE
    metric_name VARCHAR(100);
    metric_value DECIMAL(20, 4);
BEGIN
    -- Collect different metrics based on table and operation
    CASE TG_TABLE_NAME
        WHEN 'raw_feeds' THEN
            IF TG_OP = 'INSERT' THEN
                metric_name := 'feeds_ingested';
                metric_value := 1;
            END IF;
            
        WHEN 'processed_content' THEN
            IF TG_OP = 'INSERT' THEN
                metric_name := 'content_processed';
                metric_value := 1;
            END IF;
            
        WHEN 'predictions' THEN
            IF TG_OP = 'INSERT' THEN
                metric_name := 'predictions_generated';
                metric_value := 1;
            ELSIF TG_OP = 'UPDATE' AND NEW.is_evaluated = true AND OLD.is_evaluated = false THEN
                metric_name := 'predictions_evaluated';
                metric_value := NEW.accuracy_score;
            END IF;
            
        WHEN 'alerts' THEN
            IF TG_OP = 'UPDATE' AND NEW.status = 'triggered' AND OLD.status != 'triggered' THEN
                metric_name := 'alerts_triggered';
                metric_value := 1;
            END IF;
            
        WHEN 'trades' THEN
            IF TG_OP = 'INSERT' THEN
                metric_name := 'trades_executed';
                metric_value := NEW.total_amount;
            END IF;
            
        ELSE
            RETURN COALESCE(NEW, OLD);
    END CASE;
    
    -- Record metric if we have one
    IF metric_name IS NOT NULL THEN
        INSERT INTO system_metrics (
            metric_name,
            metric_value,
            metric_date,
            created_at
        ) VALUES (
            metric_name,
            metric_value,
            CURRENT_DATE,
            NOW()
        )
        ON CONFLICT (metric_name, metric_date) DO UPDATE SET
            metric_value = system_metrics.metric_value + EXCLUDED.metric_value,
            updated_at = NOW();
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for performance monitoring
CREATE OR REPLACE FUNCTION performance_monitor_trigger()
RETURNS TRIGGER AS $$
DECLARE
    processing_time INTERVAL;
    performance_threshold INTERVAL;
BEGIN
    -- Monitor processing times for specific operations
    CASE TG_TABLE_NAME
        WHEN 'processed_content' THEN
            IF OLD IS NOT NULL AND OLD.created_at IS NOT NULL THEN
                processing_time := NOW() - OLD.created_at;
                performance_threshold := INTERVAL '5 minutes';
                
                IF processing_time > performance_threshold THEN
                    PERFORM enqueue_job(
                        'performance_alert',
                        jsonb_build_object(
                            'type', 'slow_content_processing',
                            'processing_time', EXTRACT(EPOCH FROM processing_time),
                            'threshold', EXTRACT(EPOCH FROM performance_threshold),
                            'content_id', NEW.id
                        ),
                        1  -- High priority
                    );
                END IF;
            END IF;
            
        WHEN 'daily_analysis' THEN
            IF NEW.sources_analyzed IS NOT NULL THEN
                -- Alert if analysis is based on too few sources
                IF NEW.sources_analyzed < 3 THEN
                    PERFORM enqueue_job(
                        'data_quality_alert',
                        jsonb_build_object(
                            'type', 'insufficient_sources',
                            'sources_analyzed', NEW.sources_analyzed,
                            'analysis_date', NEW.analysis_date
                        ),
                        2  -- Medium priority
                    );
                END IF;
            END IF;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply final triggers with conditions to avoid conflicts
DO $$
BEGIN
    -- Apply archival trigger (only on insert to avoid constant triggers)
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_archive_raw_feeds') THEN
        CREATE TRIGGER auto_archive_raw_feeds
            AFTER INSERT ON raw_feeds
            FOR EACH STATEMENT EXECUTE FUNCTION auto_archive_trigger();
    END IF;
    
    -- Apply data quality monitoring
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'data_quality_stock_data') THEN
        CREATE TRIGGER data_quality_stock_data
            AFTER INSERT OR UPDATE ON stock_data
            FOR EACH ROW EXECUTE FUNCTION data_quality_monitor();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'data_quality_processed_content') THEN
        CREATE TRIGGER data_quality_processed_content
            AFTER INSERT OR UPDATE ON processed_content
            FOR EACH ROW EXECUTE FUNCTION data_quality_monitor();
    END IF;
    
    -- Apply metrics collection
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'collect_metrics_predictions') THEN
        CREATE TRIGGER collect_metrics_predictions
            AFTER INSERT OR UPDATE ON predictions
            FOR EACH ROW EXECUTE FUNCTION collect_metrics_trigger();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'collect_metrics_alerts') THEN
        CREATE TRIGGER collect_metrics_alerts
            AFTER INSERT OR UPDATE ON alerts
            FOR EACH ROW EXECUTE FUNCTION collect_metrics_trigger();
    END IF;
    
    -- Apply performance monitoring
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'performance_monitor_content') THEN
        CREATE TRIGGER performance_monitor_content
            AFTER UPDATE ON processed_content
            FOR EACH ROW EXECUTE FUNCTION performance_monitor_trigger();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'performance_monitor_analysis') THEN
        CREATE TRIGGER performance_monitor_analysis
            AFTER INSERT ON daily_analysis
            FOR EACH ROW EXECUTE FUNCTION performance_monitor_trigger();
    END IF;
END $$;

-- Add final trigger comments
COMMENT ON FUNCTION auto_archive_trigger IS 'Automatically archive old data based on retention policies';
COMMENT ON FUNCTION data_quality_monitor IS 'Monitor data quality and log issues';
COMMENT ON FUNCTION collect_metrics_trigger IS 'Collect system metrics for monitoring';
COMMENT ON FUNCTION performance_monitor_trigger IS 'Monitor performance and alert on issues';