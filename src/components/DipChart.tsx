/**
 * DipChart: Visualize time series with detected dips
 * SVG-based visualization replicating Python matplotlib output
 */

import React, { useMemo } from 'react';
import type { DipMetrics, DataPoint } from '../dip/types';

interface DipChartProps {
  series: DataPoint[];
  dips: DipMetrics[];
  width?: number;
  height?: number;
}

const COLORS = ['#FF6B6B', '#FFA500', '#FFD93D', '#6BCF7F', '#4ECDC4'];

export const DipChart: React.FC<DipChartProps> = ({
  series,
  dips,
  width = 900,
  height = 400
}) => {
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { xScale, yScale, yMin, yMax } = useMemo(() => {
    if (series.length === 0) {
      return { xScale: 1, yScale: 1, yMin: 0, yMax: 1 };
    }

    const values = series.map(p => p.value);
    const yMin = Math.min(...values);
    const yMax = Math.max(...values);
    const yRange = yMax - yMin || 1;
    const yPadding = yRange * 0.1;

    return {
      xScale: chartWidth / Math.max(1, series.length - 1),
      yScale: chartHeight / (yRange + 2 * yPadding),
      yMin: yMin - yPadding,
      yMax: yMax + yPadding
    };
  }, [series, chartWidth, chartHeight]);

  const toX = (i: number) => padding.left + i * xScale;
  const toY = (v: number) => padding.top + chartHeight - (v - yMin) * yScale;

  // Generate line path for series
  const linePath = useMemo(() => {
    if (series.length === 0) return '';
    return series
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.value)}`)
      .join(' ');
  }, [series, xScale, yScale, yMin]);

  return (
    <div style={{ display: 'flex', width: '100%', position: 'relative', justifyContent: 'center', background: 'white' }}>
      <svg width={width} height={height} style={{ border: '1px solid #ddd', background: 'white' }}>
      {/* Grid lines */}
      <g opacity={0.2}>
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = padding.top + chartHeight * (1 - frac);
          return (
            <line
              key={frac}
              x1={padding.left}
              y1={y}
              x2={padding.left + chartWidth}
              y2={y}
              stroke="#999"
              strokeWidth={1}
            />
          );
        })}
      </g>

      {/* Dip highlights */}
      {dips.map((dip, idx) => {
        const color = COLORS[idx % COLORS.length];
        const x1 = toX(dip.start);
        const x2 = toX(dip.end);
        
        return (
          <g key={idx}>
            {/* Highlight span */}
            <rect
              x={x1}
              y={padding.top}
              width={x2 - x1}
              height={chartHeight}
              fill={color}
              opacity={0.2}
            />
            {/* Minimum marker */}
            <circle
              cx={toX(dip.seg_min_index)}
              cy={toY(dip.seg_min)}
              r={5}
              fill={color}
              stroke="white"
              strokeWidth={2}
            />
          </g>
        );
      })}

      {/* Series line */}
      <path
        d={linePath}
        fill="none"
        stroke="#2563EB"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Axes */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + chartHeight}
        stroke="black"
        strokeWidth={2}
      />
      <line
        x1={padding.left}
        y1={padding.top + chartHeight}
        x2={padding.left + chartWidth}
        y2={padding.top + chartHeight}
        stroke="black"
        strokeWidth={2}
      />

      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const val = yMin + (yMax - yMin) * frac;
        const y = padding.top + chartHeight * (1 - frac);
        return (
          <text
            key={frac}
            x={padding.left - 10}
            y={y + 4}
            textAnchor="end"
            fontSize={12}
            fill="#666"
          >
            {val.toFixed(2)}
          </text>
        );
      })}

      {/* X-axis labels */}
      {[0, Math.floor(series.length / 4), Math.floor(series.length / 2), 
        Math.floor(3 * series.length / 4), series.length - 1].map(idx => {
        if (idx >= series.length) return null;
        const date = series[idx].date;
        const dateStr = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
        return (
          <text
            key={idx}
            x={toX(idx)}
            y={padding.top + chartHeight + 20}
            textAnchor="middle"
            fontSize={12}
            fill="#666"
          >
            {dateStr}
          </text>
        );
      })}

      {/* Axis titles */}
      <text
        x={width / 2}
        y={height - 10}
        textAnchor="middle"
        fontSize={14}
        fontWeight="500"
      >
        Date
      </text>
      <text
        x={20}
        y={height / 2}
        textAnchor="middle"
        fontSize={14}
        fontWeight="500"
        transform={`rotate(-90, 20, ${height / 2})`}
      >
        Value
      </text>

      {/* Title */}
      <text
        x={width / 2}
        y={20}
        textAnchor="middle"
        fontSize={16}
        fontWeight="600"
      >
        Dip Detection
      </text>
    </svg>
  </div>
  );
};
