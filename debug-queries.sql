-- Debug queries to run in Supabase SQL Editor
-- These will help identify any data issues

-- 1. Check if there's any data at all
SELECT COUNT(*) as total_rows FROM stock_data;

-- 2. Check distinct tickers and their row counts
SELECT ticker, COUNT(*) as row_count 
FROM stock_data 
GROUP BY ticker 
ORDER BY row_count DESC 
LIMIT 20;

-- 3. Check for case sensitivity issues (should show if you have mixed case tickers)
SELECT DISTINCT ticker FROM stock_data ORDER BY ticker;

-- 4. Check for a specific ticker (change 'AAPL' to the ticker you're having issues with)
SELECT ticker, date, close_price 
FROM stock_data 
WHERE ticker = 'AAPL' 
ORDER BY date DESC 
LIMIT 10;

-- 5. Check date range for all tickers
SELECT 
  ticker,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(*) as total_days
FROM stock_data
GROUP BY ticker
ORDER BY ticker
LIMIT 20;

-- 6. Check if there are any NULL values that might cause issues
SELECT 
  COUNT(*) FILTER (WHERE ticker IS NULL) as null_tickers,
  COUNT(*) FILTER (WHERE date IS NULL) as null_dates,
  COUNT(*) FILTER (WHERE close_price IS NULL) as null_prices
FROM stock_data;

-- 7. Check for duplicate ticker-date combinations (should be 0 due to unique constraint)
SELECT ticker, date, COUNT(*) as duplicate_count
FROM stock_data
GROUP BY ticker, date
HAVING COUNT(*) > 1;
