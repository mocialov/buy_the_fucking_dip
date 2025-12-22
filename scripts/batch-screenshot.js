// Batch screenshot generator with random filenames
// Takes screenshots for a predefined list of tickers across sectors

import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { mkdirSync, existsSync } from 'fs';

const TICKERS = [
  { sector: 'Major Indices', ticker: 'SPY' },
  { sector: 'Major Indices', ticker: 'QQQ' },
  { sector: 'Major Indices', ticker: 'VOO' },
  { sector: 'Technology', ticker: 'AAPL' },
  { sector: 'Technology', ticker: 'MSFT' },
  { sector: 'Technology', ticker: 'GOOGL' },
  { sector: 'Financial Services', ticker: 'JPM' },
  { sector: 'Financial Services', ticker: 'PYPL' },
  { sector: 'Healthcare', ticker: 'UNH' },
  { sector: 'Healthcare', ticker: 'LLY' },
  { sector: 'Consumer Discretionary', ticker: 'AMZN' },
  { sector: 'Consumer Discretionary', ticker: 'MCD' },
  { sector: 'Consumer Staples', ticker: 'WMT' },
  { sector: 'Energy', ticker: 'XOM' },
  { sector: 'Industrials', ticker: 'UPS' },
  { sector: 'Materials', ticker: 'XLB' },
  { sector: 'Communication Services', ticker: 'NFLX' },
  { sector: 'Real Estate', ticker: 'SPG' },
  { sector: 'Utilities', ticker: 'VPU' },
];

const INTERVAL = '6m'; // Default interval
const OUTPUT_DIR = 'screenshots';

function generateRandomName() {
  return randomBytes(8).toString('hex');
}

async function main() {
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Starting batch screenshot generation for ${TICKERS.length} tickers...\n`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < TICKERS.length; i++) {
    const { sector, ticker } = TICKERS[i];
    const randomName = generateRandomName();
    const filename = `${OUTPUT_DIR}/screenshot-${randomName}.png`;

    console.log(`[${i + 1}/${TICKERS.length}] Processing ${ticker} (${sector})...`);

    try {
      // Run the screenshot script with modified output
      const cmd = `node scripts/generate-screenshot.js --sector="${sector}" --interval=${INTERVAL} --ticker=${ticker} --output="${filename}"`;
      execSync(cmd, { stdio: 'pipe' }); // Suppress subprocess output
      
      results.push({
        ticker,
        sector,
        filename,
        status: 'success'
      });
      successCount++;
      console.log(`✅ ${ticker} -> ${filename}\n`);
    } catch (error) {
      results.push({
        ticker,
        sector,
        filename: null,
        status: 'failed',
        error: error.message
      });
      failCount++;
      console.log(`❌ ${ticker} failed\n`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('BATCH SCREENSHOT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total: ${TICKERS.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('\nResults:');
  results.forEach(({ ticker, sector, filename, status }) => {
    if (status === 'success') {
      console.log(`✅ ${ticker.padEnd(6)} (${sector.padEnd(25)}) -> ${filename}`);
    } else {
      console.log(`❌ ${ticker.padEnd(6)} (${sector.padEnd(25)}) -> FAILED`);
    }
  });
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ Batch screenshot failed:', err);
  process.exit(1);
});
