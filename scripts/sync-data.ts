/**
 * Daily data sync script for GitHub Actions
 * Fetches stock data for all tickers in MARKET_SECTORS and stores in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { MARKET_SECTORS } from '../src/components/SeriesInput.js';

interface StockDataPoint {
  ticker: string;
  sector: string;
  company_name: string;
  date: string;
  close_price: number;
  is_etf: boolean;
  synced_at: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const twelveDataApiKey = process.env.TWELVE_DATA_API_KEY!;

if (!supabaseUrl || !supabaseKey || !twelveDataApiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Rate limiting: Free tier allows 8 requests per minute
const RATE_LIMIT_DELAY = 7500; // 7.5 seconds between requests

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchStockData(symbol: string): Promise<any[]> {
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=5000&apikey=${twelveDataApiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || 'API error');
    }
    
    if (!data.values || data.values.length === 0) {
      throw new Error('No data returned');
    }
    
    return data.values;
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error);
    throw error;
  }
}

async function upsertStockData(records: StockDataPoint[]): Promise<void> {
  const { data, error } = await supabase
    .from('stock_data')
    .upsert(records, {
      onConflict: 'ticker,date',
      ignoreDuplicates: false
    });
  
  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }
}

async function syncAllTickers() {
  const startTime = Date.now();
  let totalTickers = 0;
  let successCount = 0;
  let errorCount = 0;
  
  console.log('🚀 Starting daily stock data sync...');
  console.log(`📅 Sync timestamp: ${new Date().toISOString()}`);
  
  // Count total tickers
  for (const sector of Object.keys(MARKET_SECTORS)) {
    totalTickers += MARKET_SECTORS[sector as keyof typeof MARKET_SECTORS].length;
  }
  
  console.log(`📊 Total tickers to sync: ${totalTickers}\n`);
  
  let processedCount = 0;
  
  for (const [sectorName, companies] of Object.entries(MARKET_SECTORS) as [string, Array<{ticker: string, name: string, isETF: boolean}>][]) {
    console.log(`\n📁 Sector: ${sectorName} (${companies.length} tickers)`);
    
    for (const company of companies) {
      processedCount++;
      const { ticker, name, isETF } = company;
      
      try {
        console.log(`  [${processedCount}/${totalTickers}] Fetching ${ticker}...`);
        
        // Fetch data from Twelve Data API
        const values = await fetchStockData(ticker);
        
        // Transform to database records
        const records: StockDataPoint[] = values.map((item: any) => ({
          ticker,
          sector: sectorName,
          company_name: name,
          date: item.datetime,
          close_price: parseFloat(item.close),
          is_etf: isETF || false,
          synced_at: new Date().toISOString()
        }));
        
        // Upsert to Supabase
        await upsertStockData(records);
        
        successCount++;
        console.log(`    ✅ Success: ${records.length} data points saved`);
        
        // Rate limiting: wait before next request
        if (processedCount < totalTickers) {
          await sleep(RATE_LIMIT_DELAY);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`    ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Sync Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}/${totalTickers}`);
  console.log(`❌ Failed: ${errorCount}/${totalTickers}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log('='.repeat(60));
  
  if (errorCount > 0) {
    console.warn(`\n⚠️  ${errorCount} ticker(s) failed to sync`);
    process.exit(1);
  }
  
  console.log('\n✨ Sync completed successfully!');
}

// Run the sync
syncAllTickers().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
