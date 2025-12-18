/**
 * TypeScript port of detect_dip.py core algorithm
 * Implements dip detection and classification for 1-D time series
 */

import { median, mad, iqr, std, movingMedian } from './utils';
import type { DipMetrics, DetectDipOptions, FindAllDipsOptions, LocalMinimum } from './types';

/**
 * Find local minima in a time series using neighbor comparison
 * Handles plateaus by finding center of flat minimum regions
 */
export function findLocalMinima(
  series: number[],
  minProminence: number = 0,
  proximityRange: number = 10
): LocalMinimum[] {
  const N = series.length;
  if (N < 3) return [];

  const minima: LocalMinimum[] = [];
  let i = 1;

  while (i < N - 1) {
    // Check if this is a minimum or start of plateau
    if (series[i] <= series[i - 1] && series[i] <= series[i + 1]) {
      // Find extent of plateau (equal values)
      let j = i;
      while (j < N - 1 && series[j + 1] === series[i]) {
        j++;
      }

      // Check if plateau/point is a minimum (surrounded by higher values)
      let isMin = (i === 0 || series[i] < series[i - 1]) && (j === N - 1 || series[i] < series[j + 1]);
      if (!isMin && i > 0 && j < N - 1) {
        isMin = series[i] <= series[i - 1] && series[i] <= series[j + 1] &&
                (series[i] < series[i - 1] || series[i] < series[j + 1]);
      }

      if (isMin) {
        // Use center of plateau
        const minIdx = Math.floor((i + j) / 2);

        // Calculate prominence: min distance to higher neighbors
        let leftHigher = i > 0 ? series[i - 1] : series[minIdx];
        let rightHigher = j < N - 1 ? series[j + 1] : series[minIdx];

        // Extend to find max neighbors within proximity_range (adaptive)
        for (let k = Math.max(0, i - proximityRange); k < i; k++) {
          if (series[k] > leftHigher) leftHigher = series[k];
        }
        for (let k = j + 1; k < Math.min(N, j + proximityRange + 1); k++) {
          if (series[k] > rightHigher) rightHigher = series[k];
        }

        const prom = Math.min(leftHigher, rightHigher) - series[minIdx];
        if (prom >= minProminence) {
          minima.push([minIdx, series[minIdx], prom]);
        }
      }

      i = j + 1;
    } else {
      i++;
    }
  }

  // Special case: check if series is descending at the end (ongoing dip)
  // Look at last few points to see if there's a downward trend
  if (N >= 3) {
    // Check if last point is lower than points before it
    const lastIdx = N - 1;
    if (series[lastIdx] < series[lastIdx - 1]) {
      // Find how far back the descent goes
      let j = lastIdx - 1;
      while (j > 0 && series[j] < series[j - 1]) {
        j--;
      }
      
      // j is now the start of the descent, lastIdx is the end
      // If we have a descent of at least 2 points, consider it a potential ongoing dip
      if (lastIdx - j >= 1) {
        // Use the last point as the minimum for ongoing dips
        const minIdx = lastIdx;
        
        // Calculate prominence relative to the point before the descent started
        let leftHigher = j > 0 ? series[j] : series[0];
        
        // Extend left to find max in proximity
        for (let k = Math.max(0, j - proximityRange); k <= j; k++) {
          if (series[k] > leftHigher) leftHigher = series[k];
        }
        
        const prom = leftHigher - series[minIdx];
        const alreadyAdded = minima.some(m => m[0] === minIdx);
        if (prom >= minProminence && !alreadyAdded) {
          minima.push([minIdx, series[minIdx], prom]);
        }
      }
    }
  }

  return minima;
}

/**
 * Expand around a local minimum to find dip boundaries
 * Boundaries are where signal crosses back above (baseline - threshold)
 */
export function expandDipBoundaries(
  series: number[],
  minIdx: number,
  baseline: number,
  thresholdFactor: number = 0.3
): [number, number] {
  const N = series.length;
  const minVal = series[minIdx];
  const depth = baseline - minVal;
  
  // Adaptive threshold: use lower threshold for deeper dips to capture more context
  // For shallow dips, use standard threshold
  let adaptiveFactor = thresholdFactor;
  if (depth > 0) {
    adaptiveFactor = Math.min(thresholdFactor, thresholdFactor * (1 + depth / (baseline + 1e-9)));
  }
  
  const crossingLevel = baseline - adaptiveFactor * depth;

  // Expand left
  let start = 0;  // Default if no crossing found
  for (let i = minIdx - 1; i >= 0; i--) {
      if (series[i] >= crossingLevel) {
          start = i + 1;
          break;
      }
  }

  // Expand right  
  let end = N - 1;  // Default if no crossing found
  for (let i = minIdx + 1; i < N; i++) {
      if (series[i] >= crossingLevel) {
          end = i - 1;
          break;
      }
  }

  return [start, end];
}

