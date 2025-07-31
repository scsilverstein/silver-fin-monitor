-- Seed stock entities
-- Major stocks and market entities for tracking and analysis

-- Insert major US stock entities
INSERT INTO entities (name, symbol, entity_type, sector, industry, metadata, is_active) VALUES
-- Technology Sector
('Apple Inc.', 'AAPL', 'stock', 'Technology', 'Consumer Electronics', 
 jsonb_build_object('market_cap_category', 'mega', 'exchange', 'NASDAQ', 'country', 'US'), true),

('Microsoft Corporation', 'MSFT', 'stock', 'Technology', 'Software-Infrastructure', 
 jsonb_build_object('market_cap_category', 'mega', 'exchange', 'NASDAQ', 'country', 'US'), true),

('Alphabet Inc.', 'GOOGL', 'stock', 'Technology', 'Internet Content & Information', 
 jsonb_build_object('market_cap_category', 'mega', 'exchange', 'NASDAQ', 'country', 'US'), true),

('Amazon.com Inc.', 'AMZN', 'stock', 'Consumer Discretionary', 'Internet & Direct Marketing Retail', 
 jsonb_build_object('market_cap_category', 'mega', 'exchange', 'NASDAQ', 'country', 'US'), true),

('NVIDIA Corporation', 'NVDA', 'stock', 'Technology', 'Semiconductors', 
 jsonb_build_object('market_cap_category', 'mega', 'exchange', 'NASDAQ', 'country', 'US'), true),

