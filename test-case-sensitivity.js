// Simulate the mapping logic
const tickers = ['META', 'AVGO', 'AAPL'];
const normalizedTickers = tickers.map(t => t.toUpperCase());
console.log('Input tickers:', tickers);
console.log('Normalized tickers:', normalizedTickers);

// Simulate database response (all uppercase)
const dbTickers = ['META', 'AAPL'];

// Create the mapping
const tickerMap = new Map(tickers.map(t => [t.toUpperCase(), t]));
console.log('tickerMap:', Array.from(tickerMap.entries()));

// Simulate result population
const result = new Map();
dbTickers.forEach(ticker => {
  const originalTicker = tickerMap.get(ticker) || ticker;
  result.set(originalTicker, ['dummy data']);
  console.log(`Mapped ${ticker} -> ${originalTicker}`);
});

console.log('Result keys:', Array.from(result.keys()));

// Check for missing
const missingTickers = tickers.filter(t => !result.has(t));
console.log('Missing tickers:', missingTickers);
