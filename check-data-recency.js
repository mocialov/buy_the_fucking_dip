import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const tickers = ['XLK', 'META', 'AVGO', 'AAPL'];

for (const ticker of tickers) {
  const { data, count } = await supabase
    .from('stock_data')
    .select('date', { count: 'exact' })
    .eq('ticker', ticker)
    .order('date', { ascending: false })
    .limit(1);
  
  if (data && data.length > 0) {
    console.log(`${ticker}: ${count} total rows, latest date: ${data[0].date}`);
  }
}

process.exit(0);
