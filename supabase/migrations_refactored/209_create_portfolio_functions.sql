-- Create portfolio management functions
-- Functions for portfolio calculations and analysis

-- Function to calculate portfolio performance
CREATE OR REPLACE FUNCTION calculate_portfolio_performance(
    portfolio_uuid UUID,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
    total_return DECIMAL(10, 4),
    annualized_return DECIMAL(10, 4),
    volatility DECIMAL(10, 4),
    sharpe_ratio DECIMAL(10, 4),
    max_drawdown DECIMAL(10, 4),
    win_rate DECIMAL(5, 2)
) AS $$
DECLARE
    portfolio_start_date DATE;
    days_between INTEGER;
BEGIN
    -- Use portfolio creation date if start_date not provided
    IF start_date IS NULL THEN
        SELECT created_at::DATE INTO portfolio_start_date 
        FROM portfolios 
        WHERE id = portfolio_uuid;
        start_date := portfolio_start_date;
    END IF;
    
    days_between := end_date - start_date;
    
    -- Calculate portfolio performance metrics
    WITH daily_returns AS (
        SELECT 
            t.executed_at::DATE as trade_date,
            SUM(t.realized_pnl) as daily_pnl,
            -- Calculate portfolio value changes
            LAG(SUM(ph.position_value)) OVER (ORDER BY t.executed_at::DATE) as prev_value,
            SUM(ph.position_value) as current_value
        FROM trades t
        LEFT JOIN portfolio_holdings ph ON ph.portfolio_id = t.portfolio_id
        WHERE t.portfolio_id = portfolio_uuid
        AND t.executed_at::DATE BETWEEN start_date AND end_date
        AND t.order_status = 'executed'
        GROUP BY t.executed_at::DATE
        HAVING SUM(ph.position_value) > 0
    ),
    returns_data AS (
        SELECT 
            trade_date,
            CASE 
                WHEN prev_value > 0 THEN 
                    ((current_value - prev_value) / prev_value)
                ELSE 0 
            END as daily_return
        FROM daily_returns
        WHERE prev_value IS NOT NULL
    )
    SELECT 
        -- Total return
        (EXP(SUM(LN(1 + daily_return))) - 1)::DECIMAL(10, 4) as total_ret,
        -- Annualized return
        CASE 
            WHEN days_between > 0 THEN 
                (POWER(EXP(SUM(LN(1 + daily_return))), 365.0 / days_between) - 1)::DECIMAL(10, 4)
            ELSE 0::DECIMAL(10, 4)
        END as annualized_ret,
        -- Volatility (annualized)
        (STDDEV(daily_return) * SQRT(365))::DECIMAL(10, 4) as vol,
        -- Sharpe ratio (assuming 2% risk-free rate)
        CASE 
            WHEN STDDEV(daily_return) > 0 THEN 
                ((AVG(daily_return) * 365 - 0.02) / (STDDEV(daily_return) * SQRT(365)))::DECIMAL(10, 4)
            ELSE 0::DECIMAL(10, 4)
        END as sharpe,
        -- Max drawdown (simplified)
        COALESCE(MIN(daily_return), 0)::DECIMAL(10, 4) as max_dd,
        -- Win rate
        (COUNT(*) FILTER (WHERE daily_return > 0) * 100.0 / COUNT(*))::DECIMAL(5, 2) as win_rt
    FROM returns_data;
END;
$$ LANGUAGE plpgsql;

-- Function to rebalance portfolio to target allocations
CREATE OR REPLACE FUNCTION rebalance_portfolio(
    portfolio_uuid UUID,
    target_allocations JSONB -- {"AAPL": 0.25, "GOOGL": 0.25, "MSFT": 0.50}
) RETURNS TABLE (
    symbol VARCHAR(20),
    current_allocation DECIMAL(5, 2),
    target_allocation DECIMAL(5, 2),
    shares_to_trade INTEGER,
    trade_action VARCHAR(10)
) AS $$
DECLARE
    total_portfolio_value DECIMAL(20, 2);
    allocation_record RECORD;
