-- Seed initial market sectors
INSERT INTO sectors (sector_name, sector_code, description) VALUES
    ('Technology', 'TECH', 'Information technology, software, hardware, and IT services'),
    ('Healthcare', 'HLTH', 'Pharmaceuticals, biotechnology, medical devices, and healthcare services'),
    ('Financials', 'FIN', 'Banks, insurance, asset management, and financial services'),
    ('Consumer Discretionary', 'CONS_D', 'Retail, automotive, leisure, and consumer durables'),
    ('Communication Services', 'COMM', 'Telecommunications, media, and entertainment'),
    ('Industrials', 'IND', 'Manufacturing, transportation, and business services'),
    ('Consumer Staples', 'CONS_S', 'Food, beverage, household products, and personal care'),
    ('Energy', 'ENRG', 'Oil, gas, and renewable energy'),
    ('Utilities', 'UTIL', 'Electric, gas, and water utilities'),
    ('Real Estate', 'RE', 'REITs and real estate services'),
    ('Materials', 'MAT', 'Chemicals, mining, and construction materials')
ON CONFLICT (sector_name) DO NOTHING;

-- Add comment
COMMENT ON TABLE sectors IS 'Market sectors seeded with standard GICS sectors';