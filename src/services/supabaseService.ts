/**
 * Supabase Service
 * Handles fetching stock data from Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import type { DataPoint } from '../dip/types';

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
    console.log(`Checking Supabase for ${ticker}...`);
    
    const { data, error } = await supabase
      .from('stock_data')
      .select('date, close_price')
      .eq('ticker', ticker)
      .order('date', { ascending: true });

    if (error) {
      console.error(`Supabase error for ${ticker}:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`${ticker} not found in Supabase`);
      return null;
    }

    // Convert to DataPoint format
    const dataPoints: DataPoint[] = data.map((row: any) => ({
      date: new Date(row.date),
      value: parseFloat(row.close_price)
    }));

    console.log(`✓ Loaded ${dataPoints.length} days of ${ticker} data from Supabase`);
    return dataPoints;

  } catch (error) {
    console.error(`Failed to fetch ${ticker} from Supabase:`, error);
    return null;
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
    const { data, error } = await supabase
      .from('stock_data')
      .select('sector, company_name, is_etf, synced_at')
      .eq('ticker', ticker)
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
