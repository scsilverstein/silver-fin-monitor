-- Seed technical indicator configurations
-- Predefined technical indicators and their calculation parameters

-- Insert technical indicator definitions
INSERT INTO technical_indicator_definitions (name, category, description, parameters, calculation_method) VALUES
-- Trend Indicators
('Simple Moving Average', 'trend', 'Average price over a specified number of periods',
 jsonb_build_object('period', 20, 'price_field', 'close'),
 'SMA = Sum(Close prices) / Period'),

('Exponential Moving Average', 'trend', 'Exponentially weighted moving average giving more weight to recent prices',
 jsonb_build_object('period', 12, 'price_field', 'close', 'smoothing_factor', 2),
 'EMA = (Close - Previous EMA) × (2/(Period+1)) + Previous EMA'),

('MACD', 'trend', 'Moving Average Convergence Divergence - trend following momentum indicator',
 jsonb_build_object('fast_period', 12, 'slow_period', 26, 'signal_period', 9),
 'MACD = EMA(12) - EMA(26), Signal = EMA(MACD, 9), Histogram = MACD - Signal'),

('Bollinger Bands', 'trend', 'Price channel based on moving average and standard deviation',
 jsonb_build_object('period', 20, 'std_dev_multiplier', 2),
 'Middle Band = SMA(20), Upper/Lower = SMA ± (StdDev × Multiplier)'),

('Parabolic SAR', 'trend', 'Stop and Reverse indicator for trend changes',
 jsonb_build_object('acceleration_factor', 0.02, 'max_acceleration', 0.20),
 'SAR = Previous SAR + AF × (EP - Previous SAR)'),

-- Momentum Indicators
('RSI', 'momentum', 'Relative Strength Index - measures speed and change of price movements',
 jsonb_build_object('period', 14),
 'RSI = 100 - (100 / (1 + RS)), where RS = Average Gain / Average Loss'),

('Stochastic Oscillator', 'momentum', 'Compares closing price to price range over a given period',
 jsonb_build_object('k_period', 14, 'd_period', 3, 'smooth_k', 3),
 '%K = (Close - Lowest Low) / (Highest High - Lowest Low) × 100'),

('Williams %R', 'momentum', 'Momentum oscillator measuring overbought/oversold levels',
 jsonb_build_object('period', 14),
 '%R = (Highest High - Close) / (Highest High - Lowest Low) × -100'),

('Commodity Channel Index', 'momentum', 'Measures deviation from average price to identify cyclical turns',
 jsonb_build_object('period', 20, 'constant', 0.015),
 'CCI = (Typical Price - SMA) / (Constant × Mean Deviation)'),

('Money Flow Index', 'momentum', 'Volume-weighted RSI measuring buying and selling pressure',
 jsonb_build_object('period', 14),
 'MFI = 100 - (100 / (1 + Money Flow Ratio))'),

-- Volume Indicators
('On Balance Volume', 'volume', 'Running total of volume based on price direction',
 jsonb_build_object(),
 'OBV = Previous OBV + Volume (if Close > Previous Close) or - Volume (if Close < Previous Close)'),

('Volume Price Trend', 'volume', 'Combines price and volume to show supply and demand',
 jsonb_build_object(),
 'VPT = Previous VPT + Volume × (Close - Previous Close) / Previous Close'),

('Accumulation/Distribution Line', 'volume', 'Volume flow indicator measuring cumulative buying/selling pressure',
 jsonb_build_object(),
 'A/D = Previous A/D + Money Flow Volume, where MFV = Volume × CLV'),

('Chaikin Money Flow', 'volume', 'Measures money flow over a specific period',
 jsonb_build_object('period', 21),
 'CMF = Sum(Money Flow Volume) / Sum(Volume) over period'),

-- Volatility Indicators
('Average True Range', 'volatility', 'Measures market volatility by averaging true ranges',
 jsonb_build_object('period', 14),
 'ATR = Average of True Range values over period'),

('Bollinger Band Width', 'volatility', 'Measures the width of Bollinger Bands',
 jsonb_build_object('period', 20, 'std_dev_multiplier', 2),
 'BB Width = (Upper Band - Lower Band) / Middle Band'),

('Standard Deviation', 'volatility', 'Statistical measure of price volatility',
 jsonb_build_object('period', 20, 'price_field', 'close'),
 'StdDev = Square root of variance of price over period'),

('Ulcer Index', 'volatility', 'Measures downside risk and volatility',
 jsonb_build_object('period', 14),
 'UI = Square root of average of squared percentage drawdowns'),

-- Support/Resistance Indicators
('Pivot Points', 'support_resistance', 'Price levels that may act as support or resistance',
 jsonb_build_object('type', 'standard'),
 'PP = (High + Low + Close) / 3, R1 = 2×PP - Low, S1 = 2×PP - High'),

