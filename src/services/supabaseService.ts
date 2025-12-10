/**
 * Supabase Service
 * Handles fetching stock data from Supabase database
 * Updated: 2025-12-10 - Fixed query limit issue for batch fetching
 */

import { createClient } from '@supabase/supabase-js';
import type { DataPoint } from '../dip/types';

// Get Supabase credentials from environment variables
// Support both Vite (import.meta.env) and Node.js (process.env) environments
const supabaseUrl = typeof import.meta !== 'undefined' && import.meta.env 
  ? import.meta.env.VITE_SUPABASE_URL 
  : undefined;
const supabaseAnonKey = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : undefined;

// Initialize Supabase client (only if credentials are available)
let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✓ Supabase client initialized');
} else {
  console.warn('⚠️  Supabase credentials not found - will use API fallback only');
}

/**
 * Check if Supabase is available
 */
export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}

/**
 * Fetch stock data from Supabase for a given ticker
 * Returns null if ticker not found or Supabase not available
 */
export async function fetchStockDataFromSupabase(ticker: string): Promise<DataPoint[] | null> {
  if (!supabase) {
    return null;
  }

  try {
    // Normalize ticker to uppercase for case-insensitive matching
    const normalizedTicker = ticker.toUpperCase();
    
    const { data, error } = await supabase
      .from('stock_data')
      .select('date, close_price')
      .eq('ticker', normalizedTicker)
      .order('date', { ascending: true });

    if (error) {
      console.error(`Supabase error for ${ticker}:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Convert to DataPoint format
    const dataPoints: DataPoint[] = data.map((row: any) => ({
      date: new Date(row.date),
      value: parseFloat(row.close_price)
    }));

    console.log(`✓ Loaded ${dataPoints.length} days of ${ticker} from Supabase`);
    return dataPoints;

  } catch (error) {
    console.error(`Failed to fetch ${ticker} from Supabase:`, error);
    return null;
  }
}

/**
 * Fetch stock data for multiple tickers at once (batch query)
 * Much faster than calling fetchStockDataFromSupabase multiple times
 * Returns a Map of ticker -> DataPoint[]
 */
export async function fetchMultipleStockDataFromSupabase(tickers: string[]): Promise<Map<string, DataPoint[]>> {
  const result = new Map<string, DataPoint[]>();
  
  if (!supabase || tickers.length === 0) {
    return result;
  }

  try {
    console.log(`Batch fetching ${tickers.length} tickers from Supabase...`);
    console.log('Requested tickers:', tickers);
    
    // Normalize all tickers to uppercase for case-insensitive matching
    const normalizedTickers = tickers.map(t => t.toUpperCase());
    console.log('Normalized tickers:', normalizedTickers);
    
    // Fetch all data using pagination to bypass server-side max-rows limit
    // Supabase PostgREST may have max-rows set to 1000, so we paginate
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('stock_data')
        .select('ticker, date, close_price')
        .in('ticker', normalizedTickers)
        .order('date', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Supabase batch fetch error:', error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData.push(...data);
        console.log(`Fetched page ${page + 1}: ${data.length} rows (total: ${allData.length})`);
        
        // If we got less than pageSize, we've reached the end
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    if (allData.length === 0) {
      console.log('No data found for any tickers');
      return result;
    }

    console.log(`Total rows fetched: ${allData.length}`);

    // Group data by ticker
    const grouped = new Map<string, any[]>();
    allData.forEach((row: any) => {
      if (!grouped.has(row.ticker)) {
        grouped.set(row.ticker, []);
      }
      grouped.get(row.ticker)!.push(row);
    });

    // Convert to DataPoint format
    // Map normalized (uppercase) tickers back to original case for result
    const tickerMap = new Map(tickers.map(t => [t.toUpperCase(), t]));
    
    console.log(`Found ${grouped.size} tickers in Supabase:`, Array.from(grouped.keys()));
    
    grouped.forEach((rows, ticker) => {
      const dataPoints: DataPoint[] = rows.map((row: any) => ({
        date: new Date(row.date),
        value: parseFloat(row.close_price)
      }));
      // Use original ticker case from input
      const originalTicker = tickerMap.get(ticker) || ticker;
      result.set(originalTicker, dataPoints);
      console.log(`  Mapped ${ticker} -> ${originalTicker}: ${dataPoints.length} points`);
    });

    console.log(`✓ Batch loaded ${result.size}/${tickers.length} tickers from Supabase`);
    
    // Log missing tickers
    const missingTickers = tickers.filter(t => !result.has(t));
    if (missingTickers.length > 0) {
      console.log(`⚠️  Missing from Supabase:`, missingTickers);
    }
    
    return result;

  } catch (error) {
    console.error('Failed batch fetch from Supabase:', error);
    return result;
  }
}

/**
 * Get list of all tickers available in Supabase
 */
export async function getAvailableTickers(): Promise<string[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('stock_data')
      .select('ticker')
      .limit(1000);

    if (error) {
      console.error('Error fetching ticker list:', error);
      return [];
    }

    // Get unique tickers
    const tickers = [...new Set(data.map((row: any) => row.ticker))];
    return tickers;

  } catch (error) {
    console.error('Failed to get ticker list:', error);
    return [];
  }
}

/**
 * Get metadata about a ticker from Supabase
 */
export async function getTickerMetadata(ticker: string): Promise<{
  sector: string;
  companyName: string;
  isETF: boolean;
  lastSyncDate: Date;
} | null> {
  if (!supabase) {
    return null;
  }

  try {
    // Normalize ticker to uppercase for case-insensitive matching
    const normalizedTicker = ticker.toUpperCase();
    
    const { data, error } = await supabase
      .from('stock_data')
      .select('sector, company_name, is_etf, synced_at')
      .eq('ticker', normalizedTicker)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: any; error: any };

    if (error || !data) {
      return null;
    }

    return {
      sector: data.sector,
      companyName: data.company_name,
      isETF: data.is_etf,
      lastSyncDate: new Date(data.synced_at)
    };

  } catch (error) {
    return null;
  }
}
