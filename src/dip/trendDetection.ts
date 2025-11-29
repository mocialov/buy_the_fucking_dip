export type TrendType = 'UPTREND' | 'DOWNTREND' | 'MIXED' | 'NEUTRAL' | 'INSUFFICIENT_DATA';

export interface TrendContext {
  trend: 'UPTREND' | 'DOWNTREND' | 'MIXED';
  trend_score: number;
  ma_20: number | null;
  ma_50: number | null;
  ma_200: number | null;
}

export interface TrendBySlope {
  trend: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL' | 'INSUFFICIENT_DATA';
  slope_pct_per_bar: number | null;
}

export interface HybridTrendContext {
  final_trend: 'UPTREND' | 'DOWNTREND' | 'MIXED';
  combined_score: number;
  ma_method: TrendContext;
  slope_method: TrendBySlope;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function movingAverage(series: number[], endIdx: number, window: number): number | null {
  if (endIdx < 0) return null;
  const start = Math.max(0, endIdx - window + 1);
  const chunk = series.slice(start, endIdx + 1);
  if (chunk.length === 0) return null;
  return mean(chunk);
}

function linearRegressionSlope(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  return slope;
}

export function getTrendContext(series: number[], dipIdx: number, maPeriods: number[] = [20, 50, 200]): TrendContext {
  const maValues: { [key: string]: number | null } = {};
  const maDirs: number[] = [];
  for (const period of maPeriods) {
    const ma = movingAverage(series, dipIdx, period);
    maValues[`ma_${period}`] = ma;
    if (ma !== null) {
      const current = series[dipIdx];
      let dir = 0;
      if (current > ma) dir = 1;
      else if (current < ma) dir = -1;
      if (dir !== 0) maDirs.push(dir);
    }
  }

  let trend: TrendContext['trend'] = 'MIXED';
  let trend_score = 0;
  if (maDirs.length > 0) {
    const up = maDirs.filter((d) => d > 0).length;
    const down = maDirs.filter((d) => d < 0).length;
    if (up > down) trend = 'UPTREND';
    else if (down > up) trend = 'DOWNTREND';
    else trend = 'MIXED';
    trend_score = (up - down) / Math.max(1, maDirs.length);
  }

  return {
    trend,
    trend_score,
    ma_20: maValues['ma_20'] ?? null,
    ma_50: maValues['ma_50'] ?? null,
    ma_200: maValues['ma_200'] ?? null,
  };
}

export function getTrendBySlope(series: number[], dipIdx: number, lookback: number = 50): TrendBySlope {
  const n = series.length;
  if (n === 0 || dipIdx <= 0 || dipIdx - lookback < 0) {
    return { trend: 'INSUFFICIENT_DATA', slope_pct_per_bar: null };
  }

  const start = Math.max(0, dipIdx - lookback);
  const y = series.slice(start, dipIdx);
  const x = Array.from({ length: y.length }, (_, i) => i);
  if (x.length < 2) {
    return { trend: 'NEUTRAL', slope_pct_per_bar: 0 };
  }

  const slope = linearRegressionSlope(x, y);
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  const slopePct = meanY !== 0 ? (slope / meanY) * 100 : 0;

  let trend: TrendBySlope['trend'] = 'NEUTRAL';
  if (slope > 0) trend = 'UPTREND';
  else if (slope < 0) trend = 'DOWNTREND';
  else trend = 'NEUTRAL';

  return { trend, slope_pct_per_bar: slopePct };
}

function getTrendFromHybrid(maTrend: TrendContext['trend'], slopeTrend: TrendBySlope['trend']): TrendContext['trend'] {
  if (maTrend === 'UPTREND' && slopeTrend === 'UPTREND') return 'UPTREND';
  if (maTrend === 'DOWNTREND' && slopeTrend === 'DOWNTREND') return 'DOWNTREND';
  if (maTrend === slopeTrend) return maTrend;
  return 'MIXED';
}

export function getTrendContextHybrid(series: number[], dipIdx: number, maPeriods: number[] = [20, 50, 200], lookback: number = 50): HybridTrendContext {
  const maCtx = getTrendContext(series, dipIdx, maPeriods);
  // For slope, use the same lookback as in the slope function
  const slopeCtx = getTrendBySlope(series, dipIdx, lookback);

  // Determine final trend
  const finalTrend = getTrendFromHybrid(maCtx.trend, slopeCtx.trend as TrendBySlope['trend']);

  // Directional score: map to -1..1
  const maDir = maCtx.trend === 'UPTREND' ? 1 : maCtx.trend === 'DOWNTREND' ? -1 : 0;
  const slopeDir = slopeCtx.trend === 'UPTREND' ? 1 : slopeCtx.trend === 'DOWNTREND' ? -1 : 0;
  const combinedScore = (maDir + slopeDir) / 2.0;

  return {
    final_trend: finalTrend,
    combined_score: combinedScore,
    ma_method: maCtx,
    slope_method: slopeCtx
  };
}