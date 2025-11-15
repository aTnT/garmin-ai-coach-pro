/**
 * Historical Trends Analysis
 *
 * Analyzes and prepares historical data for visualization of training trends,
 * performance changes, and long-term patterns.
 */

import { startOfWeek, startOfDay, subDays, subWeeks, differenceInDays } from 'date-fns';

export interface TrendDataPoint {
  date: Date;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface TrendSeries {
  name: string;
  data: TrendDataPoint[];
  color?: string;
  unit?: string;
}

export interface TrendAnalysis {
  series: TrendSeries[];
  period: {
    start: Date;
    end: Date;
  };
  statistics: {
    mean: number;
    min: number;
    max: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number; // % change from start to end
  };
  insights: string[];
}

export interface MetricDataPoint {
  date: Date;
  type: string;
  value: number;
  unit?: string | null;
}

/**
 * Aggregate time period for trend analysis
 */
export type AggregationPeriod = 'daily' | 'weekly' | 'monthly';

/**
 * Calculate rolling average for smoothing trend data
 */
export function calculateRollingAverage(
  data: TrendDataPoint[],
  windowSize: number = 7
): TrendDataPoint[] {
  if (data.length === 0) return [];

  const result: TrendDataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const sum = window.reduce((acc, point) => acc + point.value, 0);
    const avg = sum / window.length;

    result.push({
      date: data[i].date,
      value: Math.round(avg * 10) / 10, // Round to 1 decimal
      label: data[i].label,
    });
  }

  return result;
}

/**
 * Aggregate data by time period (daily, weekly, monthly)
 */
