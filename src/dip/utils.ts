/**
 * Statistical utility functions (pure TypeScript, no dependencies)
 */

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function mad(values: number[], med?: number): number {
  if (values.length === 0) return 0;
  const m = med ?? median(values);
  const deviations = values.map(v => Math.abs(v - m));
  return median(deviations);
}

export function iqr(values: number[]): number {
  if (values.length < 4) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  return sorted[q3Idx] - sorted[q1Idx];
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function std(values: number[]): number {
  if (values.length === 0) return NaN;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Simple moving median smoother
 */
export function movingMedian(series: number[], windowSize: number): number[] {
  if (windowSize <= 1) return [...series];
  
  const result: number[] = [];
  const pad = Math.floor(windowSize / 2);
  
  for (let i = 0; i < series.length; i++) {
    const start = Math.max(0, i - pad);
    const end = Math.min(series.length, i + pad + 1);
    const window = series.slice(start, end);
    result.push(median(window));
  }
  
  return result;
}
