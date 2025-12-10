#!/usr/bin/env node
/**
 * Supabase Data Verification Script
 * Checks if data exists for common tickers directly from Supabase
 * 
 * Usage: node verify-supabase-data.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const COMMON_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META',
  'SPY', 'QQQ', 'DIA', 'IWM',
  'JPM', 'BAC', 'WFC', 'GS'
];

async function verifyData() {
  console.log('🔍 Verifying Supabase Data...\n');
  console.log('='.repeat(60));
  
  // 1. Check total row count
  const { count: totalRows } = await supabase
    .from('stock_data')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Total rows in database: ${totalRows || 0}`);
  
  // 2. Check distinct tickers
  const { data: allTickers } = await supabase
    .from('stock_data')
    .select('ticker')
    .limit(1000);
  
  const uniqueTickers = [...new Set(allTickers?.map(r => r.ticker) || [])];
  console.log(`📈 Total unique tickers: ${uniqueTickers.length}`);
  
  if (uniqueTickers.length > 0) {
    console.log('First 10 tickers:', uniqueTickers.slice(0, 10).join(', '));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Testing Common Tickers:');
  console.log('='.repeat(60));
  
  // 3. Test each common ticker
  let foundCount = 0;
  let notFoundCount = 0;
  
  for (const ticker of COMMON_TICKERS) {
    const { data, error } = await supabase
      .from('stock_data')
      .select('ticker, date, close_price')
      .eq('ticker', ticker)
      .order('date', { ascending: false })
      .limit(1);
    
    if (error) {
      console.log(`  ❌ ${ticker}: ERROR - ${error.message}`);
      notFoundCount++;
    } else if (data && data.length > 0) {
      const latest = data[0];
      console.log(`  ✅ ${ticker}: ${data.length} rows (latest: ${latest.date})`);
      foundCount++;
    } else {
      console.log(`  ⚠️  ${ticker}: No data found`);
      notFoundCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Found: ${foundCount}/${COMMON_TICKERS.length}`);
  console.log(`❌ Not Found: ${notFoundCount}/${COMMON_TICKERS.length}`);
  
  // 4. Check for case sensitivity issues
  console.log('\n' + '='.repeat(60));
  console.log('Case Sensitivity Check:');
  console.log('='.repeat(60));
  
  const testTicker = 'AAPL';
  const variations = [testTicker.toUpperCase(), testTicker.toLowerCase(), 'Aapl'];
  
  for (const variant of variations) {
    const { count } = await supabase
      .from('stock_data')
      .select('*', { count: 'exact', head: true })
      .eq('ticker', variant);
    
    console.log(`  ${variant}: ${count || 0} rows`);
  }
  
  if (notFoundCount > 0) {
    console.log('\n💡 Tip: If tickers are not found, you may need to:');
    console.log('   1. Run the sync script: npm run sync-data');
    console.log('   2. Check RLS policies in Supabase (Authentication → Policies)');
    console.log('   3. Verify SUPABASE_URL and SUPABASE_KEY are correct');
  }
  
  console.log('\n✨ Verification complete!\n');
}

verifyData().catch(error => {
  console.error('💥 Error:', error);
  process.exit(1);
});