export function aggregateByPeriod(
  data: TrendDataPoint[],
  period: AggregationPeriod
): TrendDataPoint[] {
  if (data.length === 0) return [];

  const aggregated = new Map<string, { sum: number; count: number; date: Date }>();

  for (const point of data) {
    let key: string;
    let periodStart: Date;

    switch (period) {
      case 'daily':
        periodStart = startOfDay(point.date);
        key = periodStart.toISOString().split('T')[0];
        break;
      case 'weekly':
        periodStart = startOfWeek(point.date);
        key = periodStart.toISOString().split('T')[0];
        break;
      case 'monthly':
        periodStart = new Date(point.date.getFullYear(), point.date.getMonth(), 1);
        key = `${periodStart.getFullYear()}-${periodStart.getMonth() + 1}`;
        break;
    }

    if (!aggregated.has(key)) {
      aggregated.set(key, { sum: 0, count: 0, date: periodStart });
    }

    const entry = aggregated.get(key)!;
    entry.sum += point.value;
    entry.count += 1;
  }

  return Array.from(aggregated.values())
    .map(({ sum, count, date }) => ({
      date,
      value: Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Analyze readiness score trends over time
 */
export function analyzeReadinessTrend(
  readinessData: Array<{ date: Date; score: number; level: string }>
): TrendAnalysis {
  const data: TrendDataPoint[] = readinessData.map((r) => ({
    date: r.date,
    value: r.score,
    label: r.level,
  }));

  return analyzeTrend(data, 'Readiness Score', 0, 100);
}

/**
 * Analyze training load trends (ACWR - Acute:Chronic Workload Ratio)
 */
export function analyzeTrainingLoadTrend(
  loads: Array<{ date: Date; load: number }>
): TrendAnalysis {
  const data: TrendDataPoint[] = loads.map((l) => ({
    date: l.date,
    value: l.load,
  }));

  // Calculate ACWR (7-day acute / 28-day chronic)
  const acwrData: TrendDataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    const currentDate = data[i].date;
    const last7Days = data.filter(
      (d) =>
        differenceInDays(currentDate, d.date) >= 0 &&
        differenceInDays(currentDate, d.date) < 7
    );
    const last28Days = data.filter(
      (d) =>
        differenceInDays(currentDate, d.date) >= 0 &&
        differenceInDays(currentDate, d.date) < 28
    );

    if (last7Days.length > 0 && last28Days.length > 0) {
      const acuteLoad = last7Days.reduce((sum, d) => sum + d.value, 0) / 7;
      const chronicLoad = last28Days.reduce((sum, d) => sum + d.value, 0) / 28;
      const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

      acwrData.push({
        date: currentDate,
        value: acwr,
        metadata: { acuteLoad, chronicLoad },
      });
    }
  }

  const insights: string[] = [];
  const latestACWR = acwrData.length > 0 ? acwrData[acwrData.length - 1].value : 0;

  if (latestACWR > 1.3) {
    insights.push('High acute load - increased injury risk. Consider recovery.');
  } else if (latestACWR < 0.8) {
    insights.push('Low acute load - may be under-training or detraining.');
  } else {
    insights.push('Training load ratio in optimal range (0.8-1.3).');
  }

  return {
    series: [
      {
        name: 'Training Load',
        data,
      },
      {
        name: 'ACWR (Acute:Chronic Ratio)',
        data: acwrData,
      },
    ],
    period: {
      start: data[0]?.date || new Date(),
      end: data[data.length - 1]?.date || new Date(),
    },
    statistics: calculateStatistics(data),
    insights,
  };
}

/**
 * Analyze HRV (Heart Rate Variability) trends
 */
export function analyzeHRVTrend(
  hrvData: Array<{ date: Date; hrv: number }>
): TrendAnalysis {
  const data: TrendDataPoint[] = hrvData.map((h) => ({
    date: h.date,
    value: h.hrv,
  }));

  const smoothed = calculateRollingAverage(data, 7);
  const stats = calculateStatistics(data);
  const insights: string[] = [];

  // Check for declining HRV
  if (stats.trend === 'decreasing' && Math.abs(stats.changePercent) > 10) {
    insights.push('HRV declining - may indicate fatigue or overtraining.');
  } else if (stats.trend === 'increasing') {
    insights.push('HRV improving - good recovery and adaptation.');
  }

  // Check recent variability
  const recentData = data.slice(-7);
  if (recentData.length > 0) {
    const recentStdDev = calculateStandardDeviation(recentData.map((d) => d.value));
    if (recentStdDev > stats.mean * 0.2) {
      insights.push('High HRV variability - inconsistent recovery patterns.');
    }
  }

  return {
    series: [
      {
        name: 'HRV',
        data,
        unit: 'ms',
      },
      {
        name: 'HRV (7-day avg)',
        data: smoothed,
        color: '#3b82f6',
      },
    ],
    period: {
      start: data[0]?.date || new Date(),
      end: data[data.length - 1]?.date || new Date(),
    },
    statistics: stats,
    insights,
  };
}

/**
 * Analyze performance metrics trends (power, pace, etc.)
 */
export function analyzePerformanceTrend(
  performances: Array<{
    date: Date;
    duration: number; // seconds
    value: number; // power (W) or pace (min/km)
  }>,
  metricName: string,
  unit: string
): TrendAnalysis {
  // Group by duration for meaningful comparisons
  const durationGroups = new Map<number, TrendDataPoint[]>();

  for (const perf of performances) {
    if (!durationGroups.has(perf.duration)) {
      durationGroups.set(perf.duration, []);
    }
    durationGroups.get(perf.duration)!.push({
      date: perf.date,
      value: perf.value,
    });
  }

  // Create series for each duration
  const series: TrendSeries[] = [];
  for (const [duration, points] of durationGroups) {
    const durationLabel = formatDuration(duration);
    series.push({
      name: `${metricName} (${durationLabel})`,
      data: points.sort((a, b) => a.date.getTime() - b.date.getTime()),
      unit,
    });
  }

  // Overall statistics from all data
  const allData = performances.map((p) => ({
    date: p.date,
    value: p.value,
  }));

  const stats = calculateStatistics(allData);
  const insights: string[] = [];

  if (stats.trend === 'increasing') {
    insights.push(`${metricName} improving over time`);
  } else if (stats.trend === 'decreasing') {
    insights.push(`${metricName} declining - review training approach`);
  }

  return {
    series,
    period: {
      start: allData[0]?.date || new Date(),
      end: allData[allData.length - 1]?.date || new Date(),
    },
    statistics: stats,
    insights,
  };
}

/**
 * Analyze training volume trends (distance, time)
 */
export function analyzeVolumeTrend(
  activities: Array<{
    date: Date;
    duration: number; // minutes
    distance?: number; // km
  }>,
  aggregation: AggregationPeriod = 'weekly'
): TrendAnalysis {
  // Aggregate by period
  const durationData = aggregateByPeriod(
    activities.map((a) => ({ date: a.date, value: a.duration })),
    aggregation
  );

  const distanceData = aggregateByPeriod(
    activities
      .filter((a) => a.distance !== undefined)
      .map((a) => ({ date: a.date, value: a.distance! })),
    aggregation
  );

  const series: TrendSeries[] = [
    {
      name: 'Training Time',
      data: durationData,
      unit: 'minutes',
    },
  ];

  if (distanceData.length > 0) {
    series.push({
      name: 'Training Distance',
      data: distanceData,
      unit: 'km',
    });
  }

  const stats = calculateStatistics(durationData);
  const insights: string[] = [];

  // Volume progression advice
  const weeklyChange = stats.changePercent;
  if (weeklyChange > 10 && aggregation === 'weekly') {
    insights.push('Volume increasing rapidly - watch for injury risk (10% rule)');
  } else if (weeklyChange < -20) {
    insights.push('Significant volume decrease - deload or recovery phase?');
  }

  return {
    series,
    period: {
      start: durationData[0]?.date || new Date(),
      end: durationData[durationData.length - 1]?.date || new Date(),
    },
    statistics: stats,
    insights,
  };
}

/**
 * Generic trend analysis with statistics
 */
function analyzeTrend(
  data: TrendDataPoint[],
  name: string,
  minValue?: number,
  maxValue?: number
): TrendAnalysis {
  const stats = calculateStatistics(data);
  const insights: string[] = [];

  // Trend analysis
  if (stats.trend === 'increasing') {
    insights.push(`${name} is trending upward`);
  } else if (stats.trend === 'decreasing') {
    insights.push(`${name} is trending downward`);
  } else {
    insights.push(`${name} is stable`);
  }

  // Range check
  if (minValue !== undefined && stats.mean < minValue) {
    insights.push(`Average ${name} below minimum threshold`);
  }
  if (maxValue !== undefined && stats.mean > maxValue) {
    insights.push(`Average ${name} above maximum threshold`);
  }

  return {
    series: [{ name, data }],
    period: {
      start: data[0]?.date || new Date(),
      end: data[data.length - 1]?.date || new Date(),
    },
    statistics: stats,
    insights,
  };
}

/**
 * Calculate statistics for trend data
 */
function calculateStatistics(data: TrendDataPoint[]): {
  mean: number;
  min: number;
  max: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
} {
  if (data.length === 0) {
    return {
      mean: 0,
      min: 0,
      max: 0,
      trend: 'stable',
      changePercent: 0,
    };
  }

  const values = data.map((d) => d.value);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Calculate trend using linear regression slope
  const trend = calculateTrend(data);

  // Calculate percentage change from start to end
  const firstValue = data[0].value;
  const lastValue = data[data.length - 1].value;
  const changePercent =
    firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  return {
    mean: Math.round(mean * 10) / 10,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    trend,
    changePercent: Math.round(changePercent * 10) / 10,
  };
}

/**
 * Calculate trend direction using linear regression
 */
function calculateTrend(
  data: TrendDataPoint[]
): 'increasing' | 'decreasing' | 'stable' {
  if (data.length < 2) return 'stable';

  // Simple linear regression to find slope
  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  data.forEach((point, index) => {
    const x = index;
    const y = point.value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Determine trend based on slope
  const slopeThreshold = 0.01; // Minimum slope to consider as trend
  if (Math.abs(slope) < slopeThreshold) return 'stable';
  return slope > 0 ? 'increasing' : 'decreasing';
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Format duration for display
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  return `${Math.floor(seconds / 3600)}h`;
}
