# Daily Stock Data Sync Setup Guide

This guide explains how to set up automated daily stock data synchronization to Supabase using GitHub Actions.

## Overview

The system automatically fetches historical stock data for all tickers defined in `MARKET_SECTORS` and stores them in a Supabase database. The workflow runs daily at 6 AM UTC (after US market close).

## Prerequisites

1. **Twelve Data API Key** (Free tier: 800 calls/day)
   - Sign up at: https://twelvedata.com/pricing
   - Get your API key from the dashboard

2. **Supabase Project**
   - Create a free project at: https://supabase.com
   - Note your project URL and service role key

## Setup Instructions

### 1. Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-schema.sql`
4. Click **Run** to create the table, indexes, and views

The schema includes:
- `stock_data` table with unique ticker/date constraint
- Indexes for fast queries
- Views for latest prices and sector aggregates
- Row Level Security (RLS) policies

### 2. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add each of these:

| Secret Name | Description | Where to Find |
|------------|-------------|---------------|
| `TWELVE_DATA_API_KEY` | Your Twelve Data API key | https://twelvedata.com/account |
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_KEY` | Your Supabase service role key | Supabase Dashboard → Settings → API → service_role key ⚠️ |

⚠️ **Important**: Use the **service_role** key (not the anon key) as it has permission to insert data.

### 3. Verify Installation

After setting up, you can:

**Test Locally** (optional):
```bash
# Set environment variables
export TWELVE_DATA_API_KEY="your_key"
export SUPABASE_URL="your_url"
export SUPABASE_KEY="your_key"

# Run the sync script
npm run sync-data
```

**Trigger GitHub Action Manually**:
1. Go to **Actions** tab in your GitHub repository
2. Select **Daily Stock Data Sync** workflow
3. Click **Run workflow** → **Run workflow**
4. Check the logs to see progress

## How It Works

### Workflow Schedule
- **Automatic**: Runs daily at 6 AM UTC (1 AM EST / 10 PM PST)
- **Manual**: Can be triggered anytime from GitHub Actions UI

### Data Collection Process

1. **Fetches data** for all tickers in `MARKET_SECTORS` (currently ~110 tickers)
2. **Rate limiting**: 7.5 seconds between API calls (complies with free tier limits)
3. **Upserts data**: Updates existing records, inserts new ones
4. **Error handling**: Logs failures, continues with remaining tickers

### Expected Runtime
- ~110 tickers × 7.5 seconds = **~14 minutes** per run
- API calls: ~110 calls/day (well within 800 calls/day limit)

### Data Stored

For each ticker:
- Up to **5,000 days** of historical data (~13 years)
- Daily closing prices
- Sector classification
- Company name and ETF flag
- Sync timestamp

## Database Schema

### Main Table: `stock_data`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `ticker` | VARCHAR(10) | Stock ticker symbol |
| `sector` | VARCHAR(100) | Market sector |
| `company_name` | VARCHAR(255) | Company/ETF name |
| `date` | DATE | Trading date |
| `close_price` | DECIMAL(10,2) | Closing price |
| `is_etf` | BOOLEAN | ETF flag |
| `synced_at` | TIMESTAMP | Last sync time |

### Views

- **`latest_stock_prices`**: Most recent price for each ticker
- **`sector_aggregates`**: 30-day sector statistics

## Querying the Data

### Get Latest Prices
```sql
SELECT * FROM latest_stock_prices 
ORDER BY ticker;
```

### Get Historical Data for Ticker
```sql
SELECT date, close_price 
FROM stock_data 
WHERE ticker = 'AAPL' 
ORDER BY date DESC 
LIMIT 365;
```

### Get Sector Performance
```sql
SELECT * FROM sector_aggregates 
ORDER BY avg_price DESC;
```

### Get All Tickers in a Sector
```sql
SELECT DISTINCT ticker, company_name, is_etf
FROM stock_data
WHERE sector = 'Technology'
ORDER BY is_etf DESC, ticker;
```

## Monitoring

### Check Sync Status

View workflow runs:
- Go to **Actions** tab → **Daily Stock Data Sync**
- Green ✅ = Success
- Red ❌ = Failure (check logs)

### Check Database

In Supabase:
```sql
-- Last sync times by ticker
SELECT ticker, MAX(synced_at) as last_sync
FROM stock_data
GROUP BY ticker
ORDER BY last_sync DESC;

-- Count records per ticker
SELECT ticker, COUNT(*) as record_count
FROM stock_data
GROUP BY ticker
ORDER BY record_count DESC;
```

## Troubleshooting

### API Rate Limits Exceeded
- Free tier: 800 calls/day
- Current usage: ~110 calls/day
- If you add more tickers, consider upgrading or reducing frequency

### Sync Failures
1. Check GitHub Actions logs for specific errors
2. Verify all secrets are set correctly
3. Check Supabase service role permissions
4. Verify Twelve Data API key is valid

### Missing Data
- Some tickers may not have full history
- API errors are logged but don't stop the entire sync
- Check logs for specific ticker failures

## Cost Estimate

- **Twelve Data API**: Free (within limits)
- **Supabase**: Free tier includes:
  - 500 MB database
  - ~5 years of data for ~110 tickers = ~200K rows = ~50 MB
  - Well within free tier limits
- **GitHub Actions**: Free for public repos, 2000 minutes/month for private repos
  - Daily run = ~14 minutes × 30 days = 420 minutes/month

## Adding More Tickers

To add more tickers, edit `src/components/SeriesInput.tsx`:

```typescript
export const MARKET_SECTORS = {
  'Technology': [
    // Add new ticker
    { ticker: 'TSLA', name: 'Tesla Inc.', isETF: false },
  ],
  // Or add new sector
  'Crypto': [
    { ticker: 'COIN', name: 'Coinbase', isETF: false },
  ]
};
```

Changes will be automatically picked up on the next sync.

## Security Notes

- Never commit API keys or secrets to git
- Use GitHub Secrets for all sensitive data
- Supabase service role key should only be used in secure environments
- Consider enabling additional RLS policies for production

## Support

For issues:
1. Check GitHub Actions logs
2. Verify Supabase connection in SQL Editor
3. Test API key at https://twelvedata.com/account
4. Review rate limits and quotas
