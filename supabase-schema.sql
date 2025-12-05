-- Supabase Database Schema for Stock Data
-- Run this SQL in your Supabase SQL Editor

-- Create table for stock time series data
CREATE TABLE IF NOT EXISTS stock_data (
  id BIGSERIAL PRIMARY KEY,
  ticker VARCHAR(10) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  close_price DECIMAL(10, 2) NOT NULL,
  is_etf BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  CONSTRAINT unique_ticker_date UNIQUE (ticker, date)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_data_ticker ON stock_data(ticker);
CREATE INDEX IF NOT EXISTS idx_stock_data_date ON stock_data(date);
CREATE INDEX IF NOT EXISTS idx_stock_data_sector ON stock_data(sector);
CREATE INDEX IF NOT EXISTS idx_stock_data_ticker_date ON stock_data(ticker, date DESC);

-- Create view for latest prices
CREATE OR REPLACE VIEW latest_stock_prices AS
SELECT DISTINCT ON (ticker)
  ticker,
  sector,
  company_name,
  date,
  close_price,
  is_etf,
  synced_at
FROM stock_data
ORDER BY ticker, date DESC;

-- Create view for sector aggregates
CREATE OR REPLACE VIEW sector_aggregates AS
SELECT
  sector,
  COUNT(DISTINCT ticker) as ticker_count,
  AVG(close_price) as avg_price,
  MIN(close_price) as min_price,
  MAX(close_price) as max_price,
  MAX(synced_at) as last_sync
FROM stock_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sector;

-- Enable Row Level Security (RLS)
ALTER TABLE stock_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (adjust based on your needs)
CREATE POLICY "Allow public read access"
  ON stock_data
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow service role to insert/update
CREATE POLICY "Allow service role full access"
  ON stock_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON stock_data TO anon, authenticated;
GRANT ALL ON stock_data TO service_role;
GRANT USAGE ON SEQUENCE stock_data_id_seq TO service_role;