('Meta Platforms Inc.', 'META', 'stock', 'Technology', 'Internet Content & Information', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NASDAQ', 'country', 'US'), true),

('Tesla Inc.', 'TSLA', 'stock', 'Consumer Discretionary', 'Automobiles', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NASDAQ', 'country', 'US'), true),

-- Financial Sector
('JPMorgan Chase & Co.', 'JPM', 'stock', 'Financials', 'Banks-Diversified', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

('Bank of America Corp.', 'BAC', 'stock', 'Financials', 'Banks-Diversified', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

('Wells Fargo & Company', 'WFC', 'stock', 'Financials', 'Banks-Diversified', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

-- Healthcare Sector
('Johnson & Johnson', 'JNJ', 'stock', 'Healthcare', 'Drug Manufacturers-General', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

('Pfizer Inc.', 'PFE', 'stock', 'Healthcare', 'Drug Manufacturers-General', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

('UnitedHealth Group Inc.', 'UNH', 'stock', 'Healthcare', 'Healthcare Plans', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

-- Energy Sector
('Exxon Mobil Corporation', 'XOM', 'stock', 'Energy', 'Oil & Gas Integrated', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

('Chevron Corporation', 'CVX', 'stock', 'Energy', 'Oil & Gas Integrated', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

-- Consumer Goods
('Procter & Gamble Co.', 'PG', 'stock', 'Consumer Staples', 'Household & Personal Products', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

('Coca-Cola Company', 'KO', 'stock', 'Consumer Staples', 'Beverages-Non-Alcoholic', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

-- Industrial Sector
('Boeing Company', 'BA', 'stock', 'Industrials', 'Aerospace & Defense', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

('Caterpillar Inc.', 'CAT', 'stock', 'Industrials', 'Farm & Heavy Construction Machinery', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

-- Utilities
('NextEra Energy Inc.', 'NEE', 'stock', 'Utilities', 'Utilities-Regulated Electric', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

-- Real Estate
('American Tower Corporation', 'AMT', 'stock', 'Real Estate', 'REIT-Specialty', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

-- Communication Services
('Verizon Communications Inc.', 'VZ', 'stock', 'Communication Services', 'Telecom Services', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true),

('AT&T Inc.', 'T', 'stock', 'Communication Services', 'Telecom Services', 
 jsonb_build_object('market_cap_category', 'large', 'exchange', 'NYSE', 'country', 'US'), true)

ON CONFLICT (symbol, entity_type) DO UPDATE SET
    name = EXCLUDED.name,
    sector = EXCLUDED.sector,
    industry = EXCLUDED.industry,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Insert major ETFs
INSERT INTO entities (name, symbol, entity_type, sector, industry, metadata, is_active) VALUES
-- Market ETFs
('SPDR S&P 500 ETF Trust', 'SPY', 'etf', 'Broad Market', 'Large Cap Blend', 
 jsonb_build_object('fund_type', 'index', 'benchmark', 'S&P 500', 'expense_ratio', 0.0945), true),

('Invesco QQQ Trust', 'QQQ', 'etf', 'Technology', 'Large Cap Growth', 
 jsonb_build_object('fund_type', 'index', 'benchmark', 'NASDAQ-100', 'expense_ratio', 0.20), true),

('iShares Russell 2000 ETF', 'IWM', 'etf', 'Broad Market', 'Small Cap Blend', 
 jsonb_build_object('fund_type', 'index', 'benchmark', 'Russell 2000', 'expense_ratio', 0.19), true),

-- Sector ETFs
('Technology Select Sector SPDR Fund', 'XLK', 'etf', 'Technology', 'Technology', 
 jsonb_build_object('fund_type', 'sector', 'benchmark', 'Technology Select Sector Index', 'expense_ratio', 0.10), true),

('Financial Select Sector SPDR Fund', 'XLF', 'etf', 'Financials', 'Financials', 
 jsonb_build_object('fund_type', 'sector', 'benchmark', 'Financial Select Sector Index', 'expense_ratio', 0.10), true),

('Energy Select Sector SPDR Fund', 'XLE', 'etf', 'Energy', 'Energy', 
 jsonb_build_object('fund_type', 'sector', 'benchmark', 'Energy Select Sector Index', 'expense_ratio', 0.10), true),

-- Bond ETFs
('iShares 20+ Year Treasury Bond ETF', 'TLT', 'etf', 'Fixed Income', 'Government Bonds', 
 jsonb_build_object('fund_type', 'fixed_income', 'duration', 'long', 'expense_ratio', 0.15), true),

('iShares iBoxx High Yield Corporate Bond ETF', 'HYG', 'etf', 'Fixed Income', 'High Yield Bonds', 
 jsonb_build_object('fund_type', 'fixed_income', 'credit_quality', 'high_yield', 'expense_ratio', 0.49), true)

ON CONFLICT (symbol, entity_type) DO UPDATE SET
    name = EXCLUDED.name,
    sector = EXCLUDED.sector,
    industry = EXCLUDED.industry,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Insert major indices as entities for tracking
INSERT INTO entities (name, symbol, entity_type, sector, industry, metadata, is_active) VALUES
-- Major Indices
('S&P 500 Index', '^GSPC', 'index', 'Broad Market', 'Large Cap', 
 jsonb_build_object('index_type', 'market_cap_weighted', 'constituent_count', 500), true),

('Dow Jones Industrial Average', '^DJI', 'index', 'Broad Market', 'Large Cap', 
 jsonb_build_object('index_type', 'price_weighted', 'constituent_count', 30), true),

('NASDAQ Composite', '^IXIC', 'index', 'Technology', 'Growth', 
 jsonb_build_object('index_type', 'market_cap_weighted', 'focus', 'technology'), true),

('Russell 2000 Index', '^RUT', 'index', 'Broad Market', 'Small Cap', 
 jsonb_build_object('index_type', 'market_cap_weighted', 'constituent_count', 2000), true),

-- Volatility Index
('CBOE Volatility Index', '^VIX', 'index', 'Derivatives', 'Volatility', 
 jsonb_build_object('index_type', 'volatility', 'underlying', 'S&P 500'), true)

ON CONFLICT (symbol, entity_type) DO UPDATE SET
    name = EXCLUDED.name,
    sector = EXCLUDED.sector,
    industry = EXCLUDED.industry,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Insert major commodities
INSERT INTO entities (name, symbol, entity_type, sector, industry, metadata, is_active) VALUES
-- Precious Metals
('Gold', 'GC=F', 'commodity', 'Commodities', 'Precious Metals', 
 jsonb_build_object('commodity_type', 'precious_metal', 'unit', 'troy_ounce'), true),

('Silver', 'SI=F', 'commodity', 'Commodities', 'Precious Metals', 
 jsonb_build_object('commodity_type', 'precious_metal', 'unit', 'troy_ounce'), true),

-- Energy Commodities
('Crude Oil WTI', 'CL=F', 'commodity', 'Energy', 'Crude Oil', 
 jsonb_build_object('commodity_type', 'energy', 'unit', 'barrel'), true),

('Natural Gas', 'NG=F', 'commodity', 'Energy', 'Natural Gas', 
 jsonb_build_object('commodity_type', 'energy', 'unit', 'mmbtu'), true),

-- Agricultural
('Corn', 'ZC=F', 'commodity', 'Commodities', 'Agricultural', 
 jsonb_build_object('commodity_type', 'agricultural', 'unit', 'bushel'), true),

('Wheat', 'ZW=F', 'commodity', 'Commodities', 'Agricultural', 
 jsonb_build_object('commodity_type', 'agricultural', 'unit', 'bushel'), true)

ON CONFLICT (symbol, entity_type) DO UPDATE SET
    name = EXCLUDED.name,
    sector = EXCLUDED.sector,
    industry = EXCLUDED.industry,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Insert major currencies
INSERT INTO entities (name, symbol, entity_type, sector, industry, metadata, is_active) VALUES
-- Currency Pairs
('EUR/USD', 'EURUSD=X', 'currency', 'Currencies', 'Major Pairs', 
 jsonb_build_object('base_currency', 'EUR', 'quote_currency', 'USD'), true),

('GBP/USD', 'GBPUSD=X', 'currency', 'Currencies', 'Major Pairs', 
 jsonb_build_object('base_currency', 'GBP', 'quote_currency', 'USD'), true),

('USD/JPY', 'USDJPY=X', 'currency', 'Currencies', 'Major Pairs', 
 jsonb_build_object('base_currency', 'USD', 'quote_currency', 'JPY'), true),

('USD/CHF', 'USDCHF=X', 'currency', 'Currencies', 'Major Pairs', 
 jsonb_build_object('base_currency', 'USD', 'quote_currency', 'CHF'), true),

-- Cryptocurrency (major ones)
('Bitcoin', 'BTC-USD', 'cryptocurrency', 'Digital Assets', 'Cryptocurrency', 
 jsonb_build_object('crypto_type', 'digital_currency', 'max_supply', 21000000), true),

('Ethereum', 'ETH-USD', 'cryptocurrency', 'Digital Assets', 'Smart Contract Platform', 
 jsonb_build_object('crypto_type', 'smart_contract', 'consensus', 'proof_of_stake'), true)

ON CONFLICT (symbol, entity_type) DO UPDATE SET
    name = EXCLUDED.name,
    sector = EXCLUDED.sector,
    industry = EXCLUDED.industry,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Add table comment
COMMENT ON TABLE entities IS 'Master entity registry for stocks, ETFs, indices, commodities, and other financial instruments';