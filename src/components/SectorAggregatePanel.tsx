/**
 * SectorAggregatePanel: Shows sector-level aggregate metrics derived from constituent dips
 */

import React from 'react';
import type { SectorAnalysis } from './SeriesInput';
import type { TimeInterval } from '../dip/types';

interface SectorAggregatePanelProps {
  sectorAnalyses: SectorAnalysis[];
  sectorName: string;
  selectedInterval: TimeInterval;
}

interface SectorMetrics {
  totalTickers: number;
  tickersWithDips: number;
  activeDipCount: number;
  breadthPercentage: number;
  averageDepth: number;
  maxDepth: number;
  deepestTicker: string;
  averageDuration: number;
  sectorHealthScore: number;
  correlationLevel: 'Low' | 'Moderate' | 'High' | 'Very High';
  tickerDetails: TickerDipDetail[];
  etfAverageDepth: number;
  etfCount: number;
  stockCount: number;
  etfBreadthPercentage: number;
  stockBreadthPercentage: number;
}

interface TickerDipDetail {
  ticker: string;
  companyName: string;
  hasOngoingDip: boolean;
  dipDepth: number;
  dipWidth: number;
  currentValue: number;
  dipStartValue: number;
  percentFromPeak: number;
  isETF: boolean;
  // Aggregated metrics across all dips for this ticker
  totalDips: number;           // How many dips detected
  avgDipDepth: number;         // Average depth across all dips
  maxDipDepth: number;         // Worst dip depth
  avgDipDuration: number;      // Average duration in days
  totalDipDays: number;        // Total days spent in dips
  dipScore: number;            // Combined score: frequency × severity × duration
}

