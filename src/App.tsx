import { useState, useEffect } from 'react';
import { findAllDips } from './dip/detectDip';
import { SeriesInput, SectorAnalysis, MARKET_SECTORS, fetchMultipleStockDataHybrid, fetchStockDataHybrid } from './components/SeriesInput';
import { DipChart } from './components/DipChart';
import { DipResults } from './components/DipResults';
import { RawDataDisplay } from './components/RawDataDisplay';
import { SectorAggregatePanel } from './components/SectorAggregatePanel';
import type { DipMetrics, FindAllDipsOptions, TimeInterval, DataPoint } from './dip/types';
import { TIME_INTERVALS } from './dip/types';
import { getActiveApiKey, saveUserApiKey, getUserApiKey, isDebugMode, DEMO_API_KEY } from './config/apiConfig';
import './App.css';

// Import all images from the images folder
const imageModules = import.meta.glob('./images/*.{png,jpg,jpeg,gif,webp}', { eager: true });
const images = Object.values(imageModules).map((module: any) => module.default);

function App() {
  const [series, setSeries] = useState<DataPoint[]>([]);
  const [dips, setDips] = useState<DipMetrics[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [sectorAnalyses, setSectorAnalyses] = useState<SectorAnalysis[]>([]);
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>('12m');
  const [currentSectorName, setCurrentSectorName] = useState<string>('');
  const [customTicker, setCustomTicker] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [isLoadingSector, setIsLoadingSector] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [userApiKey, setUserApiKey] = useState<string>(() => getUserApiKey() || DEMO_API_KEY);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isToolbarCompact, setIsToolbarCompact] = useState(false);
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [isIntervalDropdownOpen, setIsIntervalDropdownOpen] = useState(false);

  // Save user API key to localStorage when it changes
  useEffect(() => {
    saveUserApiKey(userApiKey);
  }, [userApiKey]);

  // Auto-analyze when sector is selected
  useEffect(() => {
    if (selectedSector && !isLoadingSector) {
      analyzeSector();
    }
  }, [selectedSector]);

  // Auto-analyze when sector is selected
  useEffect(() => {
    if (selectedSector && !isLoadingSector) {
      analyzeSector();
    }
  }, [selectedSector]);

  // Auto-rotate images every 5 seconds
  useEffect(() => {
    if (images.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = (newSeries: number[] | DataPoint[], options: FindAllDipsOptions) => {
    let dataPoints: DataPoint[];
    if (Array.isArray(newSeries) && typeof newSeries[0] === 'number') {
      // Convert number[] to DataPoint[] with generated dates
      const values = newSeries as number[];
      dataPoints = values.map((value, index) => ({
        date: new Date(Date.now() - (values.length - 1 - index) * 24 * 60 * 60 * 1000), // Days ago
        value
      }));
    } else {
      dataPoints = newSeries as DataPoint[];
    }
    
    setSeries(dataPoints);
    const values = dataPoints.map(p => p.value);
    const detectedDips = findAllDips(values, options);
    setDips(detectedDips);
    setHasAnalyzed(true);
  };

  const handleSectorAnalysis = (analyses: SectorAnalysis[], sectorName: string) => {
    setSectorAnalyses(analyses);
    setCurrentSectorName(sectorName);
  };

  const analyzeSector = async () => {
    if (!selectedSector) return;

    setIsLoadingSector(true);
    const companies = MARKET_SECTORS[selectedSector as keyof typeof MARKET_SECTORS];

    const { key: apiKey } = getActiveApiKey();
    
    // Batch fetch all tickers at once (much faster!)
    const tickers = companies.map(c => c.ticker);
    console.log('[App] Fetching tickers:', tickers);
    const stockDataMap = await fetchMultipleStockDataHybrid(tickers, apiKey);
    console.log('[App] Got stockDataMap with keys:', Array.from(stockDataMap.keys()));
    
    // Process each company with the fetched data
    const analyses: SectorAnalysis[] = companies.map((company) => {
      const fullSeries = stockDataMap.get(company.ticker);
      console.log(`[App] Processing ${company.ticker}: ${fullSeries ? fullSeries.length + ' points' : 'NO DATA'}`);
      
      if (!fullSeries || fullSeries.length === 0) {
        return {
          ticker: company.ticker,
          companyName: company.name,
          fullSeries: [],
          intervalAnalyses: [],
          error: 'No data available',
          isETF: company.isETF
        };
      }
      
      // Create analyses for each time interval
      const intervalAnalyses: import('./components/SeriesInput').IntervalAnalysis[] = Object.keys(TIME_INTERVALS).map(intervalKey => {
        const interval = intervalKey as TimeInterval;
        const days = TIME_INTERVALS[interval].days;
        
        // Slice the most recent data for this interval
        const slicedSeries = fullSeries.slice(-days);
        
        // Run dip analysis on the values
        const values = slicedSeries.map((p: DataPoint) => p.value);
        const dips = findAllDips(values, {
          k: 0.7,
          minWidth: 3,
          multiScale: true,
        });
        
        return {
          interval,
          series: slicedSeries,
          dips
        };
      });
      
      return {
        ticker: company.ticker,
        companyName: company.name,
        fullSeries,
        intervalAnalyses,
        isETF: company.isETF
      };
    });

    handleSectorAnalysis(analyses, selectedSector);
    setIsLoadingSector(false);
  };

  const handleAddCustomTicker = async () => {
    if (!customTicker.trim()) return;

    const ticker = customTicker.toUpperCase();
    
    // Check if ticker already exists
    if (sectorAnalyses.some(analysis => analysis.ticker === ticker)) {
      alert(`Ticker ${ticker} is already in the analysis.`);
      return;
    }

    setIsAddingCustom(true);
    try {
      const { key: apiKey } = getActiveApiKey(); // Use configured API key with fallback
      
      // Use hybrid fetch: Supabase first, then API fallback
      const fullSeries = await fetchStockDataHybrid(ticker, apiKey);
      
      // Create analyses for each time interval
      const intervalAnalyses: import('./components/SeriesInput').IntervalAnalysis[] = Object.keys(TIME_INTERVALS).map(intervalKey => {
        const interval = intervalKey as TimeInterval;
        const days = TIME_INTERVALS[interval].days;
        
        // Slice the most recent data for this interval
        const slicedSeries = fullSeries.slice(-days);
        
        // Run dip analysis on the values
        const values = slicedSeries.map((p: DataPoint) => p.value);
        const dips = findAllDips(values, {
          k: 0.7,
          minWidth: 3,
          multiScale: true,
        });
        
        return {
          interval,
          series: slicedSeries,
          dips
        };
      });
      
      const newAnalysis: SectorAnalysis = {
        ticker: ticker,
        companyName: `${ticker} (Custom)`,
        fullSeries,
        intervalAnalyses,
        isETF: false
      };
      
      const updatedAnalyses = [...sectorAnalyses, newAnalysis];
      setSectorAnalyses(updatedAnalyses);
      setCustomTicker('');
      
      console.log(`✓ Successfully added ${ticker} to sector analysis`);
    } catch (error) {
      console.error(`Failed to add ${customTicker}:`, error);
      const errorAnalysis: SectorAnalysis = {
        ticker: ticker,
        companyName: `${ticker} (Custom)`,
        fullSeries: [],
        intervalAnalyses: [],
        error: error instanceof Error ? error.message : 'Failed to load data',
        isETF: false
      };
      
      const updatedAnalyses = [...sectorAnalyses, errorAnalysis];
      setSectorAnalyses(updatedAnalyses);
    } finally {
      setIsAddingCustom(false);
    }
  };

  return (
    <div className="app-container">
      <div className="app-content">
        {/* Header */}
        {!hasAnalyzed && sectorAnalyses.length === 0 && images.length > 0 && (
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              transition: 'transform 0.8s ease-in-out',
              transform: `translateX(-${currentImageIndex * 100}%)`
            }}>
              {images.map((image, index) => (
                <img 
                  key={index}
                  src={image} 
                  alt={`Dip Detection Visualizer ${index + 1}`} 
                  style={{ 
                    width: '100%', 
                    height: 'auto',
                    flexShrink: 0
                  }} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Modern Toolbar */}
        <div className={`toolbar ${sectorAnalyses.length > 0 ? 'sticky' : ''} ${isToolbarCompact ? 'compact' : ''}`}>
          <div className="toolbar-content">
            {/* Left Section: Branding & Breadcrumbs */}
            <div className="toolbar-section toolbar-left">
              <div className="toolbar-brand">📊 Dip Detector</div>
              {sectorAnalyses.length > 0 && !isToolbarCompact && (
                <div className="toolbar-breadcrumbs">
                  <span className="breadcrumb-separator">›</span>
                  <span className="breadcrumb-item">{currentSectorName}</span>
                  <span className="breadcrumb-separator">›</span>
                  <span className="breadcrumb-item">{TIME_INTERVALS[selectedTimeInterval].label}</span>
                  <span className="breadcrumb-count">({sectorAnalyses.length})</span>
                </div>
              )}
            </div>

            {/* Center Section: Main Controls */}
            {!isToolbarCompact && (
              <div className="toolbar-section toolbar-center">
              <div className="control-group">
                <label className="control-label-inline">Sector</label>
                
                {/* Native select for mobile */}
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="toolbar-select native-select"
                >
                  <option value="">Select sector...</option>
                  {Object.keys(MARKET_SECTORS).map(sector => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
                
                {/* Custom dropdown for desktop */}
                <div className={`custom-dropdown ${isSectorDropdownOpen ? 'active' : ''}`}>
                  <button
                    onClick={() => setIsSectorDropdownOpen(!isSectorDropdownOpen)}
                    className="toolbar-select"
                  >
                    {selectedSector || 'Select sector...'}
                  </button>
                  {isSectorDropdownOpen && (
                    <>
                      <div className="dropdown-backdrop" onClick={() => setIsSectorDropdownOpen(false)} />
                      <div className="dropdown-menu">
                        <div
                          className={`dropdown-item ${!selectedSector ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedSector('');
                            setIsSectorDropdownOpen(false);
                          }}
                        >
                          Select sector...
                        </div>
                        {Object.keys(MARKET_SECTORS).map(sector => (
                          <div
                            key={sector}
                            className={`dropdown-item ${selectedSector === sector ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedSector(sector);
                              setIsSectorDropdownOpen(false);
                            }}
                          >
                            {sector}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {sectorAnalyses.length > 0 && (
                <>
                  <div className="control-group">
                    <label className="control-label-inline">Period</label>
                    
                    {/* Native select for mobile */}
                    <select
                      value={selectedTimeInterval}
                      onChange={(e) => setSelectedTimeInterval(e.target.value as TimeInterval)}
                      className="toolbar-select native-select"
                    >
                      {Object.entries(TIME_INTERVALS).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    
                    {/* Custom dropdown for desktop */}
                    <div className={`custom-dropdown ${isIntervalDropdownOpen ? 'active' : ''}`}>
                      <button
                        onClick={() => setIsIntervalDropdownOpen(!isIntervalDropdownOpen)}
                        className="toolbar-select"
                      >
                        {TIME_INTERVALS[selectedTimeInterval].label}
                      </button>
                      {isIntervalDropdownOpen && (
                        <>
                          <div className="dropdown-backdrop" onClick={() => setIsIntervalDropdownOpen(false)} />
                          <div className="dropdown-menu">
                            {Object.entries(TIME_INTERVALS).map(([key, { label }]) => (
                              <div
                                key={key}
                                className={`dropdown-item ${selectedTimeInterval === key ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedTimeInterval(key as TimeInterval);
                                  setIsIntervalDropdownOpen(false);
                                }}
                              >
                                {label}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Add Custom Ticker */}
                  <div className="control-group" style={{ maxWidth: '250px' }}>
                    <label className="control-label-inline">Add Ticker</label>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="text"
                        value={customTicker}
                        onChange={(e) => setCustomTicker(e.target.value.toUpperCase())}
                        placeholder="e.g., TSLA"
                        className="toolbar-select"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTicker()}
                        style={{ 
                          width: '100%',
                          paddingRight: '36px',
                          textTransform: 'uppercase'
                        }}
                      />
                      <button
                        onClick={handleAddCustomTicker}
                        disabled={!customTicker.trim() || isAddingCustom}
                        className="btn"
                        style={{ 
                          position: 'absolute',
                          right: '4px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          padding: '4px 8px',
                          minWidth: 'auto',
                          height: 'calc(100% - 8px)',
                          background: !customTicker.trim() || isAddingCustom ? '#D1D5DB' : '#3B82F6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: !customTicker.trim() || isAddingCustom ? 'not-allowed' : 'pointer',
                          fontSize: '16px',
                          lineHeight: '1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {isAddingCustom ? '⋯' : '+'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            )}

            {/* Right Section: Settings & Actions */}
            <div className="toolbar-section toolbar-right">
              {sectorAnalyses.length > 0 && (
                <button
                  onClick={() => setIsToolbarCompact(!isToolbarCompact)}
                  className="btn btn-ghost toolbar-btn-icon toolbar-toggle"
                  title={isToolbarCompact ? 'Expand toolbar' : 'Collapse toolbar'}
                >
                  {isToolbarCompact ? '☰' : '×'}
                </button>
              )}
              <button
                onClick={() => setShowAbout(!showAbout)}
                className="btn btn-ghost toolbar-btn-icon"
                title="About & Settings"
              >
                ⚙
              </button>
            </div>
          </div>
        </div>

        {/* About Popup Modal */}
        {showAbout && (
          <>
            <div className="modal-backdrop" onClick={() => setShowAbout(false)} />
            
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">About Dip Detection</h2>
                <button onClick={() => setShowAbout(false)} className="modal-close">
                  ✕
                </button>
              </div>
              
              <div className="modal-content">
                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--surface-light)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    API Key:
                  </label>
                  <input
                    type="text"
                    value={userApiKey}
                    onChange={(e) => setUserApiKey(e.target.value)}
                    placeholder={DEMO_API_KEY}
                    className="api-key-input"
                    title="Enter your Twelve Data API key (or use the demo key)"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.9375rem' }}
                  />
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Enter your Twelve Data API key or use the demo key. Your key is saved in your browser.
                  </p>
                </div>
                
                <p>
                  This tool implements a robust dip detection algorithm for 1-D time series.
                  A <strong>dip</strong> is a temporally coherent downward excursion relative to
                  its local contextual baseline.
                </p>
                
                <h3>Key Features:</h3>
                <ul>
                  <li><strong>Multi-scale detection:</strong> Handles both sharp and slow/gradual dips by analyzing at different time scales</li>
                  <li><strong>Robust statistics:</strong> Uses median (middle value) and MAD (Median Absolute Deviation - measure of variability) for noise resistance</li>
                  <li><strong>Confidence scoring:</strong> Combines depth (how deep), area (magnitude over time), and prominence (how distinct from surroundings) metrics</li>
                  <li><strong>Automatic discovery:</strong> Finds all dips without manual annotation</li>
                </ul>
                
                <h3>API Key:</h3>
                <p>
                  This app uses <strong>Twelve Data API</strong> to fetch real-time stock market data. A demo API key is provided by default, but you can get your own free API key for better rate limits:
                </p>
                <ul>
                  <li>✅ <strong>800 API calls/day</strong> on the free tier</li>
                  <li>✅ <strong>No credit card required</strong></li>
                  <li>✅ <strong>5+ years</strong> of historical stock data</li>
                  <li>✅ Native CORS support for browser apps</li>
                </ul>
                <p>
                  Get your free API key at: <a href="https://twelvedata.com/pricing" target="_blank" rel="noopener noreferrer">twelvedata.com/pricing</a>
                </p>
                <p style={{ fontStyle: 'italic' }}>
                  Simply paste your API key in the input field at the top of the page. It will be saved in your browser and used for all stock data requests.
                </p>
                
                <h3>Table Metrics Explanation:</h3>
                <ul>
                  <li><strong>Indices:</strong> Start and end positions (inclusive) of the dip in the series</li>
                  <li><strong>Dates:</strong> Date range of the dip from start to end (when available)</li>
                  <li><strong>Width:</strong> Number of samples in the dip</li>
                  <li><strong>Depth:</strong> How far below the baseline the minimum value is</li>
                  <li><strong>Min Value:</strong> The lowest value in the dip segment (with its index)</li>
                  <li><strong>Baseline:</strong> Local reference level computed from surrounding context</li>
                  <li><strong>Current Value:</strong> The latest value in the series (for manual recovery assessment)</li>
                  <li><strong>Confidence:</strong> Combined score from depth, area, and prominence (0-1 scale)</li>
                  <li><strong>Scale:</strong> Detection scale (fast/medium/slow); ×N means detected at N scales</li>
                  <li><strong>Trend:</strong> Overall market trend at the end of the dip (UPTREND, DOWNTREND, MIXED)</li>
                  <li><strong>Status:</strong> "Ongoing" = currently happening (at end of series), "Complete" = has recovered</li>
                </ul>

                <h3>Technical Terms:</h3>
                <ul>
                  <li><strong>Baseline:</strong> Expected normal level computed from local and global context</li>
                  <li><strong>Depth:</strong> Distance below baseline (shown as % of baseline value)</li>
                  <li><strong>Width/Duration:</strong> How long the dip lasts (number of data points or days)</li>
                  <li><strong>Prominence:</strong> How much the dip stands out compared to neighboring values</li>
                  <li><strong>Area:</strong> Total magnitude of the dip (depth × width)</li>
                  <li><strong>Ongoing Dip:</strong> A dip that hasn't recovered yet (extends to the most recent data)</li>
                  <li><strong>% from Peak:</strong> Actual price change from the dip's starting point to current value</li>
                  <li><strong>Benchmark:</strong> Reference for comparison - individual stocks are compared to sector ETF average, ETFs are compared to overall average</li>
                </ul>

                <h3>Aggregated Metrics (Sector Analysis):</h3>
                <ul>
                  <li><strong>Total Dips:</strong> Count of all dips detected in the selected time period</li>
                  <li><strong>Avg Depth:</strong> Average depth across all dips (mean percentage below baseline)</li>
                  <li><strong>Max Depth:</strong> Worst single dip depth in the period (maximum percentage drop)</li>
                  <li><strong>Avg Duration:</strong> Average length of dips measured in days</li>
                  <li><strong>Total Days in Dips:</strong> Sum of all days spent in dip conditions</li>
                  <li><strong>Dip Score:</strong> Combined weakness metric = (# of dips) × (avg depth) × (total dip days / period days) × 100. Higher score indicates chronic weakness with frequent, deep, or prolonged dips</li>
                  <li><strong>vs Benchmark:</strong> Compares stock's Dip Score against average ETF Dip Score. "Stock-specific" means ETFs had no dips. "X% worse/better" shows relative performance. "Similar" means within ±20%</li>
                </ul>
                
                <p style={{ fontStyle: 'italic' }}>
                  Ported from Python to TypeScript for interactive browser-based analysis.
                </p>
              </div>
            </div>
          </>
        )}



        {/* Debug Mode: Series Input */}
        {isDebugMode() && (
          <div className="card">
            <SeriesInput 
              onAnalyze={handleAnalyze} 
              selectedInterval={selectedTimeInterval}
            />
          </div>
        )}

        {/* Analysis Results */}
        {hasAnalyzed && (
          <>
            <div className="card">
              <h3 className="card-header">📊 Visualization</h3>
              <div className="chart-container">
                <DipChart series={series} dips={dips} />
              </div>
              {isDebugMode() && <RawDataDisplay series={series} />}
            </div>

            <div className="card">
              <DipResults dips={dips} series={series} />
            </div>
          </>
        )}

        {/* Sector Analysis Results */}
        {sectorAnalyses.length > 0 && (
          <div className="mt-xl">
            <SectorAggregatePanel 
              sectorAnalyses={sectorAnalyses}
              sectorName={currentSectorName}
              selectedInterval={selectedTimeInterval}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
