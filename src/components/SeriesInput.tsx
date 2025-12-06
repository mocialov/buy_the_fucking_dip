/**
 * SeriesInput: Input controls for series data and detection parameters
 */

import React, { useState, useEffect } from 'react';
import { InteractiveSeriesChart } from './InteractiveSeriesChart';
import type { FindAllDipsOptions, TimeInterval, DataPoint } from '../dip/types';
import { TIME_INTERVALS } from '../dip/types';
import { getActiveApiKey } from '../config/apiConfig';
import { fetchStockDataFromSupabase, isSupabaseAvailable } from '../services/supabaseService';

interface SeriesInputProps {
  onAnalyze: (series: number[] | DataPoint[], options: FindAllDipsOptions) => void;
  selectedInterval?: TimeInterval;
}

export interface IntervalAnalysis {
  interval: TimeInterval;
  series: DataPoint[];
  dips: import('../dip/types').DipMetrics[];
}

export interface SectorAnalysis {
  ticker: string;
  companyName: string;
  fullSeries: DataPoint[];
  intervalAnalyses: IntervalAnalysis[];
  error?: string;
  isETF?: boolean;
}

const EXAMPLE_SERIES = {
  simple: '10,10,10,9,8,7,8,9,10,10,10,9.5,8,7,8.5,9.5,10',
  withNoise: '10,10.2,9.9,10.1,9,8,7.5,8.2,9.1,10,10.3,9.8,9.5,8.1,7.2,8.6,9.7,10.1',
  multiDip: '5,5,4,3,2.5,3,4,5,5,4.5,3,2,3,4.5,5',
};