('Fibonacci Retracement', 'support_resistance', 'Key levels based on Fibonacci ratios',
 jsonb_build_object('ratios', ARRAY[0.236, 0.382, 0.500, 0.618, 0.786]),
 'Levels = High - (High - Low) × Fibonacci Ratio'),

('Donchian Channels', 'support_resistance', 'Channel based on highest high and lowest low',
 jsonb_build_object('period', 20),
 'Upper = Highest High over period, Lower = Lowest Low over period'),

-- Breadth Indicators
('Advance/Decline Line', 'breadth', 'Cumulative measure of advancing vs declining stocks',
 jsonb_build_object(),
 'A/D Line = Previous A/D Line + (Advancing Stocks - Declining Stocks)'),

('McClellan Oscillator', 'breadth', 'Market breadth momentum oscillator',
 jsonb_build_object('fast_ema', 19, 'slow_ema', 39),
 'McClellan = EMA(19) of Net Advances - EMA(39) of Net Advances'),

-- Custom Indicators
('Price Rate of Change', 'momentum', 'Percentage change in price over a specified period',
 jsonb_build_object('period', 12),
 'ROC = (Close - Close n periods ago) / Close n periods ago × 100'),

('Aroon Indicator', 'trend', 'Measures time between highs and lows to identify trend changes',
 jsonb_build_object('period', 25),
 'Aroon Up = ((Period - Periods since highest high) / Period) × 100'),

('Ichimoku Cloud', 'trend', 'Comprehensive indicator showing support, resistance, and momentum',
 jsonb_build_object('tenkan_period', 9, 'kijun_period', 26, 'senkou_b_period', 52),
 'Multiple lines: Tenkan, Kijun, Senkou A & B, and Chikou')

ON CONFLICT (name) DO UPDATE SET
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    parameters = EXCLUDED.parameters,
    calculation_method = EXCLUDED.calculation_method,
    updated_at = NOW();

-- Insert common technical indicator combinations/strategies
INSERT INTO indicator_strategies (name, description, indicators, conditions, signals) VALUES
('Golden Cross', 'Bullish signal when short-term MA crosses above long-term MA',
 jsonb_build_object(
   'sma_50', jsonb_build_object('type', 'SMA', 'period', 50),
   'sma_200', jsonb_build_object('type', 'SMA', 'period', 200)
 ),
 jsonb_build_object(
   'bullish', 'sma_50 > sma_200 AND previous_sma_50 <= previous_sma_200',
   'bearish', 'sma_50 < sma_200 AND previous_sma_50 >= previous_sma_200'
 ),
 jsonb_build_object(
   'buy', 'Golden Cross confirmed - potential trend reversal',
   'sell', 'Death Cross confirmed - potential trend reversal'
 )),

('RSI Divergence', 'Identifies potential reversals through price-RSI divergence',
 jsonb_build_object(
   'rsi', jsonb_build_object('type', 'RSI', 'period', 14),
   'price_trend', jsonb_build_object('type', 'trend_analysis', 'period', 20)
 ),
 jsonb_build_object(
   'bullish_divergence', 'price making lower lows AND rsi making higher lows',
   'bearish_divergence', 'price making higher highs AND rsi making lower highs'
 ),
 jsonb_build_object(
   'buy', 'Bullish divergence detected - potential upward reversal',
   'sell', 'Bearish divergence detected - potential downward reversal'
 )),

('Bollinger Bounce', 'Trade reversals at Bollinger Band extremes',
 jsonb_build_object(
   'bb', jsonb_build_object('type', 'Bollinger Bands', 'period', 20, 'std_dev', 2),
   'rsi', jsonb_build_object('type', 'RSI', 'period', 14)
 ),
 jsonb_build_object(
   'oversold_bounce', 'price touches lower band AND rsi < 30',
   'overbought_pullback', 'price touches upper band AND rsi > 70'
 ),
 jsonb_build_object(
   'buy', 'Oversold bounce setup - potential mean reversion',
   'sell', 'Overbought pullback setup - potential mean reversion'
 )),

('MACD Signal Cross', 'MACD line crossing above or below signal line',
 jsonb_build_object(
   'macd', jsonb_build_object('type', 'MACD', 'fast', 12, 'slow', 26, 'signal', 9)
 ),
 jsonb_build_object(
   'bullish_cross', 'macd_line > signal_line AND previous_macd_line <= previous_signal_line',
   'bearish_cross', 'macd_line < signal_line AND previous_macd_line >= previous_signal_line'
 ),
 jsonb_build_object(
   'buy', 'MACD bullish crossover - momentum turning positive',
   'sell', 'MACD bearish crossover - momentum turning negative'
 )),

