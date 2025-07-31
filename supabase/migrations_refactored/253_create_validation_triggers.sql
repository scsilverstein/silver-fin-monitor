-- Create validation triggers
-- Triggers for data validation and business rule enforcement

-- Trigger function to validate stock data
CREATE OR REPLACE FUNCTION validate_stock_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate price values are positive
    IF NEW.open <= 0 OR NEW.high <= 0 OR NEW.low <= 0 OR NEW.close <= 0 THEN
        RAISE EXCEPTION 'Stock prices must be positive values';
    END IF;
    
    -- Validate high >= low
    IF NEW.high < NEW.low THEN
        RAISE EXCEPTION 'High price cannot be less than low price';
    END IF;
    
    -- Validate high and low are within reasonable range of open/close
    IF NEW.high < GREATEST(NEW.open, NEW.close) OR NEW.low > LEAST(NEW.open, NEW.close) THEN
        RAISE EXCEPTION 'High/low prices must contain open/close prices';
    END IF;
    
    -- Validate volume is non-negative
    IF NEW.volume < 0 THEN
        RAISE EXCEPTION 'Volume cannot be negative';
    END IF;
    
    -- Calculate and set percentage change if missing
    IF NEW.change_percent IS NULL AND OLD IS NOT NULL AND OLD.close > 0 THEN
        NEW.change_percent := (NEW.close - OLD.close) / OLD.close * 100;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate portfolio holdings
CREATE OR REPLACE FUNCTION validate_portfolio_holdings()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate quantity is non-negative
    IF NEW.quantity < 0 THEN
        RAISE EXCEPTION 'Portfolio holding quantity cannot be negative';
    END IF;
    
    -- Validate cost basis is positive
    IF NEW.cost_basis <= 0 THEN
        RAISE EXCEPTION 'Cost basis must be positive';
    END IF;
    
    -- Calculate position value if missing
    IF NEW.position_value IS NULL THEN
        -- Get current stock price
        SELECT close * NEW.quantity INTO NEW.position_value
        FROM stock_data 
        WHERE symbol = NEW.symbol 
        ORDER BY date DESC 
        LIMIT 1;
    END IF;
    
    -- Calculate unrealized P&L
    IF NEW.position_value IS NOT NULL THEN
        NEW.unrealized_pnl := NEW.position_value - (NEW.cost_basis * NEW.quantity);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate trades
CREATE OR REPLACE FUNCTION validate_trades()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate trade type
    IF NEW.trade_type NOT IN ('buy', 'sell', 'short', 'cover') THEN
        RAISE EXCEPTION 'Invalid trade type: %', NEW.trade_type;
    END IF;
    
    -- Validate quantity is positive
    IF NEW.quantity <= 0 THEN
        RAISE EXCEPTION 'Trade quantity must be positive';
    END IF;
    
    -- Validate price is positive
    IF NEW.price <= 0 THEN
        RAISE EXCEPTION 'Trade price must be positive';
    END IF;
    
    -- Calculate total amount if missing
    IF NEW.total_amount IS NULL THEN
        NEW.total_amount := NEW.quantity * NEW.price;
    END IF;
    
    -- Add commission to total for buy orders, subtract for sell orders
    IF NEW.commission IS NOT NULL THEN
        IF NEW.trade_type IN ('buy', 'short') THEN
            NEW.total_amount := NEW.total_amount + NEW.commission;
        ELSE
            NEW.total_amount := NEW.total_amount - NEW.commission;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate feed sources
CREATE OR REPLACE FUNCTION validate_feed_sources()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate URL format
    IF NEW.url IS NOT NULL AND NOT (NEW.url ~* '^https?://.*') THEN
        RAISE EXCEPTION 'Feed URL must be a valid HTTP/HTTPS URL';
    END IF;
    
    -- Validate feed type
    IF NEW.type NOT IN ('rss', 'podcast', 'youtube', 'api', 'multi_source') THEN
        RAISE EXCEPTION 'Invalid feed type: %', NEW.type;
    END IF;
    
    -- Validate priority
    IF NEW.priority NOT IN ('low', 'medium', 'high') THEN
        RAISE EXCEPTION 'Invalid priority level: %', NEW.priority;
    END IF;
    
    -- Set default update frequency if missing
    IF NEW.update_frequency IS NULL THEN
        NEW.update_frequency := '4 hours';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate entities
CREATE OR REPLACE FUNCTION validate_entities()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate entity type
    IF NEW.entity_type NOT IN ('stock', 'company', 'person', 'location', 'event', 'concept') THEN
        RAISE EXCEPTION 'Invalid entity type: %', NEW.entity_type;
    END IF;
    
    -- For stock entities, symbol is required
    IF NEW.entity_type = 'stock' AND (NEW.symbol IS NULL OR LENGTH(TRIM(NEW.symbol)) = 0) THEN
        RAISE EXCEPTION 'Stock entities must have a symbol';
    END IF;
    
    -- Normalize symbol to uppercase
    IF NEW.symbol IS NOT NULL THEN
        NEW.symbol := UPPER(TRIM(NEW.symbol));
    END IF;
    
    -- Normalize name
    IF NEW.name IS NOT NULL THEN
        NEW.name := TRIM(NEW.name);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate predictions
