# Dip Detection Web Application

A React + TypeScript implementation of the dip detection algorithm, providing an interactive web interface for analyzing time series data.

## Features

- **Interactive Visualization**: Real-time SVG-based charts showing detected dips
- **Multi-scale Detection**: Automatically detects both sharp and gradual dips
- **Adjustable Parameters**: Fine-tune sensitivity, minimum width, and multi-scale options
- **Example Data**: Pre-loaded examples to test the algorithm
- **Comprehensive Metrics**: View depth, confidence, baseline, and more for each dip
- **Pure TypeScript**: Complete port of Python algorithm (no dependencies beyond React)

## Quick Start

### Installation

```bash
cd webapp
npm install
```

### Development

```bash
npm run dev
```

Open your browser to `http://localhost:5173` (or the URL shown in terminal).

### Build for Production

```bash
npm run build
npm run preview
```

## Usage

1. **Enter Series Data**: Paste comma-separated numbers in the textarea, or click "Load Example"
2. **Adjust Parameters**:
   - **Sensitivity (k)**: Lower values = more permissive (detects shallower dips)
   - **Min Width**: Minimum number of samples for a valid dip
   - **Multi-scale**: Enable for better detection of slow/gradual dips
3. **Click "Detect Dips"**: The visualization and metrics table will appear
4. **Interpret Results**:
   - Chart shows dips highlighted with semi-transparent colored spans
   - Circles mark the minimum point of each dip
   - Table lists all detected dips with detailed metrics

## Algorithm Overview

The dip detection algorithm implements these core principles:

- **Local Baseline**: Robust median of samples before and after the segment
- **Global Blending**: Weighted combination based on data volume
- **Robust Scale**: MAD (Median Absolute Deviation) for noise resistance
- **Multi-scale Analysis**: Detects dips at multiple smoothing levels
- **Confidence Scoring**: Combines depth, area, and prominence metrics

### Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `k` | 0.5 | Depth threshold multiplier (lower = more permissive) |
| `minWidth` | 3 | Minimum samples for valid dip |
| `multiScale` | true | Enable multi-scale detection |
| `preWindow` | N/4 | Context window before segment (auto) |
| `postWindow` | N/4 | Context window after segment (auto) |

## Project Structure

```
webapp/
├── src/
│   ├── dip/
│   │   ├── detectDip.ts      # Core algorithm (findAllDips, detectDip)
│   │   ├── utils.ts           # Statistical utilities (median, mad, etc.)
│   │   └── types.ts           # TypeScript interfaces
│   ├── components/
│   │   ├── DipChart.tsx       # SVG visualization component
│   │   ├── SeriesInput.tsx    # Input controls
│   │   └── DipResults.tsx     # Results table
│   ├── App.tsx                # Main application
│   └── main.tsx               # Entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Python to TypeScript Mapping

| Python | TypeScript | Notes |
|--------|-----------|-------|
| `detect_dip.py` | `src/dip/detectDip.ts` | Core algorithm port |
| `numpy` operations | Pure JS arrays | No external dependencies |
| `median()`, `mad()` | `src/dip/utils.ts` | Custom implementations |
| `matplotlib` | SVG rendering | `DipChart.tsx` component |
| Command-line args | React state | UI controls |

## API Reference

### `findAllDips(series, options?)`

Automatically find all dip segments in a time series.

```typescript
import { findAllDips } from './dip/detectDip';

const series = [10, 10, 9, 8, 7, 8, 9, 10, 10];
const dips = findAllDips(series, {
  k: 0.5,
  minWidth: 3,
  multiScale: true
});

console.log(`Found ${dips.length} dips`);
dips.forEach(d => {
  console.log(`[${d.start}:${d.end}] depth=${d.depth.toFixed(2)} conf=${d.confidence.toFixed(2)}`);
});
```

**Options:**
- `k` (number, default: 0.5): Depth threshold multiplier
- `minWidth` (number, default: 3): Minimum dip width
- `multiScale` (boolean, default: true): Enable multi-scale detection
- `smoothingWindow` (number, default: 3): Base smoothing window
- `minProminenceFactor` (number, default: 0.3): Prominence threshold factor
- `maxDips` (number, default: 50): Maximum dips to return

**Returns:** Array of `DipMetrics` objects sorted by confidence (descending)

### `detectDip(series, start, end, options?)`

Classify a specific segment as a dip.

```typescript
import { detectDip } from './dip/detectDip';

const series = [10, 10, 9, 8, 7, 8, 9, 10, 10];
const [isDip, metrics] = detectDip(series, 2, 6, { k: 0.5 });

if (isDip) {
  console.log(`✓ Dip detected! Depth: ${metrics.depth.toFixed(2)}`);
} else {
  console.log(`✗ Not a dip: ${metrics.reason}`);
}
```

**Returns:** `[boolean, DipMetrics]` - Whether segment is a dip and detailed metrics

## Metrics Explained

Each detected dip includes these metrics:

- **start/end**: Inclusive indices of dip boundaries
- **width**: Number of samples in the dip
- **depth**: Distance below baseline (positive = below)
- **baseline**: Local reference level from surrounding context
- **seg_min**: Minimum value in the dip
- **seg_min_index**: Index of minimum value
- **confidence**: Combined score (0-1) from depth, area, prominence
- **detection_scale**: "fast", "medium", or "slow"
- **detected_at_scales**: Number of scales where dip was found (higher = more robust)

## Development

### Adding Tests

```bash
npm run test
```

Test files can be added in `src/dip/__tests__/` using Vitest.

### Customizing Visualization

Edit `src/components/DipChart.tsx` to customize:
- Colors (modify `COLORS` array)
- Chart dimensions (pass `width`/`height` props)
- Styling (SVG attributes and styles)

### Adding More Examples

Edit `src/components/SeriesInput.tsx` and add to `EXAMPLE_SERIES`:

```typescript
const EXAMPLE_SERIES = {
  simple: '10,10,10,9,8,7,8,9,10,10,10',
  myExample: '5,5,4,3,2,3,4,5,5', // Your example
};
```

## Performance

- **Series length**: Handles 100-10,000 points efficiently
- **Multi-scale**: Adds ~3-4x overhead (worth it for gradual dips)
- **Rendering**: SVG efficient up to ~1000 points

For very long series (>10k points), consider:
1. Downsampling for visualization
2. Disabling multi-scale
3. Limiting `maxDips` parameter

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ features required
- No IE11 support

## License

MIT (same as parent Python project)

## Credits

TypeScript/React port by GitHub Copilot, based on the original Python implementation in `detect_dip.py`.

---

**Related Files:**
- `../detect_dip.py` - Original Python implementation
- `../visualise_dips.py` - Python visualization example
- `../DIP_DETECTION_README.md` - Algorithm documentation
