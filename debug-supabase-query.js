/**
 * Debug script to test the exact batch query used by the frontend
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

// The exact tickers from Technology sector
const tickers = [
  'XLK', 'VGT', 'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'AVGO',
  'ORCL', 'CSCO', 'ADBE', 'CRM', 'INTC', 'AMD', 'QCOM', 'IBM'
];

async function testBatchQuery() {
  console.log('🔍 Testing batch query with 16 Technology tickers...\n');
  console.log('Tickers:', tickers.join(', '));
  console.log('\n' + '='.repeat(70) + '\n');
  
  // Normalize to uppercase (same as frontend)
  const normalizedTickers = tickers.map(t => t.toUpperCase());
  
  // Test WITHOUT limit first (to see default behavior)
  console.log('Test 1: Query WITHOUT explicit limit (Supabase default = 1000 rows)');
  const { data: noLimitData, error: noLimitError } = await supabase
    .from('stock_data')
    .select('ticker, date, close_price')
    .in('ticker', normalizedTickers)
    .order('date', { ascending: true });
  
  if (noLimitError) {
    console.error('❌ Error:', noLimitError);
  } else {
    const grouped = {};
    noLimitData.forEach(row => {
      if (!grouped[row.ticker]) grouped[row.ticker] = 0;
      grouped[row.ticker]++;
    });
    
    console.log(`Total rows returned: ${noLimitData.length}`);
    console.log('\nRows per ticker:');
    tickers.forEach(ticker => {
      const count = grouped[ticker] || 0;
      const status = count > 0 ? '✅' : '❌';
      console.log(`  ${status} ${ticker}: ${count} rows`);
    });
    
    const foundCount = Object.keys(grouped).length;
    console.log(`\n📊 Found ${foundCount}/${tickers.length} tickers`);
    const missing = tickers.filter(t => !grouped[t]);
    if (missing.length > 0) {
      console.log(`⚠️  Missing: ${missing.join(', ')}`);
    }
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
  
  // Test WITH limit 10000
  console.log('Test 2: Query WITH .limit(10000)');
  const { data: limitData, error: limitError } = await supabase
    .from('stock_data')
    .select('ticker, date, close_price')
    .in('ticker', normalizedTickers)
    .order('date', { ascending: true })
    .limit(10000);
  
  if (limitError) {
    console.error('❌ Error:', limitError);
  } else {
    const grouped = {};
    limitData.forEach(row => {
      if (!grouped[row.ticker]) grouped[row.ticker] = 0;
      grouped[row.ticker]++;
    });
    
    console.log(`Total rows returned: ${limitData.length}`);
    console.log('\nRows per ticker:');
    tickers.forEach(ticker => {
      const count = grouped[ticker] || 0;
      const status = count > 0 ? '✅' : '❌';
      console.log(`  ${status} ${ticker}: ${count} rows`);
    });
    
    const foundCount = Object.keys(grouped).length;
    console.log(`\n📊 Found ${foundCount}/${tickers.length} tickers`);
    const missing = tickers.filter(t => !grouped[t]);
    if (missing.length > 0) {
      console.log(`⚠️  Missing: ${missing.join(', ')}`);
    }
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
  
  // Get date range for each ticker
  console.log('Test 3: Individual date range check for META and AVGO');
  for (const ticker of ['META', 'AVGO']) {
    const { data, error } = await supabase
      .from('stock_data')
      .select('date')
      .eq('ticker', ticker)
      .order('date', { ascending: true });
    
    if (error) {
      console.error(`❌ ${ticker}: Error -`, error);
    } else if (data && data.length > 0) {
      console.log(`✅ ${ticker}: ${data.length} rows, date range: ${data[0].date} to ${data[data.length-1].date}`);
    } else {
      console.log(`❌ ${ticker}: No data found`);
    }
  }
}

testBatchQuery().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