export const MARKET_SECTORS = {
  'Major Indices': [
    {
      ticker: 'SPY',
      name: "S&P 500",
      isETF: true
    },
    {
      ticker: 'QQQ',
      name: "Nasdaq-100",
      isETF: true
    },
    {
      ticker: 'DIA',
      name: "Dow Jones Industrial Average",
      isETF: true
    },
    {
      ticker: 'IWM',
      name: "Russell 2000",
      isETF: true
    },
    {
      ticker: 'VOO',
      name: "Vanguard S&P 500 ETF",
      isETF: true
    },
    {
      ticker: 'VTI',
      name: "Vanguard Total Stock Market ETF",
      isETF: true
    },
    {
      ticker: 'VUG',
      name: "Vanguard Russell 1000 ETF",
      isETF: true
    },
    {
      ticker: 'VTHR',
      name: "Vanguard Russell 3000 ETF",
      isETF: true
    }
  ],
  'Technology': [
    {
      ticker: 'XLK',
      name: 'Technology Select Sector SPDR',
      isETF: true
    },
    {
      ticker: 'VGT',
      name: 'Vanguard Information Technology ETF',
      isETF: true
    },
    { ticker: 'AAPL', name: 'Apple Inc.', isETF: false },
    { ticker: 'MSFT', name: 'Microsoft Corporation', isETF: false },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', isETF: false },
    { ticker: 'NVDA', name: 'NVIDIA Corporation', isETF: false },
    { ticker: 'META', name: 'Meta Platforms', isETF: false },
    { ticker: 'TSLA', name: 'Tesla Inc.', isETF: false },
    { ticker: 'AVGO', name: 'Broadcom Inc.', isETF: false },
    { ticker: 'ORCL', name: 'Oracle Corporation', isETF: false },
    { ticker: 'CSCO', name: 'Cisco Systems', isETF: false },
    { ticker: 'ADBE', name: 'Adobe Inc.', isETF: false },
  ],
  'Financial Services': [
    {
      ticker: "XLF",
      name: "Financial Select Sector SPDR",
      isETF: true
    },
    {
      ticker: "IYG",
      name: "iShares U.S. Financial Services ETF",
      isETF: true
    },
    {
      ticker: "KBE",
      name: "SPDR S&P Bank ETF",
      isETF: true
    },
    { ticker: 'JPM', name: 'JPMorgan Chase', isETF: false },
    { ticker: 'BAC', name: 'Bank of America', isETF: false },
    { ticker: 'WFC', name: 'Wells Fargo', isETF: false },
    { ticker: 'GS', name: 'Goldman Sachs', isETF: false },
    { ticker: 'MS', name: 'Morgan Stanley', isETF: false },
    { ticker: 'C', name: 'Citigroup', isETF: false },
    { ticker: 'BLK', name: 'BlackRock', isETF: false },
    { ticker: 'SCHW', name: 'Charles Schwab', isETF: false },
    { ticker: 'AXP', name: 'American Express', isETF: false },
    { ticker: 'USB', name: 'U.S. Bancorp', isETF: false },
  ],
  'Healthcare': [
    {
      ticker: "XLV",
      name: "Health Care Select Sector SPDR",
      isETF: true
    },
    {
      ticker: "VHT",
      name: "Vanguard Health Care ETF",
      isETF: true
    },
    { ticker: 'JNJ', name: 'Johnson & Johnson', isETF: false },
    { ticker: 'UNH', name: 'UnitedHealth Group', isETF: false },
    { ticker: 'PFE', name: 'Pfizer Inc.', isETF: false },
    // { ticker: 'LLY', name: 'Eli Lilly' },
    // { ticker: 'ABBV', name: 'AbbVie Inc.' },
    // { ticker: 'MRK', name: 'Merck & Co.' },
    // { ticker: 'TMO', name: 'Thermo Fisher Scientific' },
    // { ticker: 'ABT', name: 'Abbott Laboratories' },
    // { ticker: 'DHR', name: 'Danaher Corporation' },
    // { ticker: 'CVS', name: 'CVS Health' },
  ],
  'Consumer Discretionary': [
    {
      ticker: "XLY",
      name: "Consumer Discretionary Select Sector SPDR",
      isETF: true
    },
    {
      ticker: "VCR",
      name: "Vanguard Consumer Discretionary ETF",
      isETF: true
    },
    { ticker: 'AMZN', name: 'Amazon.com', isETF: false },
    { ticker: 'HD', name: 'Home Depot', isETF: false },
    { ticker: 'MCD', name: 'McDonald\'s', isETF: false },
    { ticker: 'NKE', name: 'Nike Inc.', isETF: false },
    { ticker: 'SBUX', name: 'Starbucks', isETF: false },
    { ticker: 'LOW', name: 'Lowe\'s Companies', isETF: false },
    { ticker: 'TJX', name: 'TJX Companies', isETF: false },
    { ticker: 'BKNG', name: 'Booking Holdings', isETF: false },
    { ticker: 'MAR', name: 'Marriott International', isETF: false },
    { ticker: 'GM', name: 'General Motors', isETF: false },
  ],
  'Consumer Staples': [
    {
      ticker: "XLP",
      name: "Consumer Staples Select Sector SPDR",
      isETF: true
    },
    {
      ticker: "VDC",
      name: "Vanguard Consumer Staples ETF",
      isETF: true
    },
    { ticker: 'WMT', name: 'Walmart Inc.', isETF: false },
    { ticker: 'PG', name: 'Procter & Gamble', isETF: false },
    { ticker: 'KO', name: 'The Coca-Cola Company', isETF: false },
    { ticker: 'PEP', name: 'PepsiCo Inc.', isETF: false },
    { ticker: 'COST', name: 'Costco Wholesale', isETF: false },
    { ticker: 'PM', name: 'Philip Morris International', isETF: false },
    { ticker: 'MO', name: 'Altria Group', isETF: false },
    { ticker: 'MDLZ', name: 'Mondelez International', isETF: false },
    { ticker: 'CL', name: 'Colgate-Palmolive', isETF: false },
    { ticker: 'KMB', name: 'Kimberly-Clark', isETF: false },
  ],
  'Energy': [
    {
      ticker: "XLE",
      name: "Energy Select Sector SPDR",
      isETF: true
    },
    {
      ticker: "VDE",
      name: "Vanguard Energy ETF",
      isETF: true
    },
    { ticker: 'XOM', name: 'Exxon Mobil', isETF: false },
    { ticker: 'CVX', name: 'Chevron Corporation', isETF: false },
    { ticker: 'COP', name: 'ConocoPhillips', isETF: false },
    // { ticker: 'SLB', name: 'Schlumberger' },
    // { ticker: 'EOG', name: 'EOG Resources' },
    // { ticker: 'MPC', name: 'Marathon Petroleum' },
    // { ticker: 'PSX', name: 'Phillips 66' },
    // { ticker: 'VLO', name: 'Valero Energy' },
    // { ticker: 'OXY', name: 'Occidental Petroleum' },
    // { ticker: 'HAL', name: 'Halliburton' },
  ],
  'Industrials': [
    {
      ticker: "XLI",
      name: "Industrial Select Sector SPDR",
      isETF: true
    },
    {
      ticker: "VIS",
      name: "Vanguard Industrials ETF",
      isETF: true
    },
    { ticker: 'BA', name: 'Boeing Company', isETF: false },
    { ticker: 'CAT', name: 'Caterpillar Inc.', isETF: false },
    { ticker: 'GE', name: 'General Electric', isETF: false },
    { ticker: 'UPS', name: 'United Parcel Service', isETF: false },
    { ticker: 'HON', name: 'Honeywell International', isETF: false },
    { ticker: 'RTX', name: 'Raytheon Technologies', isETF: false },
    { ticker: 'LMT', name: 'Lockheed Martin', isETF: false },
    { ticker: 'UNP', name: 'Union Pacific', isETF: false },
    { ticker: 'DE', name: 'Deere & Company', isETF: false },
    { ticker: 'MMM', name: '3M Company', isETF: false },
  ],
  'Materials': [
    {
      ticker: "XLB",
      name: "Materials Select Sector SPDR",
      isETF: true
    },
    {
      ticker: "VAW",
      name: "Vanguard Materials ETF",
      isETF: true
    },
    { ticker: 'LIN', name: 'Linde plc', isETF: false },
    { ticker: 'APD', name: 'Air Products & Chemicals', isETF: false },
    { ticker: 'SHW', name: 'Sherwin-Williams', isETF: false },
    { ticker: 'FCX', name: 'Freeport-McMoRan', isETF: false },
    { ticker: 'NEM', name: 'Newmont Corporation', isETF: false },
    { ticker: 'ECL', name: 'Ecolab Inc.', isETF: false },
    { ticker: 'DD', name: 'DuPont de Nemours', isETF: false },
    { ticker: 'NUE', name: 'Nucor Corporation', isETF: false },
    { ticker: 'DOW', name: 'Dow Inc.', isETF: false },
    { ticker: 'PPG', name: 'PPG Industries', isETF: false },
  ],
  'Communication Services': [
    {
      ticker: "XLC",
      name: "Communication Services Select Sector SPDR",
      isETF: true
    },
    {
      ticker: "VOX",
      name: "Vanguard Communication Services ETF",
      isETF: true
    },
    { ticker: 'DIS', name: 'Walt Disney', isETF: false },
    { ticker: 'NFLX', name: 'Netflix Inc.', isETF: false },
    { ticker: 'CMCSA', name: 'Comcast Corporation', isETF: false },
    { ticker: 'T', name: 'AT&T Inc.', isETF: false },
    { ticker: 'VZ', name: 'Verizon Communications', isETF: false },
    { ticker: 'TMUS', name: 'T-Mobile US', isETF: false },
    { ticker: 'CHTR', name: 'Charter Communications', isETF: false },
    { ticker: 'EA', name: 'Electronic Arts', isETF: false },
  ],
};

