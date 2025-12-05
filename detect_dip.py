#!/usr/bin/env python3
"""
detect_dip.py

Standalone utility to classify whether a candidate segment in a 1-D scalar time series
constitutes a "dip". A dip is a temporally coherent downward excursion relative to its
immediate local contextual baseline. Global history refines confidence but does not
invalidate shallow local dips.

Core principles implemented:
- Local baseline: robust center (median) of samples immediately before and after segment.
- Global baseline blending: weighted by data volume (alpha = 1 - exp(-N / n0)).
- Robust scale: MAD (median absolute deviation); fallback to IQR/STD if MAD == 0.
- Structural criteria: minimum width, minimum relative depth, optional recovery check.
- Confidence scoring: combines depth (in MADs), area, prominence, and data volume weight.

Two modes:
1. Automatic discovery: finds all dips in a series without needing start/end indices
2. Single segment classification: evaluates a specific [start:end] segment

Usage:

    # Automatic discovery (finds all dips):
    python detect_dip.py --series 5,5,4,3,2.5,3,4,5,5,4.5,3,2,3,4.5,5
    
    # Classify specific segment:
    python detect_dip.py --series 1,2,3,2.5,2.4,2.3,2.6,2.9,3.1 --start 3 --end 5
    
    # Get full JSON metrics:
    python detect_dip.py --series 5,5,4,3,2.5,3,4,5 --json
    
    # Adjust sensitivity (lower k = more permissive):
    python detect_dip.py --series 5,5,4.8,4.7,4.9,5 --k 0.3
    
    # Python API:
    from detect_dip import find_all_dips, detect_dip
    
    series = [5,5,5,4,3,2.5,3,4,5,5,5,4.8,3,2,3,4.8,5]
    
    # Find all dips automatically
    dips = find_all_dips(series)
    for d in dips:
        print(f"Dip at [{d['start']}:{d['end']}], depth={d['depth']:.2f}")
    
    # Classify specific segment
    is_dip, metrics = detect_dip(series, start=4, end=6)
    print(f"Is dip: {is_dip}, confidence: {metrics['confidence']:.3f}")
"""
from __future__ import annotations
import math
import json
import argparse
from typing import Sequence, Dict, Any, Tuple

try:
    import numpy as np
except ImportError:  # Fallback pure python minimal ops
    np = None


def _to_array(x: Sequence[float]):
    if np is not None:
        return np.asarray(x, dtype=float)
    return list(map(float, x))


def _median(v):
    if np is not None:
        return float(np.median(v))
    s = sorted(v)
    n = len(s)
    if n == 0:
        return float('nan')
    m = n // 2
    if n % 2:
        return float(s[m])
    return (s[m-1] + s[m]) / 2.0


def _trimmed_mean(values: Sequence[float], trim_fraction: float = 0.1) -> float:
    if len(values) < 3:
        return sum(values) / len(values) if values else 0.0
    sorted_vals = sorted(values)
    trim_count = max(1, int(len(sorted_vals) * trim_fraction))
    trimmed = sorted_vals[trim_count:-trim_count]
    return sum(trimmed) / len(trimmed) if trimmed else sum(values) / len(values)


def _mad(v, med=None):
    if len(v) == 0:
        return 0.0
    if med is None:
        med = _median(v)
    if np is not None:
        arr = np.asarray(v, dtype=float)
        return float(np.median(np.abs(arr - med)))
    return _median([abs(x - med) for x in v])


