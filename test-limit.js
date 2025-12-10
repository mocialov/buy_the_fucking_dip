import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('Testing Supabase query with different limits...\n');

async function test() {
  const tickers = ['META', 'AVGO'];
  
  // Test 1: No limit (default)
  console.log('Test 1: No explicit limit (Supabase default)');
  const { data: data1, error: error1 } = await supabase
    .from('stock_data')
    .select('ticker, date')
    .in('ticker', tickers)
    .order('date', { ascending: true });
  
  if (error1) console.error('Error:', error1);
  else {
    console.log('  Total rows:', data1.length);
    console.log('  META rows:', data1.filter(r => r.ticker === 'META').length);
    console.log('  AVGO rows:', data1.filter(r => r.ticker === 'AVGO').length);
    if (data1.length > 0) {
      console.log('  Date range:', data1[0].date, 'to', data1[data1.length-1].date);
    }
  }
  
  // Test 2: With limit(10000)
  console.log('\nTest 2: With .limit(10000)');
  const { data: data2, error: error2 } = await supabase
    .from('stock_data')
    .select('ticker, date')
    .in('ticker', tickers)
    .order('date', { ascending: true})
    .limit(10000);
  
  if (error2) console.error('Error:', error2);
  else {
    console.log('  Total rows:', data2.length);
    console.log('  META rows:', data2.filter(r => r.ticker === 'META').length);
    console.log('  AVGO rows:', data2.filter(r => r.ticker === 'AVGO').length);
    if (data2.length > 0) {
      console.log('  Date range:', data2[0].date, 'to', data2[data2.length-1].date);
    }
  }
  
  process.exit(0);
}

test();
