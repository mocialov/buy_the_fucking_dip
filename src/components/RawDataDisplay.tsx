/**
 * RawDataDisplay: Show raw series data for copy-paste into input field
 */

import React, { useState } from 'react';
import type { DataPoint } from '../dip/types';

interface RawDataDisplayProps {
  series: DataPoint[] | number[];
}

export const RawDataDisplay: React.FC<RawDataDisplayProps> = ({ series }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const rawDataString = series.map(item => 
    typeof item === 'number' ? item.toFixed(2) : item.value.toFixed(2)
  ).join(',');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawDataString);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div style={{ 
      marginTop: '15px', 
      padding: '10px 15px', 
      background: '#F8FAFC', 
      borderRadius: '6px',
      border: '1px solid #E2E8F0'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              borderRadius: '4px',
              border: '1px solid #CBD5E1',
              background: 'white',
              color: '#475569',
              fontWeight: '500'
            }}
          >
            {isExpanded ? '▼ Collapse' : '▶ Expand'}
          </button>
          <span style={{ 
            fontSize: '13px', 
            fontWeight: '500',
            color: '#64748B'
          }}>
            Raw Data ({series.length} points)
          </span>
        </div>
        {isExpanded && (
          <button
            onClick={handleCopy}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              borderRadius: '4px',
              border: '1px solid #10B981',
              background: copySuccess ? '#D1FAE5' : '#ECFDF5',
              color: '#065F46',
              fontWeight: '600'
            }}
          >
            {copySuccess ? '✓ Copied!' : '📋 Copy'}
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#334155',
            background: 'white',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #E2E8F0',
            overflowX: 'auto',
            wordBreak: 'break-all',
            lineHeight: '1.5',
            marginTop: '10px'
          }}>
            {rawDataString}
          </div>

          <div style={{ 
            marginTop: '8px', 
            fontSize: '11px', 
            color: '#64748B',
            fontStyle: 'italic'
          }}>
            💡 Copy this data and paste it into the "Series Data (comma-separated)" field to experiment with different parameters
          </div>
        </>
      )}
    </div>
  );
};