def find_local_minima(series: Sequence[float], min_prominence: float = 0.0, 
                      proximity_range: int = 10) -> list:
    """Find local minima indices using simple neighbor comparison.
    Handles plateaus by finding the center of flat minimum regions.
    
    Parameters
    ----------
    series : time series
    min_prominence : minimum required prominence (difference from higher neighbors)
    proximity_range : how far to look for max neighbors (adaptive for scale)
    
    Returns
    -------
    List of (index, value, prominence) tuples
    """
    x = _to_array(series)
    N = len(x)
    if N < 3:
        return []
    
    minima = []
    i = 1
    while i < N - 1:
        # Check if this is a minimum or start of plateau
        if x[i] <= x[i-1] and x[i] <= x[i+1]:
            # Find extent of plateau (equal values)
            j = i
            while j < N - 1 and x[j+1] == x[i]:
                j += 1
            
            # Check if plateau/point is a minimum (surrounded by higher values)
            is_min = (i == 0 or x[i] < x[i-1]) and (j == N-1 or x[i] < x[j+1])
            if not is_min and i > 0 and j < N-1:
                is_min = x[i] <= x[i-1] and x[i] <= x[j+1] and (x[i] < x[i-1] or x[i] < x[j+1])
            
            if is_min:
                # Use center of plateau
                min_idx = (i + j) // 2
                
                # Calculate prominence: min distance to higher neighbors
                left_higher = x[i-1] if i > 0 else x[min_idx]
                right_higher = x[j+1] if j < N-1 else x[min_idx]
                
                # Extend to find max neighbors within proximity_range (adaptive)
                for k in range(max(0, i - proximity_range), i):
                    if x[k] > left_higher:
                        left_higher = x[k]
                for k in range(j+1, min(N, j + proximity_range + 1)):
                    if x[k] > right_higher:
                        right_higher = x[k]
                
                prom = min(left_higher, right_higher) - x[min_idx]
                if prom >= min_prominence:
                    minima.append((min_idx, float(x[min_idx]), prom))
            
            i = j + 1
        else:
            i += 1
    
    # Special case: check if series is descending at the end (ongoing dip)
    # Look at last few points to see if there's a downward trend
    if N >= 3:
        # Check if last point is lower than points before it
        last_idx = N - 1
        if x[last_idx] < x[last_idx - 1]:
            # Find how far back the descent goes
            j = last_idx - 1
            while j > 0 and x[j] < x[j - 1]:
                j -= 1
            
            # j is now the start of the descent, last_idx is the end
            # If we have a descent of at least 2 points, consider it a potential ongoing dip
            if last_idx - j >= 1:
                # Use the last point as the minimum for ongoing dips
                min_idx = last_idx
                
                # Calculate prominence relative to the point before the descent started
                left_higher = x[j] if j > 0 else x[0]
                
                # Extend left to find max in proximity
                for k in range(max(0, j - proximity_range), j + 1):
                    if x[k] > left_higher:
                        left_higher = x[k]
                
                prom = left_higher - x[min_idx]
                if prom >= min_prominence and min_idx not in [m[0] for m in minima]:
                    minima.append((min_idx, float(x[min_idx]), prom))
    
    return minima


# Alias for backward compatibility and clarity
def find_local_minima_scaled(series: Sequence[float], min_prominence: float = 0.0,
                             proximity_range: int = 10) -> list:
    """Alias for find_local_minima with explicit proximity_range."""
    return find_local_minima(series, min_prominence, proximity_range)


def expand_dip_boundaries(series: Sequence[float], min_idx: int, 
                         baseline: float, threshold_factor: float = 0.3) -> Tuple[int, int]:
    """Expand around a local minimum to find dip boundaries.
    
    Boundaries are where the signal crosses back above (baseline - threshold).
    Uses adaptive threshold based on depth to better capture narrow dips.
    
    Parameters
    ----------
    series : time series
    min_idx : index of local minimum
    baseline : reference baseline value
    threshold_factor : fraction of (baseline - min_value) to use as crossing threshold
    
    Returns
    -------
    (start, end) inclusive indices
    """
    x = _to_array(series)
    N = len(x)
    min_val = x[min_idx]
    depth = baseline - min_val
    
    # Adaptive threshold: use lower threshold for deeper dips to capture more context
    # For shallow dips, use standard threshold
    if depth > 0:
        adaptive_factor = min(threshold_factor, threshold_factor * (1 + depth / (baseline + 1e-9)))
    else:
        adaptive_factor = threshold_factor
    
    crossing_level = baseline - adaptive_factor * depth
    
    # Expand left
    start = min_idx
    for i in range(min_idx - 1, -1, -1):
        if x[i] >= crossing_level:
            start = i + 1
            break
    else:
        start = 0
    
    # Expand right
    end = min_idx
    for i in range(min_idx + 1, N):
        if x[i] >= crossing_level:
            end = i - 1
            break
    else:
        end = N - 1
    
    return start, end


