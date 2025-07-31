-- Create audit triggers
-- Triggers for maintaining audit trails and data integrity

-- Trigger function for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_data JSONB;
    table_name TEXT;
BEGIN
    table_name := TG_TABLE_NAME;
    
    -- Prepare audit data based on operation
    CASE TG_OP
        WHEN 'INSERT' THEN
            audit_data := jsonb_build_object(
                'operation', 'INSERT',
                'table_name', table_name,
                'new_data', to_jsonb(NEW),
                'timestamp', NOW(),
                'user_id', COALESCE(current_setting('app.user_id', true), 'system')
            );
            
        WHEN 'UPDATE' THEN
            audit_data := jsonb_build_object(
                'operation', 'UPDATE',
                'table_name', table_name,
                'old_data', to_jsonb(OLD),
                'new_data', to_jsonb(NEW),
                'timestamp', NOW(),
                'user_id', COALESCE(current_setting('app.user_id', true), 'system')
            );
            
        WHEN 'DELETE' THEN
            audit_data := jsonb_build_object(
                'operation', 'DELETE',
                'table_name', table_name,
                'old_data', to_jsonb(OLD),
                'timestamp', NOW(),
                'user_id', COALESCE(current_setting('app.user_id', true), 'system')
            );
    END CASE;
    
    -- Insert into audit log table (if it exists)
    BEGIN
        INSERT INTO audit_log (audit_data) VALUES (audit_data);
    EXCEPTION 
        WHEN undefined_table THEN
            -- Audit table doesn't exist, skip logging
            NULL;
    END;
    
    -- Return appropriate record
    CASE TG_OP
        WHEN 'INSERT', 'UPDATE' THEN
            RETURN NEW;
        WHEN 'DELETE' THEN
            RETURN OLD;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables with updated_at columns
CREATE TRIGGER update_entities_updated_at
    BEFORE UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_sources_updated_at
    BEFORE UPDATE ON feed_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processed_content_updated_at
    BEFORE UPDATE ON processed_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watchlists_updated_at
    BEFORE UPDATE ON watchlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at
    BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_holdings_updated_at
    BEFORE UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_research_reports_updated_at
    BEFORE UPDATE ON research_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_entities_changes
    AFTER INSERT OR UPDATE OR DELETE ON entities
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_portfolios_changes
    AFTER INSERT OR UPDATE OR DELETE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_portfolio_holdings_changes
    AFTER INSERT OR UPDATE OR DELETE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trades_changes
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_alerts_changes
    AFTER INSERT OR UPDATE OR DELETE ON alerts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Add trigger comments
COMMENT ON FUNCTION update_updated_at_column IS 'Automatically update updated_at timestamp on row changes';
COMMENT ON FUNCTION audit_trigger_function IS 'General purpose audit logging trigger function';

COMMENT ON TRIGGER update_entities_updated_at ON entities IS 'Update entities.updated_at on changes';
COMMENT ON TRIGGER update_feed_sources_updated_at ON feed_sources IS 'Update feed_sources.updated_at on changes';
COMMENT ON TRIGGER update_processed_content_updated_at ON processed_content IS 'Update processed_content.updated_at on changes';
COMMENT ON TRIGGER update_watchlists_updated_at ON watchlists IS 'Update watchlists.updated_at on changes';
COMMENT ON TRIGGER update_alerts_updated_at ON alerts IS 'Update alerts.updated_at on changes';
COMMENT ON TRIGGER update_portfolios_updated_at ON portfolios IS 'Update portfolios.updated_at on changes';
COMMENT ON TRIGGER update_portfolio_holdings_updated_at ON portfolio_holdings IS 'Update portfolio_holdings.updated_at on changes';
COMMENT ON TRIGGER update_research_reports_updated_at ON research_reports IS 'Update research_reports.updated_at on changes';

COMMENT ON TRIGGER audit_entities_changes ON entities IS 'Audit all changes to entities table';
COMMENT ON TRIGGER audit_portfolios_changes ON portfolios IS 'Audit all changes to portfolios table';
COMMENT ON TRIGGER audit_portfolio_holdings_changes ON portfolio_holdings IS 'Audit all changes to portfolio_holdings table';
COMMENT ON TRIGGER audit_trades_changes ON trades IS 'Audit all changes to trades table';
COMMENT ON TRIGGER audit_alerts_changes ON alerts IS 'Audit all changes to alerts table';