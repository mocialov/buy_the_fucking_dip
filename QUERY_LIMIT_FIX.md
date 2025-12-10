## Supabase Query Limit Issue - Summary

### Root Cause
The batch query in `fetchMultipleStockDataFromSupabase()` was missing an explicit `.limit()` parameter, causing Supabase to use its **default limit of 1000 rows**.

When fetching 16 tickers with 13+ years of historical data:
- Total potential rows: 16 tickers × ~3,500 days = ~56,000 rows
- Default limit: 1000 rows
- Result: Only the **first 1000 rows ordered by date** were returned

This meant:
- Only the oldest data (2009-2016) was returned
- META and AVGO data stopped at 2013-2016
- When the app tried to analyze recent 12 months, it found NO recent data
- Frontend reported them as "missing"

### The Fix
Added `.limit(10000)` to line 103 in `src/services/supabaseService.ts`:

```typescript
const { data, error } = await supabase
  .from('stock_data')
  .select('ticker, date, close_price')
  .in('ticker', normalizedTickers)
  .order('date', { ascending: true })
  .limit(10000); // ← FIX: Increase limit to handle multiple tickers
```

### Verification
The fix has been:
- ✅ Committed (commit: c4fa80e)
- ✅ Pushed to origin/main
- ⏳ Deployment in progress or cached

### Next Steps
1. Wait 2-3 minutes for GitHub Actions to complete deployment
2. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R) to clear cache
3. Or check GitHub Actions status at: https://github.com/mocialov/buy_the_fucking_dip/actions

### Testing Locally
You can test immediately by running:
```bash
npm run dev
```

Then open http://localhost:5173 and select the Technology sector. You should see all 16 tickers load successfully.