def find_all_dips(series: Sequence[float], *,
                 smoothing_window: int = 3,
                 min_prominence_factor: float = 0.3,
                 pre_window: int = None,
                 post_window: int = None,
                 min_width: int = 2,
                 k: float = 0.25,
                 min_abs_depth: float = 0.0,
                 require_recovery: bool = True,
                 n0: int = 200,
                 max_dips: int = 50,
                 multi_scale: bool = True,
                 scale_factors: list = None) -> list:
    """Automatically find all dip segments in a time series.
    
    Multi-scale detection handles both sharp and slow/gradual dips by analyzing
    the series at multiple smoothing levels.
    
    Parameters
    ----------
    series : full time series
    smoothing_window : apply median filter to reduce noise (use 1 for no smoothing)
    min_prominence_factor : minimum prominence as factor of local MAD for initial candidates
    pre_window, post_window : context windows (auto-set to N//4 if None)
    min_width : minimal number of samples for structural dip
    k : depth threshold multiplier
    min_abs_depth : absolute minimal depth
    require_recovery : ensure signal recovers after dip
    n0 : scale factor for global baseline blending
    max_dips : maximum number of dips to return (top ranked by confidence)
    multi_scale : enable multi-scale detection for slow dips (recommended)
    scale_factors : list of smoothing window multipliers [default: [1, 2, 4] for fast/medium/slow]
    
    Returns
    -------
    List of dicts with keys: start, end, and all metrics from detect_dip
    Sorted by confidence descending
    """
    x = _to_array(series)
    N = len(x)
    
    if N < min_width:
        return []
    
    # Auto-adjust windows for short series
    if pre_window is None:
        pre_window = max(min_width, min(50, N // 4))
    if post_window is None:
        post_window = max(min_width, min(50, N // 4))
    
    # Multi-scale detection: analyze at multiple smoothing levels
    if multi_scale and scale_factors is None:
        # Default: detect fast (1x), medium (2x), and slow (4x) dips
        # For very long series, add even slower scale
        if N > 200:
            scale_factors = [1, 2, 4, 8]
        elif N > 50:
            scale_factors = [1, 2, 4]
        else:
            scale_factors = [1, 2]
    elif not multi_scale:
        scale_factors = [1]
    
    all_candidates = []
    
    for scale_factor in scale_factors:
        effective_smoothing = max(1, smoothing_window * scale_factor)
        
        # Optional smoothing at current scale
        if effective_smoothing > 1:
            if np is not None:
                # Simple moving median
                pad = effective_smoothing // 2
                x_pad = np.pad(x, pad, mode='edge')
                x_smooth = np.array([_median(x_pad[i:i+effective_smoothing]) 
                                    for i in range(N)])
            else:
                x_smooth = x  # Skip smoothing in pure python
        else:
            x_smooth = x
        
        # Estimate global baseline and scale for prominence threshold
        global_med = _median(x_smooth)
        global_mad = _mad(x_smooth, global_med)
        if global_mad == 0:
            global_mad = float(max(x_smooth) - min(x_smooth)) / 6.0 or 1e-9
        
        # Scale-adaptive prominence threshold (lower for slower scales)
        scale_prom_factor = min_prominence_factor / math.sqrt(scale_factor)
        min_prom = scale_prom_factor * global_mad
        
        # Scale-adaptive proximity range for prominence calculation
        prominence_range = min(10 * scale_factor, N // 4)
        
        # Find local minima at this scale
        minima = find_local_minima_scaled(x_smooth, min_prominence=min_prom, 
                                          proximity_range=prominence_range)
        
        # Expand each minimum into a candidate segment
        for min_idx, min_val, prom in minima:
            # Estimate local baseline around this point
            # Special case: if minimum is at/near end (potential ongoing dip),
            # look further back for baseline to avoid using the dip itself
            if min_idx >= N - 2:
                # For ongoing dips, use only pre-window data from before potential dip start
                # Look back further to find stable baseline
                ctx_start = max(0, min_idx - pre_window * 2)
                ctx_end = min_idx
                context = list(x_smooth[ctx_start:ctx_end])
                # Filter out descending values near the minimum
                if len(context) > 3:
                    # Find where descent likely started
                    stable_context = []
                    for i in range(len(context) - 1):
                        if context[i] >= min_val + 0.5 * prom:  # Above the dip
                            stable_context.append(context[i])
                    if len(stable_context) >= 3:
                        context = stable_context
            else:
                ctx_start = max(0, min_idx - pre_window)
                ctx_end = min(N, min_idx + post_window)
                context = list(x_smooth[ctx_start:min_idx]) + list(x_smooth[min_idx+1:ctx_end])
            
            if len(context) < 3:
                context = list(x_smooth)
            local_baseline = _median(context)
            
            start, end = expand_dip_boundaries(x_smooth, min_idx, local_baseline)
            
            # Adjust min_width for scale (slower dips should be wider)
            scale_min_width = max(min_width, int(min_width * math.sqrt(scale_factor)))
            
            # Classify using original series (not smoothed)
            is_dip, metrics = detect_dip(series, start, end,
                                         pre_window=pre_window,
                                         post_window=post_window,
                                         min_width=scale_min_width,
                                         k=k,
                                         min_abs_depth=min_abs_depth,
                                         require_recovery=require_recovery,
                                         n0=n0)
            
            if is_dip:
                # Tag with scale information
                metrics['scale_factor'] = scale_factor
                metrics['detection_scale'] = 'fast' if scale_factor == 1 else ('medium' if scale_factor <= 2 else 'slow')
                all_candidates.append(metrics)
    
    if not all_candidates:
        return []
    
    if not all_candidates:
        return []
    
    # Merge overlapping dips from different scales
    # Keep deeper one, but prefer dips detected at multiple scales (more robust)
    if len(all_candidates) > 1:
        all_candidates.sort(key=lambda d: d['start'])
        merged = []
        current = all_candidates[0]
        current_scales = [current['scale_factor']]
        
        for next_dip in all_candidates[1:]:
            # Check for overlap (allowing small gap for slow dips)
            gap_tolerance = max(2, int(2 * math.sqrt(max(current['scale_factor'], next_dip['scale_factor']))))
            if next_dip['start'] <= current['end'] + gap_tolerance:
                # Overlap: merge by keeping deeper, but track multi-scale detection
                if next_dip['depth'] > current['depth'] * 1.1:  # Prefer significantly deeper
                    current_scales = [next_dip['scale_factor']]
                    current = next_dip
                elif abs(next_dip['depth'] - current['depth']) / current['depth'] < 0.1:
                    # Similar depth: track that it was detected at multiple scales (boost confidence)
                    current_scales.append(next_dip['scale_factor'])
                # else: keep current, discard next_dip
            else:
                # No overlap: save current and move to next
                current['detected_at_scales'] = len(set(current_scales))
                current['scale_list'] = sorted(set(current_scales))
                # Boost confidence for multi-scale detection
                if len(current_scales) > 1:
                    current['confidence'] = min(1.0, current['confidence'] * (1.0 + 0.1 * (len(current_scales) - 1)))
                merged.append(current)
                current = next_dip
                current_scales = [next_dip['scale_factor']]
        
        # Don't forget last candidate
        current['detected_at_scales'] = len(set(current_scales))
        current['scale_list'] = sorted(set(current_scales))
        if len(current_scales) > 1:
            current['confidence'] = min(1.0, current['confidence'] * (1.0 + 0.1 * (len(current_scales) - 1)))
        merged.append(current)
        all_candidates = merged
    else:
        # Single candidate
        if all_candidates:
            all_candidates[0]['detected_at_scales'] = 1
            all_candidates[0]['scale_list'] = [all_candidates[0]['scale_factor']]
    
    # Sort by confidence and limit
    all_candidates.sort(key=lambda d: d['confidence'], reverse=True)
    return all_candidates[:max_dips]


def detect_dip(series: Sequence[float], start: int, end: int, *,
               pre_window: int = 50,
               post_window: int = 50,
               min_width: int = 2,
               k: float = 0.25,
               min_abs_depth: float = 0.0,
               require_recovery: bool = True,
               n0: int = 200) -> Tuple[bool, Dict[str, Any]]:
    """Classify a segment [start,end] (inclusive) as a dip.

    Parameters
    ----------
    series : full time series
    start, end : segment boundaries (inclusive indices)
    pre_window, post_window : number of samples before/after used for local baseline
    min_width : minimal number of samples for structural dip
    k : depth threshold multiplier for local MAD (kept small to allow shallow dips)
    min_abs_depth : absolute minimal depth difference from baseline (can be 0)
    require_recovery : ensure segment ends below baseline but recovers afterwards
    n0 : scale factor controlling global baseline blending weight alpha = 1 - exp(-N/n0)

    Returns
    -------
    (is_dip, metrics dict)
    """
    if start < 0 or end >= len(series) or end < start:
        raise ValueError("Invalid segment bounds")

    x = _to_array(series)
    N = len(x)

    width = end - start + 1
    segment = x[start:end+1]

    # Structural width criterion
    if width < min_width:
        return False, {
            "reason": "width_below_min",
            "width": width,
            "min_width": min_width
        }

    # Local baseline using windows before and after (excluding segment)
    pre_start = max(0, start - pre_window)
    pre = x[pre_start:start]
    post_end = min(N, end + 1 + post_window)
    post = x[end+1:post_end]

    # For dips near the end, treat as ongoing to avoid baseline contamination by low post data
    is_ongoing = (end >= N - 3) or (len(post) == 0)

    local_ctx = []
    local_ctx.extend(pre)
    if not is_ongoing:
        local_ctx.extend(post)

    # Fallback: if insufficient context, use entire series excluding segment
    if len(local_ctx) < max(5, min_width):
        local_ctx = list(x[:start]) + list(x[end+1:])

    # If still insufficient (<3), just treat baseline as median of available points
    if len(local_ctx) < 3:
        local_ctx = list(x)

    local_med = _trimmed_mean(local_ctx) #_median(local_ctx)
    local_mad = _mad(local_ctx, local_med)

    if local_mad == 0.0:
        # Fallback scale estimate: IQR or std
        if np is not None:
            q1 = float(np.quantile(local_ctx, 0.25))
            q3 = float(np.quantile(local_ctx, 0.75))
            iqr = q3 - q1
            if iqr > 0:
                local_mad = iqr / 1.349  # approximate conversion to MAD
            else:
                std = float(np.std(local_ctx))
                local_mad = std / 1.4826 if std > 0 else 1e-9
        else:
            # Pure python fallback: simple mean absolute deviation
            mean_val = sum(local_ctx) / len(local_ctx)
            ad = sum(abs(v - mean_val) for v in local_ctx) / len(local_ctx)
            local_mad = ad or 1e-9

    # Global baseline (excluding segment) for weighting
    global_ctx = list(x[:start]) + list(x[end+1:])
    if len(global_ctx) == 0:
        global_ctx = list(x)
    global_med = _trimmed_mean(global_ctx) #_median(global_ctx)

    # For dips near the end, treat as ongoing
    is_ongoing = (end >= N - 3) or (len(post) == 0)

    alpha = 1 - math.exp(-N / float(n0))  # increases with more data
    
    # Use max(local, global) for ongoing dips OR when dip is in elevated local region
    # This prevents global baseline from pulling down local baseline for dips in high zones
    if is_ongoing or local_med > global_med:
        baseline = max(local_med, global_med)
    else:
        baseline = alpha * global_med + (1 - alpha) * local_med

    seg_min = float(min(segment))
    if np is not None and hasattr(segment, 'shape'):
        seg_min_idx_rel = int(np.argmin(segment))
    else:
        seg_min_idx_rel = int(segment.index(seg_min))
    seg_min_idx = start + seg_min_idx_rel

    depth = baseline - seg_min  # positive if below baseline

    # Depth threshold (allow shallow dips): max(min_abs_depth, k * local_mad)
    depth_threshold = max(min_abs_depth, k * local_mad)
    passes_depth = depth >= depth_threshold

    # Prominence: difference between seg_min and min of nearest higher points around segment
    left_ref = _trimmed_mean(pre) if len(pre) > 0 else baseline #_median(pre) if len(pre) > 0 else baseline
    right_ref = _trimmed_mean(post) if len(post) > 0 else baseline #_median(post) if len(post) > 0 else baseline
    neighbor_ref = (left_ref + right_ref) / 2.0
    prominence = neighbor_ref - seg_min

    # Recovery: does series after end return within epsilon of baseline within post_window?
    # Special case: if no post data available (dip at end), mark as ongoing and don't require recovery
    recovered = True
    recovery_epsilon = 0.5 * local_mad  # allow some slack
    
    if require_recovery and len(post) > 0:
        # For very deep dips (>3x threshold), check extended window or relax requirement
        # Deep dips may have slow recovery, but are clearly significant features
        depth_ratio = depth / depth_threshold if depth_threshold > 0 else 0
        
        if depth_ratio > 3.0:
            # Very deep dip: use extended recovery window (up to 2x post_window)
            extended_post_end = min(N, end + 1 + post_window * 2)
            extended_post = x[end+1:extended_post_end]
            recovered = any(abs(v - baseline) <= recovery_epsilon for v in extended_post)
            
            # If still no recovery in extended window, relax epsilon for very deep dips
            if not recovered and depth_ratio > 5.0:
                # For extremely deep dips (>5x threshold), use more lenient recovery check
                relaxed_epsilon = local_mad  # double the tolerance
                recovered = any(abs(v - baseline) <= relaxed_epsilon for v in extended_post)
        else:
            # Normal depth: standard recovery check
            recovered = any(abs(v - baseline) <= recovery_epsilon for v in post)
            
            # Additional check: for gradual recovery dips, verify monotonic improvement
            # If signal doesn't reach baseline but shows consistent upward trend, accept it
            if not recovered and len(post) >= 5:
                # Check if post-dip values show improvement (moving away from seg_min toward baseline)
                post_first_half = post[:len(post)//2]
                post_second_half = post[len(post)//2:]
                if len(post_first_half) >= 2 and len(post_second_half) >= 2:
                    # Calculate mean distance from seg_min for each half
                    dist_first = sum(abs(v - seg_min) for v in post_first_half) / len(post_first_half)
                    dist_second = sum(abs(v - seg_min) for v in post_second_half) / len(post_second_half)
                    # If second half is farther from minimum, signal is improving
                    improvement = dist_second - dist_first
                    # Accept as recovered if showing improvement >= 0.3 * depth
                    if improvement >= 0.3 * depth:
                        recovered = True
    elif is_ongoing:
        # Ongoing dip at end of series - no recovery data available, so pass recovery check
        recovered = True

    # Area (integrated depth) relative to baseline
    if np is not None:
        area = float(np.sum(baseline - segment))
    else:
        area = sum(baseline - float(v) for v in segment)

    # Confidence score (bounded ~[0,1.5]): combine normalized metrics
    depth_score = depth / (local_mad + 1e-12)
    area_score = area / ((local_mad + 1e-12) * width)
    prom_score = prominence / (local_mad + 1e-12)
    raw_score = 0.4 * depth_score + 0.3 * area_score + 0.3 * prom_score
    confidence = max(0.0, min(1.0, (math.tanh(raw_score / 3.0) * 1.2)))

    is_dip = passes_depth and recovered

    metrics = {
        "start": start,
        "end": end,
        "width": width,
        "baseline": baseline,
        "local_median": local_med,
        "global_median": global_med,
        "local_mad": local_mad,
        "alpha": alpha,
        "seg_min": seg_min,
        "seg_min_index": seg_min_idx,
        "depth": depth,
        "depth_threshold": depth_threshold,
        "prominence": prominence,
        "area": area,
        "recovered": recovered,
        "is_ongoing": is_ongoing,
        "confidence": confidence,
        "is_dip": is_dip,
        "k": k,
        "min_abs_depth": min_abs_depth
    }

    if not passes_depth:
        metrics["reason"] = "depth_below_threshold"
    elif require_recovery and not recovered:
        metrics["reason"] = "no_recovery"

    return is_dip, metrics


def _parse_series_arg(s: str):
    # Accept comma-separated or JSON list
    s = s.strip()
    if s.startswith('['):
        return json.loads(s)
    return [float(p) for p in s.split(',') if p]


def main():
    ap = argparse.ArgumentParser(description="Classify a segment as dip or find all dips.")
    ap.add_argument('--series', required=True, help='Comma-separated numbers or JSON list')
    
    # Mode selection
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument('--find-all', action='store_true', 
                     help='Automatically find all dips (default if --start/--end not given)')
    mode.add_argument('--start', type=int, help='Start index for single segment classification')
    
    ap.add_argument('--end', type=int, help='End index for single segment classification')
    
    # Common parameters
    ap.add_argument('--pre-window', type=int, default=None,
                   help='Context window before segment (auto: N//4 for find-all, 50 for single)')
    ap.add_argument('--post-window', type=int, default=None,
                   help='Context window after segment (auto: N//4 for find-all, 50 for single)')
    ap.add_argument('--min-width', type=int, default=3)
    ap.add_argument('--k', type=float, default=0.5)
    ap.add_argument('--min-abs-depth', type=float, default=0.0)
    ap.add_argument('--no-recovery-check', action='store_true', help='Disable recovery requirement')
    ap.add_argument('--n0', type=int, default=200)
    
    # find-all specific
    ap.add_argument('--smoothing-window', type=int, default=3,
                   help='Base smoothing window (multiplied by scale factors)')
    ap.add_argument('--min-prominence-factor', type=float, default=0.3)
    ap.add_argument('--max-dips', type=int, default=50)
    ap.add_argument('--no-multi-scale', action='store_true',
                   help='Disable multi-scale detection (only single scale)')
    ap.add_argument('--scale-factors', type=str, default=None,
                   help='Comma-separated scale factors (e.g., "1,2,4,8")')
    
    ap.add_argument('--json', action='store_true', help='Print full metrics JSON')
    args = ap.parse_args()

    series = _parse_series_arg(args.series)
    
    # Determine mode
    if args.start is not None and args.end is not None:
        # Single segment classification
        pre_win = args.pre_window if args.pre_window is not None else 50
        post_win = args.post_window if args.post_window is not None else 50
        
        is_dip, metrics = detect_dip(series, args.start, args.end,
                                     pre_window=pre_win,
                                     post_window=post_win,
                                     min_width=args.min_width,
                                     k=args.k,
                                     min_abs_depth=args.min_abs_depth,
                                     require_recovery=not args.no_recovery_check,
                                     n0=args.n0)
        if args.json:
            print(json.dumps(metrics, indent=2))
        else:
            print(f"is_dip={is_dip} depth={metrics['depth']:.4g} threshold={metrics['depth_threshold']:.4g} confidence={metrics['confidence']:.3f}")
    else:
        # Find all dips
        scale_factors_list = None
        if args.scale_factors:
            scale_factors_list = [int(s.strip()) for s in args.scale_factors.split(',')]
        
        dips = find_all_dips(series,
                            smoothing_window=args.smoothing_window,
                            min_prominence_factor=args.min_prominence_factor,
                            pre_window=args.pre_window,
                            post_window=args.post_window,
                            min_width=args.min_width,
                            k=args.k,
                            min_abs_depth=args.min_abs_depth,
                            require_recovery=not args.no_recovery_check,
                            n0=args.n0,
                            max_dips=args.max_dips,
                            multi_scale=not args.no_multi_scale,
                            scale_factors=scale_factors_list)
        
        if args.json:
            print(json.dumps(dips, indent=2))
        else:
            print(f"Found {len(dips)} dip(s):")
            for i, d in enumerate(dips, 1):
                scale_info = f" scales={d.get('detected_at_scales', 1)}" if d.get('detected_at_scales', 1) > 1 else ""
                detection_type = f" [{d.get('detection_scale', 'fast')}]" if 'detection_scale' in d else ""
                print(f"  {i}. [{d['start']}:{d['end']}] depth={d['depth']:.4g} width={d['width']} conf={d['confidence']:.3f}{detection_type}{scale_info}")


if __name__ == '__main__':
    main()