/**
 * Classify a segment [start, end] (inclusive) as a dip
 * Returns [isDip, metrics]
 */
export function detectDip(
  series: number[],
  start: number,
  end: number,
  options: DetectDipOptions = {}
): [boolean, DipMetrics] {
  const {
    preWindow = 50,
    postWindow = 50,
    minWidth = 2,
    k = 0.25,
    minAbsDepth = 0.0,
    requireRecovery = true,
    n0 = 200
  } = options;

  if (start < 0 || end >= series.length || end < start) {
    throw new Error('Invalid segment bounds');
  }

  const N = series.length;
  const width = end - start + 1;
  const segment = series.slice(start, end + 1);

  // Structural width criterion
  if (width < minWidth) {
    return [false, {
      start, end, width,
      baseline: 0, local_median: 0, global_median: 0, local_mad: 0,
      alpha: 0, seg_min: 0, seg_min_index: start, depth: 0,
      depth_threshold: 0, prominence: 0, area: 0, recovered: false,
      is_ongoing: false, confidence: 0, is_dip: false, k, min_abs_depth: minAbsDepth,
      reason: 'width_below_min'
    }];
  }

  // Local baseline using windows before and after (excluding segment)
  const preStart = Math.max(0, start - preWindow);
  const pre = series.slice(preStart, start);
  const postEnd = Math.min(N, end + 1 + postWindow);
  const post = series.slice(end + 1, postEnd);

  // For dips near the end, treat as ongoing to avoid baseline contamination by low post data
  const isOngoing = (end >= N - 3) || (post.length === 0);

  let localCtx = [...pre];
  if (!isOngoing) {
    localCtx.push(...post);
  }

  // Fallback: if insufficient context, use entire series excluding segment
  if (localCtx.length < Math.max(5, minWidth)) {
    localCtx = [...series.slice(0, start), ...series.slice(end + 1)];
  }

  // If still insufficient (<3), just treat baseline as median of available points
  if (localCtx.length < 3) {
    localCtx = [...series];
  }

  function trimmedMean(values: number[], trimFraction: number = 0.1): number {
    if (values.length < 3) {
        let sum = 0;
        for (const v of values) sum += v;
        return values.length > 0 ? sum / values.length : 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const trimCount = Math.max(1, Math.floor(sorted.length * trimFraction));
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    let sum = 0;
    for (const v of trimmed) sum += v;
    return sum / trimmed.length;
}

  const localMed = trimmedMean(localCtx); //median(localCtx);
  let localMad = mad(localCtx, localMed);

  if (localMad === 0.0) {
    // Fallback scale estimate: IQR or std
    const iqrVal = iqr(localCtx);
    if (iqrVal > 0) {
      localMad = iqrVal / 1.349; // approximate conversion to MAD
    } else {
      const stdVal = std(localCtx);
      localMad = stdVal > 0 ? stdVal / 1.4826 : 1e-9;
    }
  }

  // Global baseline (excluding segment) for weighting
  const globalCtx = [...series.slice(0, start), ...series.slice(end + 1)];
  const globalMed = trimmedMean(globalCtx.length > 0 ? globalCtx : series); //median(globalCtx.length > 0 ? globalCtx : series);

  const alpha = 1 - Math.exp(-N / n0); // increases with more data
  
  // Use max(local, global) for ongoing dips OR when dip is in elevated local region
  // This prevents global baseline from pulling down local baseline for dips in high zones
  const baseline = (isOngoing || localMed > globalMed) 
    ? Math.max(localMed, globalMed) 
    : alpha * globalMed + (1 - alpha) * localMed;

  const segMin = Math.min(...segment);
  const segMinIdxRel = segment.indexOf(segMin);
  const segMinIdx = start + segMinIdxRel;

  const depth = baseline - segMin; // positive if below baseline

  // Depth threshold (allow shallow dips): max(min_abs_depth, k * local_mad)
  const depthThreshold = Math.max(minAbsDepth, k * localMad);
  const passesDepth = depth >= depthThreshold;

  // Prominence: difference between seg_min and min of nearest higher points around segment
  const leftRef = pre.length > 0 ? trimmedMean(pre) : baseline;; //pre.length > 0 ? median(pre) : baseline;
  const rightRef = post.length > 0 ? trimmedMean(post) : baseline; //post.length > 0 ? median(post) : baseline;
  const neighborRef = (leftRef + rightRef) / 2.0;
  const prominence = neighborRef - segMin;

  // Recovery: does series after end return within epsilon of baseline within post_window?
  // Special case: if no post data available (dip at end), mark as ongoing and don't require recovery
  let recovered = true;
  const recoveryEpsilon = 0.5 * localMad; // allow some slack
  
  if (requireRecovery && post.length > 0) {
    // For very deep dips (>3x threshold), check extended window or relax requirement
    // Deep dips may have slow recovery, but are clearly significant features
    const depthRatio = depthThreshold > 0 ? depth / depthThreshold : 0;
    
    if (depthRatio > 3.0) {
      // Very deep dip: use extended recovery window (up to 2x post_window)
      const extendedPostEnd = Math.min(N, end + 1 + postWindow * 2);
      const extendedPost = series.slice(end + 1, extendedPostEnd);
      recovered = extendedPost.some(v => Math.abs(v - baseline) <= recoveryEpsilon);
      
      // If still no recovery in extended window, relax epsilon for very deep dips
      if (!recovered && depthRatio > 5.0) {
        // For extremely deep dips (>5x threshold), use more lenient recovery check
        const relaxedEpsilon = localMad; // double the tolerance
        recovered = extendedPost.some(v => Math.abs(v - baseline) <= relaxedEpsilon);
      }
    } else {
      // Normal depth: standard recovery check
      recovered = post.some(v => Math.abs(v - baseline) <= recoveryEpsilon);
      
      // Additional check: for gradual recovery dips, verify monotonic improvement
      // If signal doesn't reach baseline but shows consistent upward trend, accept it
      if (!recovered && post.length >= 5) {
        // Check if post-dip values show improvement (moving away from seg_min toward baseline)
        const postFirstHalf = post.slice(0, Math.floor(post.length / 2));
        const postSecondHalf = post.slice(Math.floor(post.length / 2));
        if (postFirstHalf.length >= 2 && postSecondHalf.length >= 2) {
          // Calculate mean distance from seg_min for each half
          const distFirst = postFirstHalf.reduce((sum, v) => sum + Math.abs(v - segMin), 0) / postFirstHalf.length;
          const distSecond = postSecondHalf.reduce((sum, v) => sum + Math.abs(v - segMin), 0) / postSecondHalf.length;
          // If second half is farther from minimum, signal is improving
          const improvement = distSecond - distFirst;
          // Accept as recovered if showing improvement >= 0.3 * depth
          if (improvement >= 0.3 * depth) {
            recovered = true;
          }
        }
      }
    }
  } else if (isOngoing) {
    // Ongoing dip at end of series - no recovery data available, so pass recovery check
    recovered = true;
  }

  // Area (integrated depth) relative to baseline
  const area = segment.reduce((sum, v) => sum + (baseline - v), 0);

  // Confidence score (bounded ~[0,1.5]): combine normalized metrics
  const depthScore = depth / (localMad + 1e-12);
  const areaScore = area / ((localMad + 1e-12) * width);
  const promScore = prominence / (localMad + 1e-12);
  const rawScore = 0.4 * depthScore + 0.3 * areaScore + 0.3 * promScore;
  const confidence = Math.max(0.0, Math.min(1.0, Math.tanh(rawScore / 3.0) * 1.2));

  const isDip = passesDepth && recovered;

  const metrics: DipMetrics = {
    start,
    end,
    width,
    baseline,
    local_median: localMed,
    global_median: globalMed,
    local_mad: localMad,
    alpha,
    seg_min: segMin,
    seg_min_index: segMinIdx,
    depth,
    depth_threshold: depthThreshold,
    prominence,
    area,
    recovered,
    is_ongoing: isOngoing,
    confidence,
    is_dip: isDip,
    k,
    min_abs_depth: minAbsDepth
  };

  if (!passesDepth) {
    metrics.reason = 'depth_below_threshold';
  } else if (requireRecovery && !recovered) {
    metrics.reason = 'no_recovery';
  }

  return [isDip, metrics];
}

/**
 * Automatically find all dip segments in a time series
 * Multi-scale detection handles both sharp and slow/gradual dips
 */
export function findAllDips(
  series: number[],
  options: FindAllDipsOptions = {}
): DipMetrics[] {
  const {
    smoothingWindow = 3,
    minProminenceFactor = 0.3,
    preWindow,
    postWindow,
    minWidth = 2,
    k = 0.25,
    minAbsDepth = 0.0,
    requireRecovery = true,
    n0 = 200,
    maxDips = 50,
    multiScale = true,
    scaleFactors
  } = options;

  const N = series.length;

  if (N < minWidth) return [];

  // Auto-adjust windows for short series
  const autoPreWindow = preWindow ?? Math.max(minWidth, Math.min(50, Math.floor(N / 4)));
  const autoPostWindow = postWindow ?? Math.max(minWidth, Math.min(50, Math.floor(N / 4)));

  // Multi-scale detection: analyze at multiple smoothing levels
  let scales: number[];
  if (multiScale && !scaleFactors) {
    if (N > 200) {
      scales = [1, 2, 4, 8];
    } else if (N > 50) {
      scales = [1, 2, 4];
    } else {
      scales = [1, 2];
    }
  } else if (!multiScale) {
    scales = [1];
  } else {
    scales = scaleFactors!;
  }

  const allCandidates: DipMetrics[] = [];

  for (const scaleFactor of scales) {
    const effectiveSmoothing = Math.max(1, smoothingWindow * scaleFactor);

    // Optional smoothing at current scale
    const xSmooth = effectiveSmoothing > 1 ? movingMedian(series, effectiveSmoothing) : series;

    // Estimate global baseline and scale for prominence threshold
    const globalMed = median(xSmooth);
    let globalMad = mad(xSmooth, globalMed);
    if (globalMad === 0) {
      globalMad = (Math.max(...xSmooth) - Math.min(...xSmooth)) / 6.0 || 1e-9;
    }

    // Scale-adaptive prominence threshold (lower for slower scales)
    const scalePromFactor = minProminenceFactor / Math.sqrt(scaleFactor);
    const minProm = scalePromFactor * globalMad;

    // Scale-adaptive proximity range for prominence calculation
    const prominenceRange = Math.min(10 * scaleFactor, Math.floor(N / 4));

    // Find local minima at this scale
    const minima = findLocalMinima(xSmooth, minProm, prominenceRange);

    // Expand each minimum into a candidate segment
    for (const [minIdx, minVal, prom] of minima) {
      // Estimate local baseline around this point
      // Special case: if minimum is at/near end (potential ongoing dip),
      // look further back for baseline to avoid using the dip itself
      let context: number[];
      if (minIdx >= N - 2) {
        // For ongoing dips, use only pre-window data from before potential dip start
        // Look back further to find stable baseline
        const ctxStart = Math.max(0, minIdx - autoPreWindow * 2);
        const ctxEnd = minIdx;
        context = xSmooth.slice(ctxStart, ctxEnd);
        // Filter out descending values near the minimum
        if (context.length > 3) {
          // Find where descent likely started
          const stableContext = context.filter(v => v >= minVal + 0.5 * prom);
          if (stableContext.length >= 3) {
            context = stableContext;
          }
        }
      } else {
        const ctxStart = Math.max(0, minIdx - autoPreWindow);
        const ctxEnd = Math.min(N, minIdx + autoPostWindow);
        context = [...xSmooth.slice(ctxStart, minIdx), ...xSmooth.slice(minIdx + 1, ctxEnd)];
      }
      
      const localBaseline = median(context.length >= 3 ? context : xSmooth);

      const [start, end] = expandDipBoundaries(xSmooth, minIdx, localBaseline);

      // Adjust min_width for scale (slower dips should be wider)
      const scaleMinWidth = Math.max(minWidth, Math.floor(minWidth * Math.sqrt(scaleFactor)));

      // Classify using original series (not smoothed)
      const [isDip, metrics] = detectDip(series, start, end, {
        preWindow: autoPreWindow,
        postWindow: autoPostWindow,
        minWidth: scaleMinWidth,
        k,
        minAbsDepth,
        requireRecovery,
        n0
      });

      if (isDip) {
        // Tag with scale information
        metrics.scale_factor = scaleFactor;
        metrics.detection_scale = scaleFactor === 1 ? 'fast' : (scaleFactor <= 2 ? 'medium' : 'slow');
        allCandidates.push(metrics);
      }
    }
  }

  if (allCandidates.length === 0) return [];

  // Merge overlapping dips from different scales
  if (allCandidates.length > 1) {
    allCandidates.sort((a, b) => a.start - b.start);
    const merged: DipMetrics[] = [];
    let current = allCandidates[0];
    let currentScales = [current.scale_factor!];

    for (let i = 1; i < allCandidates.length; i++) {
      const nextDip = allCandidates[i];
      // Check for overlap (allowing small gap for slow dips)
      const gapTolerance = Math.max(2, Math.floor(2 * Math.sqrt(Math.max(current.scale_factor!, nextDip.scale_factor!))));
      
      if (nextDip.start <= current.end + gapTolerance) {
        // Overlap: merge by keeping deeper, but track multi-scale detection
        if (nextDip.depth > current.depth * 1.1) {
          // Prefer significantly deeper
          currentScales = [nextDip.scale_factor!];
          current = nextDip;
        } else if (Math.abs(nextDip.depth - current.depth) / current.depth < 0.1) {
          // Similar depth: track that it was detected at multiple scales
          currentScales.push(nextDip.scale_factor!);
        }
        // else: keep current, discard nextDip
      } else {
        // No overlap: save current and move to next
        const uniqueScales = [...new Set(currentScales)];
        current.detected_at_scales = uniqueScales.length;
        current.scale_list = uniqueScales.sort((a, b) => a - b);
        // Boost confidence for multi-scale detection
        if (currentScales.length > 1) {
          current.confidence = Math.min(1.0, current.confidence * (1.0 + 0.1 * (currentScales.length - 1)));
        }
        merged.push(current);
        current = nextDip;
        currentScales = [nextDip.scale_factor!];
      }
    }

    // Don't forget last candidate
    const uniqueScales = [...new Set(currentScales)];
    current.detected_at_scales = uniqueScales.length;
    current.scale_list = uniqueScales.sort((a, b) => a - b);
    if (currentScales.length > 1) {
      current.confidence = Math.min(1.0, current.confidence * (1.0 + 0.1 * (currentScales.length - 1)));
    }
    merged.push(current);

    // Sort by confidence and limit
    merged.sort((a, b) => b.confidence - a.confidence);
    return merged.slice(0, maxDips);
  } else {
    // Single candidate
    if (allCandidates[0]) {
      allCandidates[0].detected_at_scales = 1;
      allCandidates[0].scale_list = [allCandidates[0].scale_factor!];
    }
    return allCandidates;
  }
}

/**
 * Merge overlapping or near-adjacent dips, preferring deeper ones and avoiding duplicates.
 * Intended for consolidating results from sliding-window detection across a long series.
 */
function mergeDipsAcrossWindows(dips: DipMetrics[], seriesLength: number, gapTolerance: number = 2): DipMetrics[] {
  if (dips.length <= 1) {
    // Normalize is_ongoing flag against full series length
    if (dips.length === 1) {
      const d = dips[0];
      const endIdx = d.start + d.width - 1;
      d.is_ongoing = endIdx >= seriesLength - 3;
    }
    return dips;
  }

  // Sort by start index
  const sorted = [...dips].sort((a, b) => a.start - b.start);
  const merged: DipMetrics[] = [];

  // Helper to finalize a dip (recompute width, normalize flags)
  const finalize = (d: DipMetrics) => {
    d.width = d.end - d.start + 1;
    const endIdx = d.start + d.width - 1;
    d.is_ongoing = endIdx >= seriesLength - 3;
    return d;
  };

  // Start with the first dip as current accumulator
  let current = { ...sorted[0] } as DipMetrics;
  // Track union of detection scales if present
  let currentScaleList = new Set<number>();
  if (current.scale_list && current.scale_list.length) {
    for (const s of current.scale_list) currentScaleList.add(s);
  } else if (current.scale_factor) {
    currentScaleList.add(current.scale_factor);
  }
  // Count of how many windows contributed to this merged dip
  let windowHits = 1;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const nextEnd = next.start + next.width - 1;
    const currentEnd = current.start + current.width - 1;

    // Consider overlap or small gap within tolerance
    if (next.start <= currentEnd + gapTolerance) {
      // Merge: keep deeper metrics but expand bounds to cover both
      const preferNext = next.depth > current.depth * 1.05; // significant deeper
      const preferSimilar = !preferNext && Math.abs(next.depth - current.depth) / Math.max(1e-9, current.depth) < 0.1;

      // Expand the envelope bounds (start/end) to cover both dips
      const newStart = Math.min(current.start, next.start);
      const newEnd = Math.max(currentEnd, nextEnd);

      if (preferNext) {
        // Replace primary metrics with next, but keep expanded bounds
        const replaced = { ...next } as DipMetrics;
        replaced.start = newStart;
        replaced.end = newEnd;
        current = replaced;
      } else {
        // Keep current metrics, just expand bounds
        current.start = newStart;
        current.end = newEnd;
        // If depths are very close, modestly boost confidence
        if (preferSimilar) {
          current.confidence = Math.min(1.0, current.confidence * 1.05);
        }
      }

      // Union scales
      if (next.scale_list && next.scale_list.length) {
        for (const s of next.scale_list) currentScaleList.add(s);
      } else if (next.scale_factor) {
        currentScaleList.add(next.scale_factor);
      }
      windowHits += 1;
      // Slight confidence boost per corroborating window
      current.confidence = Math.min(1.0, current.confidence * (1.0 + Math.min(0.1, 0.02 * windowHits)));
    } else {
      // No overlap: finalize current and push
      current.scale_list = Array.from(currentScaleList).sort((a, b) => a - b);
      current.detected_at_scales = current.scale_list.length;
      merged.push(finalize(current));

      // Reset accumulator
      current = { ...next } as DipMetrics;
      currentScaleList = new Set<number>();
      if (current.scale_list && current.scale_list.length) {
        for (const s of current.scale_list) currentScaleList.add(s);
      } else if (current.scale_factor) {
        currentScaleList.add(current.scale_factor);
      }
      windowHits = 1;
    }
  }

  // Push the last accumulated dip
  current.scale_list = Array.from(currentScaleList).sort((a, b) => a - b);
  current.detected_at_scales = current.scale_list.length;
  merged.push(finalize(current));

  // Sort final list by confidence desc (then depth desc) for stability
  merged.sort((a, b) => (b.confidence - a.confidence) || (b.depth - a.depth));
  return merged;
}

