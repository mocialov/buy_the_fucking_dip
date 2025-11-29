/**
 * TypeScript port of detect_dip.py
 * Core types and interfaces for dip detection
 */

export type TimeInterval = '5y' | '3y' | '12m' | '6m' | '3m' | '1m' | '1w';

export const TIME_INTERVALS: Record<TimeInterval, { label: string; days: number }> = {
  '5y': { label: '5 Years', days: 1250 },
  '3y': { label: '3 Years', days: 750 },
  '12m': { label: '12 Months', days: 250 },
  '6m': { label: '6 Months', days: 125 },
  '3m': { label: '3 Months', days: 65 },
  '1m': { label: '1 Month', days: 20 },
  '1w': { label: '1 Week', days: 5 }
};

export interface DipMetrics {
  start: number;
  end: number;
  width: number;
  baseline: number;
  local_median: number;
  global_median: number;
  local_mad: number;
  alpha: number;
  seg_min: number;
  seg_min_index: number;
  depth: number;
  depth_threshold: number;
  prominence: number;
  area: number;
  recovered: boolean;
  is_ongoing: boolean;
  confidence: number;
  is_dip: boolean;
  k: number;
  min_abs_depth: number;
  reason?: string;
  scale_factor?: number;
  detection_scale?: 'fast' | 'medium' | 'slow';
  detected_at_scales?: number;
  scale_list?: number[];
}

export interface DetectDipOptions {
  preWindow?: number;
  postWindow?: number;
  minWidth?: number;
  k?: number;
  minAbsDepth?: number;
  requireRecovery?: boolean;
  n0?: number;
}

export interface FindAllDipsOptions extends DetectDipOptions {
  smoothingWindow?: number;
  minProminenceFactor?: number;
  maxDips?: number;
  multiScale?: boolean;
  scaleFactors?: number[];
}

export type LocalMinimum = [index: number, value: number, prominence: number];

export interface DataPoint {
  date: Date;
  value: number;
}