BEGIN
    -- Calculate total portfolio value
    SELECT SUM(position_value) INTO total_portfolio_value
    FROM portfolio_holdings 
    WHERE portfolio_id = portfolio_uuid;
    
    IF total_portfolio_value IS NULL OR total_portfolio_value <= 0 THEN
        RETURN;
    END IF;
    
    -- Calculate rebalancing trades for each target allocation
    FOR allocation_record IN 
        SELECT 
            key as stock_symbol,
            value::DECIMAL(5, 2) as target_pct
        FROM jsonb_each_text(target_allocations)
    LOOP
        RETURN QUERY
        WITH current_position AS (
            SELECT 
                COALESCE(ph.quantity, 0) as current_shares,
                COALESCE(ph.position_value, 0) as current_value,
                COALESCE(sd.close, 0) as current_price
            FROM portfolio_holdings ph
            RIGHT JOIN (SELECT allocation_record.stock_symbol as symbol) s ON s.symbol = ph.symbol
            LEFT JOIN stock_data sd ON sd.symbol = allocation_record.stock_symbol
            WHERE ph.portfolio_id = portfolio_uuid OR ph.portfolio_id IS NULL
            ORDER BY sd.date DESC
            LIMIT 1
        )
        SELECT 
            allocation_record.stock_symbol,
            CASE 
                WHEN total_portfolio_value > 0 THEN 
                    (cp.current_value / total_portfolio_value * 100)::DECIMAL(5, 2)
                ELSE 0::DECIMAL(5, 2)
            END as current_alloc,
            allocation_record.target_pct,
            CASE 
                WHEN cp.current_price > 0 THEN
                    ROUND((total_portfolio_value * allocation_record.target_pct / 100 - cp.current_value) / cp.current_price)::INTEGER
                ELSE 0
            END as shares_needed,
            CASE 
                WHEN cp.current_price > 0 AND (total_portfolio_value * allocation_record.target_pct / 100 - cp.current_value) > 0 THEN 'BUY'
                WHEN cp.current_price > 0 AND (total_portfolio_value * allocation_record.target_pct / 100 - cp.current_value) < 0 THEN 'SELL'
                ELSE 'HOLD'
            END as action
        FROM current_position cp;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate portfolio risk metrics
CREATE OR REPLACE FUNCTION calculate_portfolio_risk(
    portfolio_uuid UUID,
    lookback_days INTEGER DEFAULT 252
) RETURNS TABLE (
    value_at_risk_95 DECIMAL(20, 2),
    value_at_risk_99 DECIMAL(20, 2),
    expected_shortfall DECIMAL(20, 2),
    beta DECIMAL(5, 2),
    correlation_to_market DECIMAL(5, 2)
) AS $$
DECLARE
    portfolio_value DECIMAL(20, 2);
BEGIN
    -- Get current portfolio value
    SELECT SUM(position_value) INTO portfolio_value
    FROM portfolio_holdings 
    WHERE portfolio_id = portfolio_uuid;
    
    RETURN QUERY
    WITH portfolio_returns AS (
        -- Calculate daily portfolio returns
        SELECT 
            t.executed_at::DATE as trade_date,
            SUM(t.realized_pnl + COALESCE(ph.unrealized_pnl, 0)) / portfolio_value as portfolio_return
        FROM trades t
        LEFT JOIN portfolio_holdings ph ON ph.symbol = 
            CASE 
                WHEN t.trade_type = 'buy' THEN t.symbol
                WHEN t.trade_type = 'sell' THEN t.symbol
                ELSE NULL
            END
        WHERE t.portfolio_id = portfolio_uuid
        AND t.executed_at >= CURRENT_DATE - (lookback_days || ' days')::INTERVAL
        AND t.order_status = 'executed'
        GROUP BY t.executed_at::DATE
    ),
    market_returns AS (
        -- Calculate market returns (using SPY as proxy)
        SELECT 
            date,
            change_percent / 100 as market_return
        FROM stock_data 
        WHERE symbol = 'SPY'
        AND date >= CURRENT_DATE - (lookback_days || ' days')::INTERVAL
        AND change_percent IS NOT NULL
    ),
    combined_data AS (
        SELECT 
            pr.portfolio_return,
            mr.market_return
        FROM portfolio_returns pr
        JOIN market_returns mr ON mr.date = pr.trade_date
    )
    SELECT 
        -- VaR 95%
        (PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY portfolio_return) * portfolio_value)::DECIMAL(20, 2),
        -- VaR 99%
        (PERCENTILE_CONT(0.01) WITHIN GROUP (ORDER BY portfolio_return) * portfolio_value)::DECIMAL(20, 2),
        -- Expected Shortfall (average of worst 5% returns)
        (AVG(portfolio_return) FILTER (WHERE portfolio_return <= PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY portfolio_return)) * portfolio_value)::DECIMAL(20, 2),
        -- Beta
        CASE 
            WHEN VAR_POP(market_return) > 0 THEN 
                (COVAR_POP(portfolio_return, market_return) / VAR_POP(market_return))::DECIMAL(5, 2)
            ELSE 0::DECIMAL(5, 2)
        END,
        -- Correlation to market
        CORR(portfolio_return, market_return)::DECIMAL(5, 2)
    FROM combined_data;