/**
 * Rolling 6-month detection over longer periods.
 * Slides a window (default 125 trading days) with stride=1 and merges results.
 */
export function findDipsRolling(
  series: number[],
  options: FindAllDipsOptions = {},
  windowDays: number = 125,
  stride: number = 1
): DipMetrics[] {
  const N = series.length;
  if (N === 0) return [];

  // For short series, fallback to standard detection
  if (N <= windowDays) {
    const direct = findAllDips(series, options);
    // Normalize end and width consistency
    return direct.map(d => ({ ...d, end: d.start + d.width - 1, is_ongoing: (d.start + d.width - 1) >= N - 3 }));
  }

  const all: DipMetrics[] = [];
  const step = Math.max(1, stride);
  const w = Math.max(5, windowDays);

  for (let start = 0; start <= N - w; start += step) {
    const end = start + w;
    const window = series.slice(start, end);
    const dips = findAllDips(window, options);
    for (const d of dips) {
      // Convert to global indices
      const global: DipMetrics = { ...d } as DipMetrics;
      global.start = d.start + start;
      global.end = global.start + d.width - 1;
      global.seg_min_index = d.seg_min_index + start;
      // Do not set is_ongoing here; will normalize after merging
      all.push(global);
    }
  }

  if (all.length === 0) return [];
  return mergeDipsAcrossWindows(all, N);
}

/**
 * Convenience wrapper: use rolling detection for intervals longer than ~6 months.
 */
export function findDipsOptimalForInterval(
  series: number[],
  intervalDays: number,
  options: FindAllDipsOptions = {}
): DipMetrics[] {
  const SIX_MONTHS = 125; // ~6 months of trading days
  if (intervalDays > SIX_MONTHS) {
    return findDipsRolling(series, options, SIX_MONTHS, 1);
  }
  const dips = findAllDips(series, options);
  const N = series.length;
  return dips.map(d => ({ ...d, end: d.start + d.width - 1, is_ongoing: (d.start + d.width - 1) >= N - 3 }));
}
