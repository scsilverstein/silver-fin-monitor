-- Create indexes for portfolio_holdings table
-- Support portfolio management queries

-- Primary index for portfolio lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_portfolio 
ON portfolio_holdings(portfolio_id, symbol);

-- Index for user holdings across portfolios
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user 
ON portfolio_holdings(user_id, symbol);

-- Index for position size analysis
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_size 
ON portfolio_holdings(portfolio_id, position_value DESC) 
WHERE position_value > 0;

-- Index for profit/loss tracking
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_pnl 
ON portfolio_holdings(portfolio_id, unrealized_pnl DESC);

-- Index for cost basis queries
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_cost 
ON portfolio_holdings(symbol, cost_basis);

-- Index for recent transactions
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_updated 
ON portfolio_holdings(updated_at DESC);

-- Index for allocation analysis
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_allocation 
ON portfolio_holdings(portfolio_id, allocation_percentage DESC) 
WHERE allocation_percentage > 0;

-- Index for tax lot tracking
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_tax_lots 
ON portfolio_holdings USING GIN(tax_lots) 
WHERE tax_lots IS NOT NULL;

-- Index for dividend-paying holdings
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_dividends 
ON portfolio_holdings(portfolio_id, annual_dividend_amount DESC) 
WHERE annual_dividend_amount > 0;

-- Add index comments
COMMENT ON INDEX idx_portfolio_holdings_portfolio IS 'Portfolio position lookups';
COMMENT ON INDEX idx_portfolio_holdings_user IS 'User holdings summary';
COMMENT ON INDEX idx_portfolio_holdings_size IS 'Position size ranking';
COMMENT ON INDEX idx_portfolio_holdings_pnl IS 'Profit/loss analysis';
COMMENT ON INDEX idx_portfolio_holdings_cost IS 'Cost basis tracking';
COMMENT ON INDEX idx_portfolio_holdings_updated IS 'Recent position changes';
COMMENT ON INDEX idx_portfolio_holdings_allocation IS 'Portfolio allocation';
COMMENT ON INDEX idx_portfolio_holdings_tax_lots IS 'Tax lot details';
COMMENT ON INDEX idx_portfolio_holdings_dividends IS 'Income-generating holdings';