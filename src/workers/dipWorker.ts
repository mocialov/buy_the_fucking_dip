/*
 * Web Worker for dip detection
 * Receives single-job messages and returns dips for that job.
 */

import { findDipsOptimalForInterval } from '../dip/detectDip';
import type { FindAllDipsOptions } from '../dip/types';

export interface DipDetectionJob {
  ticker: string;
  interval: import('../dip/types').TimeInterval;
  intervalDays: number;
  seriesValues: number[];
  options: FindAllDipsOptions;
}

export interface DipDetectionResult {
  ticker: string;
  interval: import('../dip/types').TimeInterval;
  dips: import('../dip/types').DipMetrics[];
}

self.onmessage = (event: MessageEvent<DipDetectionJob>) => {
  const job = event.data;
  try {
    const dips = findDipsOptimalForInterval(job.seriesValues, job.intervalDays, job.options);
    const result: DipDetectionResult = {
      ticker: job.ticker,
      interval: job.interval,
      dips
    };
    // Post result back to main thread
    (self as unknown as Worker).postMessage(result);
  } catch (err) {
    const result: DipDetectionResult = {
      ticker: job.ticker,
      interval: job.interval,
      dips: []
    };
    (self as unknown as Worker).postMessage(result);
  }
};
