/**
 * InteractiveSeriesChart: Interactive chart for series data with tooltips
 */

import React, { useState, useMemo } from 'react';
import type { DataPoint } from '../dip/types';

interface InteractiveSeriesChartProps {
  series: number[] | DataPoint[];
  width?: number;
  height?: number;
}

export const InteractiveSeriesChart: React.FC<InteractiveSeriesChartProps> = ({
  series,
  width = 800,
  height = 300
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; x: number; y: number } | null>(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Convert series to DataPoint format if needed
  const dataPoints: DataPoint[] = useMemo(() => {
    if (Array.isArray(series) && series.length > 0 && typeof series[0] === 'object' && 'date' in series[0]) {
      return series as DataPoint[];
    } else {
      // Generate dates for number array
      const values = series as number[];
      return values.map((value, index) => ({
        date: new Date(Date.now() - (values.length - 1 - index) * 24 * 60 * 60 * 1000), // Days ago
        value
      }));
    }
  }, [series]);

  const { xScale, yScale, yMin, yMax } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { xScale: 1, yScale: 1, yMin: 0, yMax: 1 };
    }

    const values = dataPoints.map(p => p.value);
    const yMin = Math.min(...values);
    const yMax = Math.max(...values);
    const yRange = yMax - yMin || 1;
    const yPadding = yRange * 0.1;

    return {
      xScale: chartWidth / Math.max(1, dataPoints.length - 1),
      yScale: chartHeight / (yRange + 2 * yPadding),
      yMin: yMin - yPadding,
      yMax: yMax + yPadding
    };
  }, [dataPoints, chartWidth, chartHeight]);

  const toX = (i: number) => padding.left + i * xScale;
  const toY = (v: number) => padding.top + chartHeight - (v - yMin) * yScale;

  // Generate line path for series
  const linePath = useMemo(() => {
    if (dataPoints.length === 0) return '';
    return dataPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.value)}`)
      .join(' ');
  }, [dataPoints, xScale, yScale, yMin]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - padding.left;

    if (mouseX < 0 || mouseX > chartWidth) {
      setHoveredPoint(null);
      return;
    }

    // Find closest data point
    const index = Math.round(mouseX / xScale);
    if (index >= 0 && index < dataPoints.length) {
      const point = dataPoints[index];
      setHoveredPoint({
        index,
        x: toX(index),
        y: toY(point.value)
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width={width}
        height={height}
        style={{ border: '1px solid #ddd', background: 'white', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        <g opacity={0.1}>
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

        {/* Series line */}
        <path
          d={linePath}
          fill="none"
          stroke="#2563EB"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {dataPoints.map((point, index) => (
          <circle
            key={index}
            cx={toX(index)}
            cy={toY(point.value)}
            r={hoveredPoint?.index === index ? 4 : 2}
            fill="#2563EB"
            opacity={hoveredPoint?.index === index ? 1 : 0.7}
          />
        ))}

        {/* Hover indicator */}
        {hoveredPoint && (
          <g>
            {/* Vertical line */}
            <line
              x1={hoveredPoint.x}
              y1={padding.top}
              x2={hoveredPoint.x}
              y2={padding.top + chartHeight}
              stroke="#666"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            {/* Horizontal line */}
            <line
              x1={padding.left}
              y1={hoveredPoint.y}
              x2={padding.left + chartWidth}
              y2={hoveredPoint.y}
              stroke="#666"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            {/* Highlighted point */}
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r={6}
              fill="#FF6B6B"
              stroke="white"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Axes */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="black"
          strokeWidth={1}
        />
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight}
          stroke="black"
          strokeWidth={1}
        />

        {/* Y-axis labels */}
        {[0, 0.5, 1].map(frac => {
          const val = yMin + (yMax - yMin) * frac;
          const y = padding.top + chartHeight * (1 - frac);
          return (
            <text
              key={frac}
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              fontSize={11}
              fill="#666"
            >
              {val.toFixed(2)}
            </text>
          );
        })}

        {/* X-axis labels */}
        {[0, Math.floor(dataPoints.length / 2), dataPoints.length - 1].map(idx => {
          if (idx >= dataPoints.length) return null;
          const date = dataPoints[idx].date;
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          });
          return (
            <text
              key={idx}
              x={toX(idx)}
              y={padding.top + chartHeight + 20}
              textAnchor="middle"
              fontSize={11}
              fill="#666"
            >
              {dateStr}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          style={{
            position: 'absolute',
            left: hoveredPoint.x + 10,
            top: hoveredPoint.y - 10,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap'
          }}
        >
          <div><strong>Value:</strong> {dataPoints[hoveredPoint.index].value.toFixed(3)}</div>
          <div><strong>Date:</strong> {formatDate(dataPoints[hoveredPoint.index].date)}</div>
          <div><strong>Index:</strong> {hoveredPoint.index}</div>
        </div>
      )}
    </div>
  );
};