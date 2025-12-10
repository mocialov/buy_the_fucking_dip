/**
 * Quick test script to verify Supabase data fetching
 * Run this in browser console or as a standalone script
 */

// Instructions:
// 1. Open your app in the browser
// 2. Open browser DevTools (F12)
// 3. Go to Console tab
// 4. Copy and paste this code

// Test single ticker fetch
async function testSingleTicker(ticker) {
  console.log(`\n=== Testing single ticker: ${ticker} ===`);
  
  const { fetchStockDataFromSupabase } = await import('./src/services/supabaseService.ts');
  
  try {
    const data = await fetchStockDataFromSupabase(ticker);
    if (data && data.length > 0) {
      console.log(`✅ SUCCESS: Found ${data.length} data points for ${ticker}`);
      console.log('First 3 data points:', data.slice(0, 3));
      console.log('Last 3 data points:', data.slice(-3));
    } else {
      console.log(`❌ FAILED: No data found for ${ticker}`);
    }
  } catch (error) {
    console.error(`❌ ERROR for ${ticker}:`, error);
  }
}

// Test multiple ticker batch fetch
async function testBatchFetch(tickers) {
  console.log(`\n=== Testing batch fetch for ${tickers.length} tickers ===`);
  console.log('Tickers:', tickers);
  
  const { fetchMultipleStockDataFromSupabase } = await import('./src/services/supabaseService.ts');
  
  try {
    const dataMap = await fetchMultipleStockDataFromSupabase(tickers);
    console.log(`Found data for ${dataMap.size}/${tickers.length} tickers`);
    
    tickers.forEach(ticker => {
      const data = dataMap.get(ticker);
      if (data && data.length > 0) {
        console.log(`  ✅ ${ticker}: ${data.length} data points`);
      } else {
        console.log(`  ❌ ${ticker}: No data`);
      }
    });
    
    return dataMap;
  } catch (error) {
    console.error('❌ Batch fetch error:', error);
  }
}

// Run tests
(async () => {
  console.log('🔍 Starting Supabase Data Fetch Tests...\n');
  
  // Test individual tickers that you know have data
  await testSingleTicker('AAPL');
  await testSingleTicker('MSFT');
  await testSingleTicker('SPY');
  
  // Test batch fetch
  await testBatchFetch(['AAPL', 'MSFT', 'GOOGL', 'SPY', 'QQQ']);
  
  console.log('\n✨ Tests complete! Check the logs above for results.');
})();