CREATE OR REPLACE FUNCTION validate_predictions()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate confidence level
    IF NEW.confidence_level IS NOT NULL AND (NEW.confidence_level < 0 OR NEW.confidence_level > 100) THEN
        RAISE EXCEPTION 'Confidence level must be between 0 and 100';
    END IF;
    
    -- Validate time horizon
    IF NEW.time_horizon NOT IN ('1_week', '1_month', '3_months', '6_months', '1_year') THEN
        RAISE EXCEPTION 'Invalid time horizon: %', NEW.time_horizon;
    END IF;
    
    -- Validate prediction type
    IF NEW.prediction_type IS NULL OR LENGTH(TRIM(NEW.prediction_type)) = 0 THEN
        RAISE EXCEPTION 'Prediction type is required';
    END IF;
    
    -- Validate prediction text
    IF NEW.prediction_text IS NULL OR LENGTH(TRIM(NEW.prediction_text)) < 10 THEN
        RAISE EXCEPTION 'Prediction text must be at least 10 characters';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate alerts
CREATE OR REPLACE FUNCTION validate_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate alert type
    IF NEW.alert_type NOT IN ('price', 'volume', 'change_percent', 'sentiment', 'news', 'technical') THEN
        RAISE EXCEPTION 'Invalid alert type: %', NEW.alert_type;
    END IF;
    
    -- Validate status
    IF NEW.status NOT IN ('pending', 'triggered', 'resolved', 'disabled') THEN
        RAISE EXCEPTION 'Invalid alert status: %', NEW.status;
    END IF;
    
    -- Validate conditions JSON has required fields
    IF NEW.conditions IS NULL OR NOT (NEW.conditions ? 'threshold') THEN
        RAISE EXCEPTION 'Alert conditions must include threshold value';
    END IF;
    
    -- For price/volume alerts, symbol is required
    IF NEW.alert_type IN ('price', 'volume', 'change_percent') AND NEW.symbol IS NULL THEN
        RAISE EXCEPTION 'Symbol is required for price/volume alerts';
    END IF;
    
    -- Set next check time if not provided
    IF NEW.next_check_at IS NULL AND NEW.status = 'pending' THEN
        NEW.next_check_at := NOW() + INTERVAL '5 minutes';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply validation triggers
CREATE TRIGGER validate_stock_data_trigger
    BEFORE INSERT OR UPDATE ON stock_data
    FOR EACH ROW EXECUTE FUNCTION validate_stock_data();

CREATE TRIGGER validate_portfolio_holdings_trigger
    BEFORE INSERT OR UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION validate_portfolio_holdings();

CREATE TRIGGER validate_trades_trigger
    BEFORE INSERT OR UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION validate_trades();

CREATE TRIGGER validate_feed_sources_trigger
    BEFORE INSERT OR UPDATE ON feed_sources
    FOR EACH ROW EXECUTE FUNCTION validate_feed_sources();

CREATE TRIGGER validate_entities_trigger
    BEFORE INSERT OR UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION validate_entities();

CREATE TRIGGER validate_predictions_trigger
    BEFORE INSERT OR UPDATE ON predictions
    FOR EACH ROW EXECUTE FUNCTION validate_predictions();

CREATE TRIGGER validate_alerts_trigger
    BEFORE INSERT OR UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION validate_alerts();

-- Add trigger comments
COMMENT ON FUNCTION validate_stock_data IS 'Validate stock data integrity and calculate derived fields';
COMMENT ON FUNCTION validate_portfolio_holdings IS 'Validate portfolio holdings and calculate position values';
COMMENT ON FUNCTION validate_trades IS 'Validate trade data and calculate totals';
COMMENT ON FUNCTION validate_feed_sources IS 'Validate feed source configuration';
COMMENT ON FUNCTION validate_entities IS 'Validate entity data and normalize fields';
COMMENT ON FUNCTION validate_predictions IS 'Validate prediction data and constraints';
COMMENT ON FUNCTION validate_alerts IS 'Validate alert configuration and set defaults';

COMMENT ON TRIGGER validate_stock_data_trigger ON stock_data IS 'Validate stock data before insert/update';
COMMENT ON TRIGGER validate_portfolio_holdings_trigger ON portfolio_holdings IS 'Validate portfolio holdings before insert/update';
COMMENT ON TRIGGER validate_trades_trigger ON trades IS 'Validate trades before insert/update';
COMMENT ON TRIGGER validate_feed_sources_trigger ON feed_sources IS 'Validate feed sources before insert/update';
COMMENT ON TRIGGER validate_entities_trigger ON entities IS 'Validate entities before insert/update';
COMMENT ON TRIGGER validate_predictions_trigger ON predictions IS 'Validate predictions before insert/update';
COMMENT ON TRIGGER validate_alerts_trigger ON alerts IS 'Validate alerts before insert/update';