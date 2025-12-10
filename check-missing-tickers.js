/**
 * Check if META and AVGO exist in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTickers() {
  const tickersToCheck = ['META', 'AVGO', 'AAPL', 'MSFT']; // Check 2 missing + 2 working
  
  console.log('🔍 Checking tickers in Supabase...\n');
  
  for (const ticker of tickersToCheck) {
    // Check exact match
    const { data: exactMatch, error: exactError } = await supabase
      .from('stock_data')
      .select('ticker, date, close_price')
      .eq('ticker', ticker)
      .order('date', { ascending: false })
      .limit(1);
    
    if (exactError) {
      console.error(`❌ Error querying ${ticker}:`, exactError);
      continue;
    }
    
    if (exactMatch && exactMatch.length > 0) {
      console.log(`✅ ${ticker}: Found (latest: ${exactMatch[0].date}, price: ${exactMatch[0].close_price})`);
      
      // Count total rows
      const { count, error: countError } = await supabase
        .from('stock_data')
        .select('*', { count: 'exact', head: true })
        .eq('ticker', ticker);
      
      if (!countError) {
        console.log(`   Total rows: ${count}`);
      }
    } else {
      console.log(`❌ ${ticker}: NOT FOUND`);
    }
  }
  
  // Now check with .in() query like the app does
  console.log('\n🔍 Testing batch query with .in() method...\n');
  
  const { data: batchData, error: batchError } = await supabase
    .from('stock_data')
    .select('ticker, date, close_price')
    .in('ticker', tickersToCheck)
    .order('date', { ascending: true })
    .limit(10000);
  
  if (batchError) {
    console.error('❌ Batch query error:', batchError);
  } else {
    const grouped = {};
    batchData.forEach(row => {
      if (!grouped[row.ticker]) {
        grouped[row.ticker] = 0;
      }
      grouped[row.ticker]++;
    });
    
    console.log('Batch query results:');
    for (const ticker of tickersToCheck) {
      if (grouped[ticker]) {
        console.log(`  ✅ ${ticker}: ${grouped[ticker]} rows`);
      } else {
        console.log(`  ❌ ${ticker}: NOT FOUND`);
      }
    }
    console.log(`\nTotal rows returned: ${batchData.length}`);
  }
}

checkTickers().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