END;
$$ LANGUAGE plpgsql;

-- Function to get portfolio sector allocation
CREATE OR REPLACE FUNCTION get_portfolio_sector_allocation(portfolio_uuid UUID) RETURNS TABLE (
    sector VARCHAR(100),
    allocation_percentage DECIMAL(5, 2),
    market_value DECIMAL(20, 2),
    position_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH portfolio_total AS (
        SELECT SUM(position_value) as total_value
        FROM portfolio_holdings 
        WHERE portfolio_id = portfolio_uuid
    )
    SELECT 
        COALESCE(e.sector, 'Unknown') as sector_name,
        CASE 
            WHEN pt.total_value > 0 THEN 
                (SUM(ph.position_value) / pt.total_value * 100)::DECIMAL(5, 2)
            ELSE 0::DECIMAL(5, 2)
        END as alloc_pct,
        SUM(ph.position_value)::DECIMAL(20, 2) as market_val,
        COUNT(*)::INTEGER as pos_count
    FROM portfolio_holdings ph
    LEFT JOIN entities e ON e.symbol = ph.symbol
    CROSS JOIN portfolio_total pt
    WHERE ph.portfolio_id = portfolio_uuid
    AND ph.quantity > 0
    GROUP BY COALESCE(e.sector, 'Unknown'), pt.total_value
    ORDER BY alloc_pct DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate position sizing recommendation
CREATE OR REPLACE FUNCTION calculate_position_size(
    portfolio_uuid UUID,
    stock_symbol VARCHAR(20),
    risk_per_trade DECIMAL(5, 2) DEFAULT 2.0, -- 2% risk per trade
    stop_loss_percent DECIMAL(5, 2) DEFAULT 10.0 -- 10% stop loss
) RETURNS TABLE (
    recommended_shares INTEGER,
    recommended_investment DECIMAL(20, 2),
    risk_amount DECIMAL(20, 2),
    position_percentage DECIMAL(5, 2)
) AS $$
DECLARE
    portfolio_value DECIMAL(20, 2);
    current_price DECIMAL(10, 4);
    risk_amount_calc DECIMAL(20, 2);
BEGIN
    -- Get portfolio value
    SELECT SUM(position_value) INTO portfolio_value
    FROM portfolio_holdings 
    WHERE portfolio_id = portfolio_uuid;
    
    IF portfolio_value IS NULL OR portfolio_value <= 0 THEN
        RETURN;
    END IF;
    
    -- Get current stock price
    SELECT close INTO current_price
    FROM stock_data 
    WHERE symbol = stock_symbol 
    ORDER BY date DESC LIMIT 1;
    
    IF current_price IS NULL OR current_price <= 0 THEN
        RETURN;
    END IF;
    
    -- Calculate risk amount
    risk_amount_calc := portfolio_value * risk_per_trade / 100;
    
    RETURN QUERY
    SELECT 
        -- Recommended shares based on risk management
        FLOOR(risk_amount_calc / (current_price * stop_loss_percent / 100))::INTEGER as rec_shares,
        -- Recommended investment amount
        (FLOOR(risk_amount_calc / (current_price * stop_loss_percent / 100)) * current_price)::DECIMAL(20, 2) as rec_investment,
        -- Risk amount
        risk_amount_calc::DECIMAL(20, 2) as risk_amt,
        -- Position percentage of portfolio
        ((FLOOR(risk_amount_calc / (current_price * stop_loss_percent / 100)) * current_price) / portfolio_value * 100)::DECIMAL(5, 2) as pos_pct;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION calculate_portfolio_performance IS 'Calculate comprehensive portfolio performance metrics';
COMMENT ON FUNCTION rebalance_portfolio IS 'Calculate trades needed to rebalance portfolio to target allocations';
COMMENT ON FUNCTION calculate_portfolio_risk IS 'Calculate portfolio risk metrics including VaR and beta';
COMMENT ON FUNCTION get_portfolio_sector_allocation IS 'Get portfolio allocation by sector';
COMMENT ON FUNCTION calculate_position_size IS 'Calculate recommended position size based on risk management';