('Triple Screen Trading', 'Multi-timeframe analysis system',
 jsonb_build_object(
   'weekly_trend', jsonb_build_object('type', 'EMA', 'period', 13, 'timeframe', 'weekly'),
   'daily_oscillator', jsonb_build_object('type', 'Stochastic', 'timeframe', 'daily'),
   'entry_trigger', jsonb_build_object('type', 'breakout', 'timeframe', 'intraday')
 ),
 jsonb_build_object(
   'buy_setup', 'weekly_trend bullish AND daily_oscillator oversold',
   'sell_setup', 'weekly_trend bearish AND daily_oscillator overbought'
 ),
 jsonb_build_object(
   'buy', 'Triple screen buy setup confirmed',
   'sell', 'Triple screen sell setup confirmed'
 )),

('Volume Breakout', 'Price breakout confirmed by volume',
 jsonb_build_object(
   'price_breakout', jsonb_build_object('type', 'resistance_break'),
   'volume_confirmation', jsonb_build_object('type', 'volume_spike', 'multiplier', 1.5)
 ),
 jsonb_build_object(
   'bullish_breakout', 'price > resistance AND volume > 1.5x average',
   'bearish_breakdown', 'price < support AND volume > 1.5x average'
 ),
 jsonb_build_object(
   'buy', 'Volume-confirmed breakout above resistance',
   'sell', 'Volume-confirmed breakdown below support'
 ))

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    indicators = EXCLUDED.indicators,
    conditions = EXCLUDED.conditions,
    signals = EXCLUDED.signals,
    updated_at = NOW();

-- Insert sector-specific indicator configurations
INSERT INTO sector_indicators (sector, recommended_indicators, timeframes, special_considerations) VALUES
('Technology', 
 jsonb_build_object(
   'primary', ARRAY['RSI', 'MACD', 'Bollinger Bands'],
   'secondary', ARRAY['Money Flow Index', 'Volume Price Trend'],
   'volatility', ARRAY['ATR', 'Bollinger Band Width']
 ),
 jsonb_build_object(
   'short_term', ARRAY['5min', '15min', '1hour'],
   'medium_term', ARRAY['daily', 'weekly'],
   'long_term', ARRAY['monthly']
 ),
 jsonb_build_object(
   'high_volatility', true,
   'earnings_sensitive', true,
   'news_driven', true,
   'beta_consideration', 'typically high beta sector'
 )),

('Financial Services',
 jsonb_build_object(
   'primary', ARRAY['Simple Moving Average', 'Volume', 'Support/Resistance'],
   'secondary', ARRAY['RSI', 'MACD'],
   'sector_specific', ARRAY['Interest Rate Correlation', 'Credit Spread Analysis']
 ),
 jsonb_build_object(
   'short_term', ARRAY['daily'],
   'medium_term', ARRAY['weekly'],
   'long_term', ARRAY['monthly', 'quarterly']
 ),
 jsonb_build_object(
   'interest_rate_sensitive', true,
   'regulatory_events', true,
   'dividend_focus', true,
   'economic_cycle_dependent', true
 )),

('Healthcare',
 jsonb_build_object(
   'primary', ARRAY['RSI', 'Moving Averages', 'Volume'],
   'secondary', ARRAY['MACD', 'Stochastic'],
   'sector_specific', ARRAY['FDA Calendar', 'Patent Expiry Tracking']
 ),
 jsonb_build_object(
   'short_term', ARRAY['daily'],
   'medium_term', ARRAY['weekly', 'monthly'],
   'long_term', ARRAY['quarterly', 'yearly']
 ),
 jsonb_build_object(
   'event_driven', true,
   'patent_cliff_risk', true,
   'regulatory_sensitive', true,
   'defensive_characteristics', true
 )),

('Energy',
 jsonb_build_object(
   'primary', ARRAY['Commodity Correlation', 'RSI', 'Support/Resistance'],
   'secondary', ARRAY['Volume', 'MACD'],
   'sector_specific', ARRAY['Oil Price Correlation', 'Seasonal Patterns']
 ),
 jsonb_build_object(
   'short_term', ARRAY['daily', 'weekly'],
   'medium_term', ARRAY['monthly'],
   'long_term', ARRAY['quarterly']
 ),
 jsonb_build_object(
   'commodity_dependent', true,
   'cyclical_nature', true,
   'geopolitical_sensitive', true,
   'weather_dependent', true
 ))

ON CONFLICT (sector) DO UPDATE SET
    recommended_indicators = EXCLUDED.recommended_indicators,
    timeframes = EXCLUDED.timeframes,
    special_considerations = EXCLUDED.special_considerations,
    updated_at = NOW();

-- Add table comments
COMMENT ON TABLE technical_indicator_definitions IS 'Definitions and parameters for technical analysis indicators';
COMMENT ON TABLE indicator_strategies IS 'Pre-defined trading strategies combining multiple indicators';
COMMENT ON TABLE sector_indicators IS 'Sector-specific technical analysis recommendations and considerations';