/**
 * Generate realistic stock market price data with random walk and dips
 */
function generateRandomSeries(): string {
  // Random length between 100 and 250 trading days
  const length = Math.floor(Math.random() * 150) + 100;
  
  // Random starting price between $50 and $200
  const startPrice = 50 + Math.random() * 150;
  
  // Random market characteristics
  const trend = (Math.random() - 0.45) * 0.001; // Slight upward bias (-0.05% to +0.1% daily)
  const volatility = 0.008 + Math.random() * 0.015; // 0.8% to 2.3% daily volatility
  
  // Decide on dip characteristics
  const scenarios = [
    { name: 'stable', dipLocations: [] },
    { name: 'flash_crash', dipLocations: [[Math.floor(length * 0.4), 5, 0.08]] },
    { name: 'correction', dipLocations: [[Math.floor(length * 0.3), 15, 0.12]] },
    { name: 'multiple', dipLocations: [
        [Math.floor(length * 0.25), 8, 0.06],
        [Math.floor(length * 0.55), 12, 0.10],
        [Math.floor(length * 0.80), 10, 0.08]
      ]
    },
    { name: 'ongoing', dipLocations: [[Math.floor(length * 0.75), length - Math.floor(length * 0.75), 0.15]] }
  ];
  
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  const prices: number[] = [startPrice];
  
  // Generate stock prices using geometric Brownian motion
  for (let i = 1; i < length; i++) {
    // Random walk with drift
    const randomReturn = gaussianRandom(trend, volatility);
    let newPrice = prices[i - 1] * (1 + randomReturn);
    
    // Apply dips using sine wave for smooth transitions
    let dipAdjustment = 0;
    for (const [dipStart, dipDuration, dipDepth] of scenario.dipLocations) {
      if (i >= dipStart && i < dipStart + dipDuration) {
        const progress = (i - dipStart) / dipDuration;
        // Smooth sine-based dip
        const dipFactor = Math.sin(progress * Math.PI);
        dipAdjustment -= dipDepth * dipFactor * volatility * 3;
      }
    }
    
    newPrice = prices[i - 1] * (1 + randomReturn + dipAdjustment);
    
    // Prevent unrealistic price movements (circuit breaker)
    newPrice = Math.max(newPrice, startPrice * 0.3);
    newPrice = Math.min(newPrice, startPrice * 3.0);
    
    prices.push(newPrice);
  }
  
  // Round to 2 decimal places and convert to string
  return prices.map(v => v.toFixed(2)).join(',');
}