function calculateSectorMetrics(
  analyses: SectorAnalysis[],
  interval: TimeInterval
): SectorMetrics {
  const validAnalyses = analyses.filter(a => !a.error);
  const totalTickers = validAnalyses.length;

  if (totalTickers === 0) {
    return {
      totalTickers: 0,
      tickersWithDips: 0,
      activeDipCount: 0,
      breadthPercentage: 0,
      averageDepth: 0,
      maxDepth: 0,
      deepestTicker: '',
      averageDuration: 0,
      sectorHealthScore: 100,
      correlationLevel: 'Low',
      tickerDetails: [],
      etfAverageDepth: 0,
      etfCount: 0,
      stockCount: 0,
      etfBreadthPercentage: 0,
      stockBreadthPercentage: 0
    };
  }

  let tickersWithDips = 0;
  let totalActiveDips = 0;
  let totalOngoingDepth = 0;
  let totalOngoingDuration = 0;
  let maxOngoingDepth = 0;
  let deepestTicker = '';
  let ongoingDipCount = 0;
  
  // ETF-specific tracking
  let etfOngoingDepthSum = 0;
  let etfOngoingDipCount = 0;
  let etfCount = 0;
  let stockCount = 0;
  let etfsWithDips = 0;
  let stocksWithDips = 0;
  
  const tickerDetails: TickerDipDetail[] = [];

  validAnalyses.forEach(analysis => {
    const intervalData = analysis.intervalAnalyses.find(ia => ia.interval === interval);
    if (!intervalData) return;

    const { dips, series } = intervalData;
    const isETF = analysis.isETF ?? false;  // Use explicit flag from analysis data
    
    console.log(`Ticker: ${analysis.ticker}, isETF: ${isETF}, dips found: ${dips.length}`);
    
    if (isETF) {
      etfCount++;
    } else {
      stockCount++;
    }
    
    // Check for ongoing dips (dips that extend to the end of the series)
    const ongoingDips = dips.filter(dip => {
      const dipEnd = dip.start + dip.width - 1;
      return dipEnd >= series.length - 3; // Within last 3 points = ongoing
    });
    
    // Track if ticker has any ongoing dip (for breadth calculation)
    const hasAnyOngoingDip = ongoingDips.length > 0;
    if (hasAnyOngoingDip) {
      tickersWithDips++;
      if (isETF) {
        etfsWithDips++;
      } else {
        stocksWithDips++;
      }
      totalActiveDips += ongoingDips.length;
    }

    // Process ALL dips for this ticker and aggregate into summary metrics
    const allDips = dips.map(dip => ({
      normalizedDepth: dip.baseline > 0 ? dip.depth / dip.baseline : 0,
      duration: dip.width,
      isOngoing: (dip.start + dip.width - 1) >= series.length - 3
    }));
    
    // Calculate aggregated metrics
    const totalDips = allDips.length;
    const avgDipDepth = totalDips > 0 
      ? allDips.reduce((sum, d) => sum + d.normalizedDepth, 0) / totalDips 
      : 0;
    const maxDipDepth = totalDips > 0
      ? Math.max(...allDips.map(d => d.normalizedDepth))
      : 0;
    const avgDipDuration = totalDips > 0
      ? allDips.reduce((sum, d) => sum + d.duration, 0) / totalDips
      : 0;
    const totalDipDays = allDips.reduce((sum, d) => sum + d.duration, 0);
    
    // Dip Score: combines frequency, severity, and time spent in dips
    // Formula: (# of dips) × (avg depth %) × (total days in dips / total days analyzed)
    const dipScore = (totalDips * avgDipDepth * (totalDipDays / series.length)) * 100;
    
    // Track statistics for ongoing dips only (for aggregate sector metrics)
    const ongoingAggDips = allDips.filter(d => d.isOngoing);
    ongoingAggDips.forEach(aggDip => {
      totalOngoingDepth += aggDip.normalizedDepth;
      totalOngoingDuration += aggDip.duration;
      ongoingDipCount++;
      
      if (isETF) {
        etfOngoingDepthSum += aggDip.normalizedDepth;
        etfOngoingDipCount++;
      }

      if (aggDip.normalizedDepth > maxOngoingDepth) {
        maxOngoingDepth = aggDip.normalizedDepth;
        deepestTicker = analysis.ticker;
      }
    });

    // Calculate current metrics (for deepest ongoing dip if exists)
    const currentValue = series[series.length - 1].value;
    let dipDepth = 0;
    let dipWidth = 0;
    let dipStartValue = currentValue;
    let percentFromPeak = 0;
    
    if (ongoingAggDips.length > 0) {
      // Find the deepest ongoing dip
      const deepestOngoing = dips.filter(dip => {
        const dipEnd = dip.start + dip.width - 1;
        return dipEnd >= series.length - 3;
      }).reduce((max, dip) => dip.depth > max.depth ? dip : max, dips[0]);
      
      dipDepth = deepestOngoing.baseline > 0 ? deepestOngoing.depth / deepestOngoing.baseline : 0;
      dipWidth = deepestOngoing.width;
      dipStartValue = series[deepestOngoing.start].value;
      percentFromPeak = ((currentValue - dipStartValue) / dipStartValue) * 100;
    }

    // Add single aggregated entry for this ticker (always, whether it has dips or not)
    tickerDetails.push({
      ticker: analysis.ticker,
      companyName: analysis.companyName,
      hasOngoingDip: ongoingAggDips.length > 0,
      dipDepth,
      dipWidth,
      currentValue,
      dipStartValue,
      percentFromPeak,
      isETF,
      totalDips,
      avgDipDepth,
      maxDipDepth,
      avgDipDuration,
      totalDipDays,
      dipScore
    });
  });

  const breadthPercentage = (tickersWithDips / totalTickers) * 100;
  const averageDepth = ongoingDipCount > 0 ? totalOngoingDepth / ongoingDipCount : 0;
  const averageDuration = ongoingDipCount > 0 ? totalOngoingDuration / ongoingDipCount : 0;
  const etfAverageDepth = etfOngoingDipCount > 0 ? etfOngoingDepthSum / etfOngoingDipCount : 0;
  const etfBreadthPercentage = etfCount > 0 ? (etfsWithDips / etfCount) * 100 : 0;
  const stockBreadthPercentage = stockCount > 0 ? (stocksWithDips / stockCount) * 100 : 0;

  console.log('Breadth Debug:', {
    etfCount,
    stockCount,
    etfsWithDips,
    stocksWithDips,
    etfBreadthPercentage,
    stockBreadthPercentage,
    totalTickers,
    tickersWithDips
  });

  // Sector Health Score (0-100, where 100 = healthy, 0 = crisis)
  // Based on: breadth (60%), average depth (30%), max depth (10%)
  const breadthScore = Math.max(0, 100 - breadthPercentage * 1.5); // Heavy penalty for breadth
  const avgDepthScore = Math.max(0, 100 - averageDepth * 500); // Depth as percentage
  const maxDepthScore = Math.max(0, 100 - maxOngoingDepth * 400);
  const sectorHealthScore = Math.round(
    breadthScore * 0.6 + avgDepthScore * 0.3 + maxDepthScore * 0.1
  );

  // Correlation Level (how clustered are the dips?)
  let correlationLevel: 'Low' | 'Moderate' | 'High' | 'Very High';
  if (breadthPercentage >= 70) correlationLevel = 'Very High';
  else if (breadthPercentage >= 50) correlationLevel = 'High';
  else if (breadthPercentage >= 30) correlationLevel = 'Moderate';
  else correlationLevel = 'Low';

  // Sort ticker details: 
  // 1. ETFs first, then stocks
  // 2. Within each group: ongoing dips first, then historical/no dips
  // 3. Within each subgroup: sort by dipScore (higher = worse)
  tickerDetails.sort((a, b) => {
    // ETFs before stocks (always at top)
    if (a.isETF && !b.isETF) return -1;
    if (!a.isETF && b.isETF) return 1;
    
    // Within same ETF/stock group: ongoing dips before historical
    if (a.hasOngoingDip && !b.hasOngoingDip) return -1;
    if (!a.hasOngoingDip && b.hasOngoingDip) return 1;
    
    // Within same type: sort by dipScore (higher first = worse performance)
    return b.dipScore - a.dipScore;
  });

  return {
    totalTickers,
    tickersWithDips,
    activeDipCount: totalActiveDips,
    breadthPercentage,
    averageDepth,
    maxDepth: maxOngoingDepth,
    deepestTicker,
    averageDuration,
    sectorHealthScore,
    correlationLevel,
    tickerDetails,
    etfAverageDepth,
    etfCount,
    stockCount,
    etfBreadthPercentage,
    stockBreadthPercentage
  };
}

