// Auto-generate a showcase screenshot for traders
// Navigates to the dev server, selects Technology sector, ensures 6 Months period,
// expands AAPL, and captures a screenshot with charts and results visible.

import puppeteer from 'puppeteer';

// Parse CLI args
function parseArgs(argv) {
  const args = {};
  for (const part of argv.slice(2)) {
    const m = part.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

const INTERVAL_LABELS = {
  '5y': '5 Years',
  '3y': '3 Years',
  '12m': '12 Months',
  '6m': '6 Months',
  '3m': '3 Months',
  '1m': '1 Month',
  '1w': '1 Week',
};

async function selectFromCustomDropdown(page, dropdownIndex, itemText) {
  // Open the specified dropdown in the toolbar center
  const dropdownButtons = await page.$$('.toolbar-section.toolbar-center .custom-dropdown .toolbar-select');
  if (dropdownButtons.length <= dropdownIndex) {
    throw new Error(`Dropdown index ${dropdownIndex} not found.`);
  }
  await dropdownButtons[dropdownIndex].click();
  // Wait for menu items and click the match
  await page.waitForSelector('.dropdown-menu .dropdown-item');
  const items = await page.$$('.dropdown-menu .dropdown-item');
  for (const item of items) {
    const text = await page.evaluate(el => el.textContent?.trim() || '', item);
    if (text === itemText) {
      await item.click();
      return true;
    }
  }
  throw new Error(`Menu item not found: ${itemText}`);
}

async function run() {
  const args = parseArgs(process.argv);
  const sector = args.sector || 'Technology';
  const intervalKey = (args.interval || '6m').toLowerCase();
  const intervalLabel = INTERVAL_LABELS[intervalKey] || args.interval || '6 Months';
  const ticker = (args.ticker || 'AAPL').toUpperCase();
  const customOutput = args.output; // Optional custom output filename

  const candidateUrls = [
    'http://localhost:5173/buy_the_fucking_dip/',
    'http://localhost:5174/buy_the_fucking_dip/',
    'http://localhost:5173/',
    'http://localhost:5174/',
  ];

  const browser = await puppeteer.launch({
    headless: true, // Set back to true for batch processing
    defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();

  // Navigate: try candidate URLs until one works
  let navigated = false;
  for (const url of candidateUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      navigated = true;
      break;
    } catch (e) {
      // try next
    }
  }
  if (!navigated) throw new Error('Could not connect to dev server on localhost:5173/5174');

  // Ensure app root is present
  await page.waitForSelector('#root');

  // Make sure toolbar center is visible
  await page.waitForSelector('.toolbar-section.toolbar-center');

  // Select Sector by label (custom dropdown index 0)
  await selectFromCustomDropdown(page, 0, sector);

  // Wait until sector analysis panel appears
  await page.waitForFunction(() => {
    const el = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.includes('Sector Aggregate Analysis'));
    return Boolean(el);
  }, { timeout: 60000 });

  // Ensure Period by label (custom dropdown index 1)
  // The interval dropdown becomes available once analyses load
  await page.waitForSelector('.toolbar-section.toolbar-center .custom-dropdown .toolbar-select');
  const dropdownButtons = await page.$$('.toolbar-section.toolbar-center .custom-dropdown .toolbar-select');
  if (dropdownButtons.length > 1) {
    await selectFromCustomDropdown(page, 1, intervalLabel);
  }

  // Pass ticker to the page context FIRST
  await page.evaluate((t) => { (window).desiredTicker = t; }, ticker);

  // Expand the specified ticker row in the sector table
  await page.waitForSelector('table tbody');
  const clickedRow = await page.evaluate(() => {
    const desiredTicker = (window).desiredTicker;
    const tds = Array.from(document.querySelectorAll('table tbody td'));
    const tickerCell = tds.find(td => td.textContent?.trim() === desiredTicker);
    if (tickerCell) {
      const row = tickerCell.closest('tr');
      if (row) {
        (row).click();
        return true;
      }
    }
    return false;
  });
  if (!clickedRow) {
    throw new Error(`Could not find ticker ${ticker} in the sector table`);
  }

  // Wait for the expansion to complete and chart to render
  await page.waitForFunction((tickerName) => {
    const tds = Array.from(document.querySelectorAll('table tbody td'));
    const tickerCell = tds.find(td => td.textContent?.trim() === tickerName);
    if (!tickerCell) return false;
    const row = tickerCell.closest('tr');
    if (!row) return false;
    const detailsRow = row.nextElementSibling;
    if (!detailsRow) return false;
    // Check if the expanded content has the chart canvas or SVG
    const hasChart = detailsRow.querySelector('canvas, svg');
    return Boolean(hasChart);
  }, { timeout: 10000 }, ticker);

  // Additional delay to ensure all rendering is complete
  await new Promise(r => setTimeout(r, 800));

  console.log(`DEBUG: Looking for expanded content for ticker: ${ticker}`);

  // Tag the expanded ticker details panel as the screenshot target
  const debugInfo = await page.evaluate(() => {
    const desiredTicker = (window).desiredTicker;
    const tds = Array.from(document.querySelectorAll('table tbody td'));
    const tickerCell = tds.find(td => td.textContent?.trim() === desiredTicker);
    
    const info = { ticker: desiredTicker, found: false, step: '' };
    
    if (!tickerCell) {
      info.step = 'ticker cell not found';
      return info;
    }
    info.step = 'found ticker cell';
    
    const row = tickerCell.closest('tr');
    if (!row) {
      info.step = 'row not found';
      return info;
    }
    info.step = 'found row';
    
    const detailsRow = row.nextElementSibling;
    if (!detailsRow) {
      info.step = 'nextElementSibling (details row) not found - ROW NOT EXPANDED';
      return info;
    }
    info.step = 'found details row';
    
    const cell = detailsRow.querySelector('td[colspan]');
    if (!cell) {
      info.step = 'td[colspan] not found';
      return info;
    }
    info.step = 'found colspan cell';
    
    const panel = cell.querySelector(':scope > div');
    if (!panel) {
      info.step = 'direct child div not found';
      return info;
    }
    
    info.step = 'found panel div';
    info.found = true;
    info.hasChart = Boolean(panel.querySelector('canvas, svg'));
    info.hasDipResults = Boolean(panel.textContent?.includes('Dips:'));
    
    panel.setAttribute('data-screenshot-target', 'true');
    panel.scrollIntoView({ behavior: 'instant', block: 'center' });
    
    return info;
  });
  
  console.log('DEBUG Info:', debugInfo);
  
  if (!debugInfo.found) {
    throw new Error(`Could not locate expanded ${ticker} details panel - ${debugInfo.step}`);
  }

  const target = await page.$('[data-screenshot-target="true"]');
  if (!target) throw new Error('Screenshot target handle not found');
  
  console.log('DEBUG: Waiting 3 seconds before screenshot - check the browser window...');
  await new Promise(r => setTimeout(r, 3000));
  
  // Hide the toolbar/control panel for a clean screenshot
  await page.addStyleTag({
    content: `
      .toolbar { display: none !important; }
      .app-container { padding-top: 0 !important; }
      [data-screenshot-target="true"] { border-left: none !important; }
    `,
  });
  
  // Scroll to make sure the element is fully visible in viewport
  await page.evaluate(() => {
    const el = document.querySelector('[data-screenshot-target="true"]');
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      window.scrollBy(0, -100); // Add some margin at top
    }
  });
  await new Promise(r => setTimeout(r, 500));
  
  const outputName = customOutput || `screenshots/screenshot-${ticker}-${intervalKey}.png`;
  
  // Screenshot the element directly instead of using clip
  await target.screenshot({ path: outputName });
  
  await browser.close();
  console.log(`✅ Saved screenshot: ${outputName}`);
}

run().catch(err => {
  console.error('❌ Screenshot failed:', err);
  process.exit(1);
});