/**
 * Generate random number from normal distribution using Box-Muller transform
 */
function gaussianRandom(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/**
 * Fetch stock price data using Twelve Data API (FREE, STABLE, CORS-ENABLED)
 * 
 * Twelve Data offers:
 * - 800 API calls/day (free tier)
 * - No credit card required
 * - Proper CORS support
 * - Free API key: https://twelvedata.com/pricing
 */
export async function fetchStockData(symbol: string, apiKey?: string): Promise<DataPoint[]> {
  const { key } = apiKey ? { key: apiKey } : getActiveApiKey(); // Use provided key or get from config
  
  try {
    console.log(`Fetching ${symbol} data from Twelve Data (free, 800 calls/day)...`);
    
    // Twelve Data time series endpoint - native CORS support
    // Get last 5 years of data (approximately 1250 trading days)
    const twelveDataUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=1250&apikey=${key}`;
    const response = await fetch(twelveDataUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for errors
    if (data.status === 'error') {
      throw new Error(data.message || 'API error');
    }
    
    if (!data.values || data.values.length === 0) {
      throw new Error('No price data available');
    }
    
    // Extract data points with dates (data comes newest first, so reverse it)
    const dataPoints: DataPoint[] = data.values
      .reverse() // Make it oldest to newest
      .map((item: any) => ({
        date: new Date(item.datetime),
        value: parseFloat(item.close)
      }))
      .filter((point: DataPoint) => !isNaN(point.value));
    
    if (dataPoints.length === 0) {
      throw new Error('No valid price data');
    }
    
    console.log(`✓ Successfully loaded ${dataPoints.length} days of ${symbol} data from Twelve Data`);
    return dataPoints;
    
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error);
    throw error;
  }
}

/**
 * Hybrid fetch: Try Supabase first, fallback to Twelve Data API
 * This optimizes API usage by using cached data when available
 */
export async function fetchStockDataHybrid(symbol: string, apiKey?: string): Promise<DataPoint[]> {
  // Try Supabase first if available
  if (isSupabaseAvailable()) {
    console.log(`Attempting to fetch ${symbol} from Supabase...`);
    const supabaseData = await fetchStockDataFromSupabase(symbol);
    
    if (supabaseData && supabaseData.length > 0) {
      console.log(`✓ Using cached data from Supabase for ${symbol}`);
      return supabaseData;
    }
  }
  
  // Fallback to Twelve Data API
  console.log(`${symbol} not in cache, fetching from Twelve Data API...`);
  return fetchStockData(symbol, apiKey);
}

export const SeriesInput: React.FC<SeriesInputProps> = ({ onAnalyze, selectedInterval = '12m' }) => {
  const [seriesText, setSeriesText] = useState(EXAMPLE_SERIES.simple);
  const [k, setK] = useState(0.25);
  const [minWidth, setMinWidth] = useState(2);
  const [multiScale, setMultiScale] = useState(true);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [fullStockData, setFullStockData] = useState<DataPoint[] | null>(null);
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  // Get sliced series based on selected interval
  const getSlicedSeries = (fullData: DataPoint[], interval: TimeInterval): DataPoint[] => {
    const days = TIME_INTERVALS[interval].days;
    return fullData.slice(-days);
  };

  // Effect to re-analyze when interval changes and we have stock data
  useEffect(() => {
    if (fullStockData) {
      const slicedData = getSlicedSeries(fullStockData, selectedInterval);
      const options: FindAllDipsOptions = { k, minWidth, multiScale };
      onAnalyze(slicedData, options);
    }
  }, [selectedInterval, fullStockData, k, minWidth, multiScale, onAnalyze]);

  const handleAnalyze = () => {
    try {
      const series = seriesText
        .split(',')
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n));

      if (series.length < 3) {
        alert('Please enter at least 3 numbers');
        return;
      }

      const options: FindAllDipsOptions = {
        k,
        minWidth,
        multiScale,
      };

      onAnalyze(series, options);
    } catch (err) {
      alert('Invalid input. Please enter comma-separated numbers.');
    }
  };

  const loadExample = (key: keyof typeof EXAMPLE_SERIES) => {
    setSeriesText(EXAMPLE_SERIES[key]);
  };

  const generateRandom = () => {
    setSeriesText(generateRandomSeries());
  };

  const loadMicrosoftStock = async () => {
    setIsLoadingStock(true);
    try {
      const fullData = await fetchStockData('MSFT'); // Uses configured API key
      setFullStockData(fullData);
      
      // Slice data according to selected interval
      const slicedData = getSlicedSeries(fullData, selectedInterval);
      const stockData = slicedData.map(p => p.value.toFixed(2)).join(',');
      setSeriesText(stockData);
      console.log(`✓ Successfully loaded ${slicedData.length} days of MSFT data (${TIME_INTERVALS[selectedInterval].label})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load stock data';
      alert(`Error loading Microsoft stock data: ${message}\n\nUsing Twelve Data (free, 800 calls/day).\nCheck browser console (F12) for details.`);
    } finally {
      setIsLoadingStock(false);
    }
  };

  return (
    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
      {/* Collapsible Input Time Series Section */}
      <div style={{ marginBottom: '20px', background: 'white', borderRadius: '6px', border: '1px solid #ccc' }}>
        <button
          onClick={() => setIsInputExpanded(!isInputExpanded)}
          style={{
            width: '100%',
            padding: '12px 15px',
            background: '#f9f9f9',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a1a1a'
          }}
        >
          <span>🔧 Input Time Series (Debug)</span>
          <span style={{ fontSize: '20px' }}>{isInputExpanded ? '▼' : '▶'}</span>
        </button>

        {isInputExpanded && (
          <div style={{ padding: '15px' }}>
            {/* Twelve Data API Info */}
            <div style={{ marginBottom: '15px', padding: '12px', background: '#D1FAE5', borderRadius: '4px', border: '1px solid #10B981' }}>
              <div style={{ fontSize: '13px', color: '#065F46', lineHeight: '1.6', fontWeight: '500' }}>
                ✅ <strong>Using Twelve Data API</strong> - FREE & RELIABLE!<br/>
                <span style={{ fontSize: '12px', fontWeight: 'normal' }}>
                  • Enter your API key in the 🔑 field above (or use the demo key)<br/>
                  • 800 API calls/day on free tier<br/>
                  • Native CORS support (no proxy needed)<br/>
                  • Get your FREE key: <a href="https://twelvedata.com/pricing" target="_blank" rel="noopener noreferrer" style={{ color: '#0369A1', fontWeight: '600' }}>twelvedata.com/pricing</a>
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '10px', padding: '10px', background: '#FEF3C7', borderRadius: '4px', fontSize: '13px', color: '#92400E' }}>
              ⚠️ <strong>Single Stock Analysis Below</strong> - For sector analysis, use the section above
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                Series Data (comma-separated):
              </label>
              <textarea
                value={seriesText}
                onChange={(e) => setSeriesText(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
            </div>

            {/* Interactive Chart */}
            {(() => {
              try {
                const series = seriesText
                  .split(',')
                  .map(s => parseFloat(s.trim()))
                  .filter(n => !isNaN(n));
                if (series.length >= 3) {
                  return (
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                        Interactive Chart Preview:
                      </label>
                      <InteractiveSeriesChart series={series} />
                    </div>
                  );
                }
              } catch (err) {
                // Invalid data, don't show chart
              }
              return null;
            })()}

            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => loadExample('simple')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  border: '1px solid #666',
                  background: 'white'
                }}
              >
                Load Simple Example
              </button>
              <button
                onClick={() => loadExample('withNoise')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  border: '1px solid #666',
                  background: 'white'
                }}
              >
                Load Noisy Example
              </button>
              <button
                onClick={() => loadExample('multiDip')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  border: '1px solid #666',
                  background: 'white'
                }}
              >
                Load Multi-Dip Example
              </button>
              <button
                onClick={generateRandom}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  border: '1px solid #2563EB',
                  background: '#EFF6FF',
                  color: '#2563EB',
                  fontWeight: '600'
                }}
              >
                🎲 Generate Random Series
              </button>
              <button
                onClick={loadMicrosoftStock}
                disabled={isLoadingStock}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: isLoadingStock ? 'not-allowed' : 'pointer',
                  borderRadius: '4px',
                  border: '1px solid #16A34A',
                  background: isLoadingStock ? '#F0FDF4' : '#DCFCE7',
                  color: '#16A34A',
                  fontWeight: '600',
                  opacity: isLoadingStock ? 0.6 : 1
                }}
              >
                {isLoadingStock ? '⏳ Loading...' : '📈 Load MSFT Stock (Twelve Data)'}
              </button>
            </div>

            <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>Detection Parameters</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  Sensitivity (k): {k.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={k}
                  onChange={(e) => setK(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <small style={{ color: '#666' }}>Lower = more permissive</small>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  Min Width: {minWidth}
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                  value={minWidth}
                  onChange={(e) => setMinWidth(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
                <small style={{ color: '#666' }}>Minimum dip samples</small>
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={multiScale}
                  onChange={(e) => setMultiScale(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ fontSize: '14px' }}>Enable multi-scale detection (recommended for slow dips)</span>
              </label>
            </div>

            <button
              onClick={handleAnalyze}
              style={{
                marginTop: '20px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                borderRadius: '6px',
                border: 'none',
                background: '#2563EB',
                color: 'white',
                width: '100%'
              }}
            >
              Detect Dips
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