function getHealthColor(score: number): string {
  if (score >= 80) return '#10B981'; // Green - Healthy
  if (score >= 60) return '#F59E0B'; // Yellow - Caution
  if (score >= 40) return '#F97316'; // Orange - Warning
  return '#EF4444'; // Red - Crisis
}

function getHealthLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Caution';
  if (score >= 40) return 'Warning';
  return 'Crisis';
}

function getBreadthColor(percentage: number): string {
  if (percentage >= 70) return '#EF4444'; // Red - Very high correlation
  if (percentage >= 50) return '#F97316'; // Orange - High correlation
  if (percentage >= 30) return '#F59E0B'; // Yellow - Moderate
  return '#10B981'; // Green - Low correlation (healthy)
}

export const SectorAggregatePanel: React.FC<SectorAggregatePanelProps> = ({
  sectorAnalyses,
  sectorName,
  selectedInterval
}) => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const metrics = calculateSectorMetrics(sectorAnalyses, selectedInterval);
  const healthColor = getHealthColor(metrics.sectorHealthScore);
  const breadthColor = getBreadthColor(metrics.breadthPercentage);

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: isMobile ? '12px' : '20px',
      marginBottom: '20px',
      border: '2px solid #E5E7EB',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ marginBottom: '15px', borderBottom: '2px solid #E5E7EB', paddingBottom: '12px' }}>
        <h2 style={{ margin: '0 0 5px 0', color: '#1a1a1a', fontSize: isMobile ? '18px' : '24px' }}>
          {sectorName} - Sector Aggregate Analysis
        </h2>
        <p style={{ margin: 0, color: '#6B7280', fontSize: isMobile ? '12px' : '14px' }}>
          Composite metrics derived from {metrics.totalTickers} constituent tickers
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: isMobile ? '10px' : '15px',
        marginBottom: '20px'
      }}>
        {/* Sector Health Score */}
        <div style={{
          padding: '15px',
          background: `${healthColor}15`,
          borderRadius: '6px',
          border: `2px solid ${healthColor}`
        }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '5px', fontWeight: '600' }}>
            SECTOR HEALTH SCORE
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: healthColor, marginBottom: '5px' }}>
            {metrics.sectorHealthScore}
          </div>
          <div style={{ fontSize: '13px', color: healthColor, fontWeight: '600' }}>
            {getHealthLabel(metrics.sectorHealthScore)}
          </div>
        </div>

        {/* Breadth Percentage */}
        <div style={{
          padding: '15px',
          background: `${breadthColor}15`,
          borderRadius: '6px',
          border: `2px solid ${breadthColor}`
        }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '5px', fontWeight: '600' }}>
            DIP BREADTH (% IN DIP)
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: breadthColor, marginBottom: '5px' }}>
            {metrics.breadthPercentage.toFixed(1)}%
          </div>
          <div style={{ fontSize: '13px', color: '#6B7280' }}>
            {metrics.tickersWithDips} of {metrics.totalTickers} tickers
          </div>
        </div>

        {/* Active Dips Count */}
        <div style={{
          padding: '15px',
          background: '#F3F4F6',
          borderRadius: '6px',
          border: '2px solid #D1D5DB'
        }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '5px', fontWeight: '600' }}>
            ACTIVE DIPS
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#374151', marginBottom: '5px' }}>
            {metrics.activeDipCount}
          </div>
          <div style={{ fontSize: '13px', color: '#6B7280' }}>
            Ongoing now
          </div>
        </div>

        {/* Correlation Level */}
        <div style={{
          padding: '15px',
          background: '#F3F4F6',
          borderRadius: '6px',
          border: '2px solid #D1D5DB'
        }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '5px', fontWeight: '600' }}>
            CORRELATION LEVEL
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#374151', marginBottom: '5px' }}>
            {metrics.correlationLevel}
          </div>
          <div style={{ fontSize: '13px', color: '#6B7280' }}>
            Dip clustering
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: isMobile ? '8px' : '12px',
        padding: isMobile ? '10px' : '15px',
        background: '#F9FAFB',
        borderRadius: '6px'
      }}>
        <MetricItem
          label="Average Dip Depth"
          value={`${(metrics.averageDepth * 100).toFixed(2)}%`}
          icon="📉"
        />
        <MetricItem
          label="Max Dip Depth"
          value={`${(metrics.maxDepth * 100).toFixed(2)}%`}
          icon="⚠️"
        />
        <MetricItem
          label="Deepest Ticker"
          value={metrics.deepestTicker || 'N/A'}
          icon="🎯"
        />
        <MetricItem
          label="Avg Dip Duration"
          value={`${metrics.averageDuration.toFixed(1)} days`}
          icon="⏱️"
        />
      </div>

      {/* Interpretation Guide */}
      <div style={{
        marginTop: '15px',
        padding: '12px',
        background: '#EFF6FF',
        borderRadius: '6px',
        border: '1px solid #BFDBFE'
      }}>
        <div style={{ fontSize: '13px', color: '#1E40AF', lineHeight: '1.6' }}>
          <strong>💡 Interpretation:</strong>
          {metrics.breadthPercentage >= 50 ? (
            <span> High breadth ({metrics.breadthPercentage.toFixed(0)}%) suggests sector-wide pressure. This may indicate systemic issues or broader market correction affecting the entire {sectorName.toLowerCase()} sector.</span>
          ) : metrics.breadthPercentage >= 30 ? (
            <span> Moderate breadth ({metrics.breadthPercentage.toFixed(0)}%) indicates some correlation. Monitor for potential sector-wide trend developing.</span>
          ) : (
            <span> Low breadth ({metrics.breadthPercentage.toFixed(0)}%) suggests stock-specific issues rather than sector-wide problems.</span>
          )}
        </div>
      </div>

      {/* Ticker Rankings Table */}
      <div style={{
        marginTop: '20px',
        background: 'white',
        borderRadius: '6px',
        border: '1px solid #E5E7EB',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: isMobile ? '8px 10px' : '12px 15px',
          background: '#F9FAFB',
          borderBottom: '2px solid #E5E7EB',
          fontWeight: '600',
          fontSize: isMobile ? '12px' : '14px',
          color: '#374151'
        }}>
          📋 Aggregated Dip Performance by Ticker
        </div>

        <div style={{ overflowX: isMobile ? 'auto' : 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '11px' : '13px' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: isMobile ? '6px' : '10px', textAlign: 'left', fontWeight: '600', color: '#6B7280', fontSize: isMobile ? '10px' : 'inherit' }}>Rank</th>
                <th style={{ padding: isMobile ? '6px' : '10px', textAlign: 'left', fontWeight: '600', color: '#6B7280', fontSize: isMobile ? '10px' : 'inherit' }}>Ticker</th>
                {!isMobile && <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#6B7280' }}>Company</th>}
                <th style={{ padding: isMobile ? '6px' : '10px', textAlign: 'right', fontWeight: '600', color: '#6B7280', fontSize: isMobile ? '10px' : 'inherit' }}>Status</th>
                {!isMobile && <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#6B7280' }}>Total Dips</th>}
                <th style={{ padding: isMobile ? '6px' : '10px', textAlign: 'right', fontWeight: '600', color: '#6B7280', fontSize: isMobile ? '10px' : 'inherit' }}>Avg Depth</th>
                <th style={{ padding: isMobile ? '6px' : '10px', textAlign: 'right', fontWeight: '600', color: '#6B7280', fontSize: isMobile ? '10px' : 'inherit' }}>Max Depth</th>
                {!isMobile && <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#6B7280' }}>Dip Score</th>}
                {!isMobile && <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#6B7280' }}>Total Days in Dips</th>}
                {!isMobile && <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#6B7280' }}>vs Benchmark</th>}
              </tr>
            </thead>
            <tbody>
              {metrics.tickerDetails.map((detail, index) => {
                // For stocks: compare aggregated dipScore vs ETF average dipScore
                let breadthComparison = '';
                let comparisonColor = '#6B7280';
                
                if (!detail.isETF && detail.totalDips > 0) {
                  // Calculate average dipScore across all ETFs
                  const etfScores = metrics.tickerDetails.filter(d => d.isETF && d.totalDips > 0);
                  const etfAvgScore = etfScores.length > 0
                    ? etfScores.reduce((sum, d) => sum + d.dipScore, 0) / etfScores.length
                    : 0;
                  
                  if (etfAvgScore === 0) {
                    // Stock has dips but ETFs don't - stock-specific weakness
                    breadthComparison = `⚠️ Stock-specific (ETFs healthy)`;
                    comparisonColor = '#DC2626';
                  } else {
                    // Compare stock dipScore vs ETF average dipScore
                    const comparison = ((detail.dipScore - etfAvgScore) / etfAvgScore) * 100;
                    if (comparison > 20) {
                      breadthComparison = `📉 ${comparison.toFixed(0)}% worse`;
                      comparisonColor = '#DC2626';
                    } else if (comparison < -20) {
                      breadthComparison = `✅ ${Math.abs(comparison).toFixed(0)}% better`;
                      comparisonColor = '#059669';
                    } else {
                      breadthComparison = `≈ Similar`;
                      comparisonColor = '#F59E0B';
                    }
                  }
                } else if (!detail.isETF && detail.totalDips === 0) {
                  breadthComparison = '—';
                  comparisonColor = '#6B7280';
                } else {
                  // ETF: no benchmark comparison needed (ETFs ARE the benchmark)
                  breadthComparison = '—';
                  comparisonColor = '#6B7280';
                }
                
                // Check if we need separators and headers
                const prevDetail = index > 0 ? metrics.tickerDetails[index - 1] : null;
                // Only show recovered/no dips separator for individual stocks (not ETFs)
                const showOngoingHistoricalSeparator = index > 0 && prevDetail && !detail.isETF && !prevDetail.isETF && prevDetail.hasOngoingDip && !detail.hasOngoingDip;
                const showETFStockSeparator = index > 0 && prevDetail && prevDetail.isETF && !detail.isETF;
                const showETFHeader = index === 0 && detail.isETF;
                
                return (
                  <React.Fragment key={`${detail.ticker}-${index}`}>
                    {showETFHeader && (
                      <tr style={{ height: '20px', background: '#1E40AF' }}>
                        <td colSpan={10} style={{ padding: '5px 0', height: '20px', background: '#1E40AF' }}>
                          <div style={{ 
                            textAlign: 'center', 
                            color: 'white', 
                            fontSize: '12px', 
                            fontWeight: '700',
                            letterSpacing: '0.5px'
                          }}>
                            SECTOR ETFs (BENCHMARKS)
                          </div>
                        </td>
                      </tr>
                    )}
                    {showOngoingHistoricalSeparator && (
                      <tr style={{ height: '20px', background: '#374151' }}>
                        <td colSpan={10} style={{ padding: '5px 0', height: '20px', background: '#374151' }}>
                          <div style={{ 
                            textAlign: 'center', 
                            color: 'white', 
                            fontSize: '12px', 
                            fontWeight: '700',
                            letterSpacing: '0.5px'
                          }}>
                            ↓ RECOVERED / NO DIPS ↓
                          </div>
                        </td>
                      </tr>
                    )}
                    {showETFStockSeparator && (
                      <tr style={{ height: '20px', background: '#1E3A8A' }}>
                        <td colSpan={10} style={{ padding: '5px 0', height: '20px', background: '#1E3A8A' }}>
                          <div style={{ 
                            textAlign: 'center', 
                            color: 'white', 
                            fontSize: '12px', 
                            fontWeight: '700',
                            letterSpacing: '0.5px'
                          }}>
                            ── INDIVIDUAL STOCKS ──
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr 
                      style={{
                        borderBottom: '1px solid #F3F4F6',
                        background: detail.isETF 
                          ? '#EFF6FF'  // Light blue for ETFs
                          : detail.hasOngoingDip 
                            ? '#FEF2F2'  // Light red for ongoing dips
                            : (detail.totalDips > 0 ? '#FEF9C3' : 'white')  // Light yellow for recovered, white for no dips
                      }}
                    >
                    <td style={{ padding: isMobile ? '6px' : '10px', color: '#6B7280', fontWeight: '500' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: isMobile ? '6px' : '10px', fontWeight: '600', color: '#1F2937', fontFamily: 'monospace', fontSize: isMobile ? '12px' : 'inherit' }}>
                      {detail.ticker}
                    </td>
                    {!isMobile && <td style={{ padding: '10px', color: '#4B5563', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {detail.companyName}
                    </td>}
                    <td style={{ padding: isMobile ? '6px' : '10px', textAlign: 'right' }}>
                      {detail.isETF ? (
                        <span style={{ color: '#9CA3AF' }}>—</span>
                      ) : detail.hasOngoingDip ? (
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '4px', 
                          background: '#FEE2E2', 
                          color: '#991B1B',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          📉 ONGOING
                        </span>
                      ) : detail.totalDips > 0 ? (
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '4px', 
                          background: '#FEF9C3', 
                          color: '#854D0E',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          📜 RECOVERED
                        </span>
                      ) : (
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '4px', 
                          background: '#D1FAE5', 
                          color: '#065F46',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          ✅ NO DIP
                        </span>
                      )}
                    </td>
                    {!isMobile && <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: detail.isETF ? '#9CA3AF' : '#374151' }}>
                      {detail.isETF ? '—' : detail.totalDips}
                    </td>}
                    <td style={{
                      padding: isMobile ? '6px' : '10px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: detail.avgDipDepth > 0.15 ? '#DC2626' : detail.avgDipDepth > 0.08 ? '#F59E0B' : '#059669',
                      fontSize: isMobile ? '11px' : 'inherit'
                    }}>
                      {detail.avgDipDepth > 0 ? `${(detail.avgDipDepth * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{
                      padding: isMobile ? '6px' : '10px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: detail.maxDipDepth > 0.20 ? '#DC2626' : detail.maxDipDepth > 0.10 ? '#F59E0B' : '#059669',
                      fontSize: isMobile ? '11px' : 'inherit'
                    }}>
                      {detail.maxDipDepth > 0 ? `${(detail.maxDipDepth * 100).toFixed(1)}%` : '—'}
                    </td>
                    {!isMobile && <td style={{
                      padding: '10px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: detail.dipScore > 10 ? '#DC2626' : detail.dipScore > 5 ? '#F59E0B' : '#059669'
                    }}>
                      {detail.dipScore > 0 ? detail.dipScore.toFixed(1) : '—'}
                    </td>}
                    {!isMobile && <td style={{ padding: '10px', textAlign: 'right', color: '#6B7280' }}>
                      {detail.totalDipDays > 0 ? detail.totalDipDays : '—'}
                    </td>}
                    {!isMobile && <td style={{
                      padding: '10px',
                      textAlign: 'right',
                      fontSize: '12px',
                      color: comparisonColor,
                      fontWeight: '500'
                    }}>
                      {breadthComparison}
                    </td>}
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div style={{
          padding: '10px 15px',
          background: '#F9FAFB',
          borderTop: '1px solid #E5E7EB',
          fontSize: '12px',
          color: '#6B7280',
          lineHeight: '1.6'
        }}>
          💡 <strong>Legend:</strong> Shows aggregated dip metrics per ticker. 
          <strong>📊 = ETF</strong> (shown with light blue background at top of table). 
          <strong>Dip Score</strong> = (# of dips) × (avg depth) × (total days in dips / total days analyzed) × 100. Higher score = worse chronic weakness.
          <strong> vs Benchmark</strong> = compares stock's Dip Score to average ETF Dip Score. 
          "Stock-specific" = ETFs had no dips. 
          "X% worse/better" = stock's score is X% higher/lower than ETF average. 
          "Similar" = within ±20% of ETF average. | 
          <strong>Thick line</strong> separates ongoing from recovered dips. <strong>Thin line</strong> separates ETFs from stocks.
        </div>
      </div>
    </div>
  );
};

const MetricItem: React.FC<{ label: string; value: string; icon: string }> = ({ label, value, icon }) => (
  <div>
    <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '3px', fontWeight: '600' }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>
      {value}
    </div>
  </div>
);
