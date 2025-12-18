/**
 * DipResults: Display detected dips in a table format
 */

import React from 'react';
import type { DipMetrics, DataPoint } from '../dip/types';
import { getTrendContextHybrid } from '../dip/trendDetection';
import { isDebugMode } from '../config/apiConfig';

interface DipResultsProps {
  dips: DipMetrics[];
  series: DataPoint[] | number[];
}

export const DipResults: React.FC<DipResultsProps> = ({ dips, series }) => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const hasDates = Array.isArray(series) && series.length > 0 && typeof series[0] === 'object' && 'date' in series[0];
  
  const getSeriesValues = () => {
    if (Array.isArray(series) && typeof series[0] === 'object' && 'value' in series[0]) {
      return (series as DataPoint[]).map(p => p.value);
    }
    return series as number[];
  };
  
  const values = getSeriesValues();
  const currentValue = values[values.length - 1];
  const debugMode = isDebugMode();

  // Sort dips by date if dates are available, otherwise by start index
  const sortedDips = [...dips].sort((a, b) => {
    if (hasDates) {
      const dateA = (series as DataPoint[])[a.start].date.getTime();
      const dateB = (series as DataPoint[])[b.start].date.getTime();
      return dateA - dateB;
    }
    return a.start - b.start;
  });

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  if (dips.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        No dips detected. Try adjusting the sensitivity parameter or using multi-scale detection.
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 20px 0' }}>
      <h3 style={{ padding: '0 20px' }}>Dips: {dips.length}</h3>
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 8px' }}>
          {sortedDips.map((dip, idx) => {
            const trend = getTrendContextHybrid(values, dip.end);
            return (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  background: '#fafafa',
                  fontSize: '13px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>Dip #{idx + 1}</span>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: dip.confidence > 0.7 ? '#d1fae5' : dip.confidence > 0.4 ? '#fef3c7' : '#fee2e2',
                      color: dip.confidence > 0.7 ? '#065f46' : dip.confidence > 0.4 ? '#92400e' : '#991b1b',
                      fontWeight: '500',
                      fontSize: '11px'
                    }}
                  >
                    {dip.confidence.toFixed(3)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div><span style={{ color: '#666', fontSize: '11px' }}>Indices:</span> <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>[{dip.start}:{dip.end}]</span></div>
                  <div><span style={{ color: '#666', fontSize: '11px' }}>Width:</span> <span style={{ fontWeight: '500' }}>{dip.width}</span></div>
                  <div><span style={{ color: '#666', fontSize: '11px' }}>Depth:</span> <span style={{ fontWeight: '500' }}>{dip.depth.toFixed(3)}</span></div>
                  <div><span style={{ color: '#666', fontSize: '11px' }}>Min Value:</span> <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>{dip.seg_min.toFixed(3)}</span></div>
                  <div><span style={{ color: '#666', fontSize: '11px' }}>Baseline:</span> <span style={{ fontWeight: '500' }}>{dip.baseline.toFixed(3)}</span></div>
                  <div><span style={{ color: '#666', fontSize: '11px' }}>Current:</span> <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>{currentValue.toFixed(3)}</span></div>
                </div>
                {hasDates && (
                  <div style={{ marginBottom: '8px', paddingTop: '8px', borderTop: '1px solid #d0d0d0' }}>
                    <span style={{ color: '#666', fontSize: '11px' }}>Dates:</span> <span style={{ fontFamily: 'monospace', fontWeight: '500', fontSize: '12px' }}>{formatDate((series as DataPoint[])[dip.start].date)} to {formatDate((series as DataPoint[])[dip.end].date)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #d0d0d0' }}>
                  <span
                    style={{
                      padding: '3px 6px',
                      borderRadius: '4px',
                      background: trend.final_trend === 'UPTREND' ? '#d1fae5' : trend.final_trend === 'DOWNTREND' ? '#fee2e2' : '#fef3c7',
                      color: trend.final_trend === 'UPTREND' ? '#065f46' : trend.final_trend === 'DOWNTREND' ? '#991b1b' : '#92400e',
                      fontWeight: '500',
                      fontSize: '11px'
                    }}
                  >
                    {trend.final_trend}
                  </span>
                  {dip.is_ongoing ? (
                    <span
                      style={{
                        padding: '3px 6px',
                        borderRadius: '4px',
                        background: '#fef3c7',
                        color: '#92400e',
                        fontWeight: '500',
                        fontSize: '11px'
                      }}
                    >
                      ⚠️ Ongoing
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: '3px 6px',
                        borderRadius: '4px',
                        background: '#d1fae5',
                        color: '#065f46',
                        fontWeight: '500',
                        fontSize: '11px'
                      }}
                    >
                      ✓ Complete
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', padding: '0 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>#</th>
                {debugMode && <th style={{ padding: '10px', textAlign: 'left' }}>Indices</th>}
                {hasDates && <th style={{ padding: '10px', textAlign: 'left' }}>Dates</th>}
                <th style={{ padding: '10px', textAlign: 'right' }}>Min Value</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Baseline</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Width</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Depth</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Confidence</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Scale</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Trend</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedDips.map((dip, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #e0e0e0',
                    background: idx % 2 === 0 ? 'white' : '#fafafa'
                  }}
                >
                  <td style={{ padding: '10px' }}>{idx + 1}</td>
                  {debugMode && (
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      [{dip.start}:{dip.end}]
                    </td>
                  )}
                  {hasDates && (
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      {formatDate((series as DataPoint[])[dip.start].date)} - {formatDate((series as DataPoint[])[dip.end].date)}
                    </td>
                  )}
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {dip.seg_min.toFixed(3)}
                    {debugMode ? (
                      <span style={{ color: '#999', fontSize: '12px' }}> @{dip.seg_min_index}</span>
                    ) : (
                      hasDates ? (
                        <span style={{ color: '#999', fontSize: '12px' }}> @{formatDate((series as DataPoint[])[dip.seg_min_index].date)}</span>
                      ) : null
                    )}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{dip.baseline.toFixed(3)}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{dip.width}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{dip.depth.toFixed(3)}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: dip.confidence > 0.7 ? '#d1fae5' : dip.confidence > 0.4 ? '#fef3c7' : '#fee2e2',
                        color: dip.confidence > 0.7 ? '#065f46' : dip.confidence > 0.4 ? '#92400e' : '#991b1b',
                        fontWeight: '500'
                      }}
                    >
                      {dip.confidence.toFixed(3)}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {dip.detection_scale || 'fast'}
                    {dip.detected_at_scales && dip.detected_at_scales > 1 && (
                      <span style={{ color: '#666', fontSize: '12px' }}>
                        {' '}×{dip.detected_at_scales}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    {(() => {
                      const trend = getTrendContextHybrid(values, dip.end);
                      return (
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: trend.final_trend === 'UPTREND' ? '#d1fae5' : trend.final_trend === 'DOWNTREND' ? '#fee2e2' : '#fef3c7',
                            color: trend.final_trend === 'UPTREND' ? '#065f46' : trend.final_trend === 'DOWNTREND' ? '#991b1b' : '#92400e',
                            fontWeight: '500'
                          }}
                        >
                          {trend.final_trend}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    {dip.is_ongoing ? (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: '#fef3c7',
                          color: '#92400e',
                          fontWeight: '500',
                          fontSize: '12px'
                        }}
                        title="Dip is currently happening (no recovery data)"
                      >
                        ⚠️ Ongoing
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: '#d1fae5',
                          color: '#065f46',
                          fontWeight: '500',
                          fontSize: '12px'
                        }}
                        title="Dip has completed and recovered"
                      >
                        ✓ Complete
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
