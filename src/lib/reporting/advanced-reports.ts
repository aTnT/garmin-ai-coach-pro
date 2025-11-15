/**
 * Advanced Reporting System
 *
 * Unified reports combining all analysis modules:
 * - Power curve analysis
 * - Historical trends
 * - Readiness tracking
 * - Training load analysis (ACWR)
 * - Performance progression
 *
 * Supports JSON/CSV export (NO PDF as per requirements)
 */

import { calculatePowerCurve, estimateFTP, calculatePowerZones, type PowerCurve } from '../analysis/power-curve';
import {
  analyzeTrainingLoadTrend,
  analyzeHRVTrend,
  analyzePerformanceTrend,
  analyzeVolumeTrend,
  type TrendAnalysis,
} from '../analysis/trends';
import { calculateReadinessScore, type ReadinessScore, type HealthMetric } from '../calculations/readiness';
import { Sport } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface ReportingMetric {
  date: Date;
  type: string;
  value: number;
  unit?: string;
}

export interface ReportingActivity {
  id: string;
  date: Date;
  sport: Sport;
  duration: number;
  distance?: number;
  avgPower?: number;
  avgHR?: number;
  tss?: number;
  powerData?: Array<{ timestamp: Date; power: number }>;
}

export interface UnifiedTrainingReport {
  generatedAt: Date;
  period: { start: Date; end: Date };

  // Performance Overview
  performance: {
    powerCurve?: PowerCurve;
    ftp?: number;
    powerZones?: ReturnType<typeof calculatePowerZones>;
    ftpTrend?: TrendAnalysis;
  };

  // Physiological Overview
  physiology: {
    currentReadiness?: ReadinessScore;
    hrvTrend?: TrendAnalysis;
    restingHRTrend?: TrendAnalysis;
  };

  // Training Load Overview
  trainingLoad: {
    loadTrend?: TrendAnalysis;
    volumeTrend?: TrendAnalysis;
    currentACWR?: number;
    injuryRisk?: 'low' | 'moderate' | 'high';
  };

  // Activity Summary
  activitySummary: {
    totalActivities: number;
    totalDuration: number;
    totalDistance: number;
    sportBreakdown: Record<string, { count: number; duration: number; distance: number }>;
  };

  // Key Insights
  insights: string[];
  recommendations: string[];
}

export interface PerformanceProgressionReport {
  generatedAt: Date;
  period: { start: Date; end: Date };

  // Power progression
  powerMetrics: {
    currentFTP?: number;
    previousFTP?: number;
    ftpChange?: number;
    ftpChangePercent?: number;
    powerCurveComparison?: {
      current: PowerCurve;
      previous: PowerCurve;
      improvements: Array<{ duration: number; improvement: number; improvementPercent: number }>;
    };
  };

  // Volume progression
  volumeMetrics: {
    currentWeeklyVolume: number;
    previousWeeklyVolume: number;
    volumeChange: number;
    volumeChangePercent: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };

  // Consistency metrics
  consistency: {
    activeDays: number;
    totalDays: number;
    consistencyPercent: number;
    longestStreak: number;
  };

  insights: string[];
}

export interface ReadinessHistoryReport {
  generatedAt: Date;
  period: { start: Date; end: Date };

  // Daily readiness scores
  dailyScores: Array<{
    date: Date;
    score: number;
    level: 'low' | 'moderate' | 'good' | 'excellent';
    confidence: number;
  }>;

  // Aggregated metrics
  averageScore: number;
  trendDirection: 'improving' | 'stable' | 'declining';

  // Factor breakdown
  factorAnalysis: {
    hrv: { average: number; trend: 'improving' | 'stable' | 'declining' };
    trainingLoad: { average: number; trend: 'improving' | 'stable' | 'declining' };
    sleep: { average: number; trend: 'improving' | 'stable' | 'declining' };
    stress: { average: number; trend: 'improving' | 'stable' | 'declining' };
  };

  // Recovery recommendations
  recommendations: string[];
}

// ============================================================================
// UNIFIED TRAINING REPORT
// ============================================================================

export async function generateUnifiedReport(
  activities: ReportingActivity[],
  metrics: ReportingMetric[],
  period: { start: Date; end: Date }
): Promise<UnifiedTrainingReport> {
  const insights: string[] = [];
  const recommendations: string[] = [];

  // Filter data to period
  const periodActivities = activities.filter(
    (a) => a.date >= period.start && a.date <= period.end
  );
  const periodMetrics = metrics.filter(
    (m) => m.date >= period.start && m.date <= period.end
  );

  // ========== Performance Analysis ==========
  const cyclingActivities = periodActivities
    .filter((a) => a.sport === 'CYCLING' && a.powerData && a.powerData.length > 0)
    .map((a) => ({
      id: a.id,
      date: a.date,
      powerData: a.powerData!.map((p) => ({ timestamp: p.timestamp, power: p.power })),
      sport: 'CYCLING' as const,
    }));

  const powerCurve = cyclingActivities.length > 0 ? calculatePowerCurve(cyclingActivities) : undefined;
  const ftp = powerCurve ? estimateFTP(powerCurve) : undefined;
  const powerZones = ftp ? calculatePowerZones(ftp) : undefined;

  // FTP trend analysis
  const ftpMetrics = periodMetrics.filter((m) => m.type === 'FTP');
  const ftpTrend = ftpMetrics.length > 0
    ? analyzePerformanceTrend([{ duration: 1200, performances: ftpMetrics.map((m) => ({ date: m.date, value: m.value })) }])
    : undefined;

  if (ftp && ftpTrend) {
    if (ftpTrend.direction === 'increasing') {
      insights.push(`Your FTP is improving! Current: ${ftp}W, Trend: ${ftpTrend.direction}`);
    } else if (ftpTrend.direction === 'decreasing') {
      insights.push(`Your FTP is declining. Current: ${ftp}W - consider reviewing training load and recovery`);
      recommendations.push('Focus on recovery and reassess training intensity');
    }
  }

  // ========== Physiological Analysis ==========
  const hrvMetrics = periodMetrics.filter((m) => m.type === 'HRV').map((m) => ({ date: m.date, hrv: m.value }));
  const hrvTrend = hrvMetrics.length > 0 ? analyzeHRVTrend(hrvMetrics) : undefined;

  const restingHRMetrics = periodMetrics.filter((m) => m.type === 'RESTING_HR').map((m) => ({ date: m.date, hr: m.value }));
  const restingHRTrend = restingHRMetrics.length > 0
    ? analyzePerformanceTrend([{ duration: 0, performances: restingHRMetrics.map((m) => ({ date: m.date, value: m.value })) }])
    : undefined;

  // Current readiness (last 30 days of metrics)
  const recentMetrics: HealthMetric[] = metrics
    .filter((m) => {
      const daysAgo = (Date.now() - m.date.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 30;
    })
    .map((m) => ({
      date: m.date,
      type: m.type as any,
      value: m.value,
      unit: m.unit,
    }));

  const currentReadiness = recentMetrics.length > 0
    ? calculateReadinessScore(recentMetrics, periodActivities.slice(-30).map((a) => ({ date: a.date, tss: a.tss || 0 })))
    : undefined;

  if (hrvTrend) {
    if (hrvTrend.direction === 'decreasing' && hrvTrend.insights.some((i) => i.includes('declining'))) {
      insights.push('HRV is declining - you may be accumulating fatigue');
      recommendations.push('Prioritize sleep and recovery activities');
    }
  }

  // ========== Training Load Analysis ==========
  const loadMetrics = periodMetrics.filter((m) => m.type === 'TRAINING_LOAD' || m.type === 'TSS');
  const loadTrend = loadMetrics.length > 0
    ? analyzeTrainingLoadTrend(loadMetrics.map((m) => ({ date: m.date, load: m.value })))
    : undefined;

  const volumeMetrics = periodActivities.map((a) => ({ date: a.date, duration: a.duration }));
  const volumeTrend = volumeMetrics.length > 0 ? analyzeVolumeTrend(volumeMetrics) : undefined;

  let currentACWR: number | undefined;
  let injuryRisk: 'low' | 'moderate' | 'high' | undefined;

  if (loadTrend) {
    // Extract ACWR from trend data
    const acwrMatch = loadTrend.insights.find((i) => i.includes('ACWR'));
    if (acwrMatch) {
      const acwrValue = parseFloat(acwrMatch.match(/[\d.]+/)?.[0] || '0');
      currentACWR = acwrValue;

      if (acwrValue > 1.3) {
        injuryRisk = 'high';
        insights.push('High acute training load detected - increased injury risk');
        recommendations.push('Consider a recovery week to reduce injury risk');
      } else if (acwrValue > 1.2) {
        injuryRisk = 'moderate';
        insights.push('Training load is building appropriately');
      } else {
        injuryRisk = 'low';
      }
    }
  }

  if (volumeTrend && volumeTrend.insights.some((i) => i.includes('10% rule'))) {
    insights.push('Volume increasing too rapidly - injury risk elevated');
    recommendations.push('Limit weekly volume increases to 10%');
  }

  // ========== Activity Summary ==========
  const sportBreakdown: Record<string, { count: number; duration: number; distance: number }> = {};

  periodActivities.forEach((a) => {
    if (!sportBreakdown[a.sport]) {
      sportBreakdown[a.sport] = { count: 0, duration: 0, distance: 0 };
    }
    sportBreakdown[a.sport].count++;
    sportBreakdown[a.sport].duration += a.duration;
    sportBreakdown[a.sport].distance += a.distance || 0;
  });

  const totalDuration = periodActivities.reduce((sum, a) => sum + a.duration, 0);
  const totalDistance = periodActivities.reduce((sum, a) => sum + (a.distance || 0), 0);

  // ========== Compile Report ==========
  return {
    generatedAt: new Date(),
    period,
    performance: {
      powerCurve,
      ftp,
      powerZones,
      ftpTrend,
    },
    physiology: {
      currentReadiness,
      hrvTrend,
      restingHRTrend,
    },
    trainingLoad: {
      loadTrend,
      volumeTrend,
      currentACWR,
      injuryRisk,
    },
    activitySummary: {
      totalActivities: periodActivities.length,
      totalDuration,
      totalDistance,
      sportBreakdown,
    },
    insights,
    recommendations,
  };
}

// ============================================================================
// PERFORMANCE PROGRESSION REPORT
// ============================================================================

export async function generateProgressionReport(
  activities: ReportingActivity[],
  metrics: ReportingMetric[],
  currentPeriod: { start: Date; end: Date },
  comparisonPeriod: { start: Date; end: Date }
): Promise<PerformanceProgressionReport> {
  const insights: string[] = [];

  // Current period data
  const currentActivities = activities.filter(
    (a) => a.date >= currentPeriod.start && a.date <= currentPeriod.end
  );
  const currentMetrics = metrics.filter(
    (m) => m.date >= currentPeriod.start && m.date <= currentPeriod.end
  );

  // Comparison period data
  const previousActivities = activities.filter(
    (a) => a.date >= comparisonPeriod.start && a.date <= comparisonPeriod.end
  );
  const previousMetrics = metrics.filter(
    (m) => m.date >= comparisonPeriod.start && m.date <= comparisonPeriod.end
  );

  // ========== Power Metrics ==========
  const currentCyclingActivities = currentActivities
    .filter((a) => a.sport === 'CYCLING' && a.powerData)
    .map((a) => ({
      id: a.id,
      date: a.date,
      powerData: a.powerData!.map((p) => ({ timestamp: p.timestamp, power: p.power })),
      sport: 'CYCLING' as const,
    }));

  const previousCyclingActivities = previousActivities
    .filter((a) => a.sport === 'CYCLING' && a.powerData)
    .map((a) => ({
      id: a.id,
      date: a.date,
      powerData: a.powerData!.map((p) => ({ timestamp: p.timestamp, power: p.power })),
      sport: 'CYCLING' as const,
    }));

  const currentPowerCurve = currentCyclingActivities.length > 0 ? calculatePowerCurve(currentCyclingActivities) : undefined;
  const previousPowerCurve = previousCyclingActivities.length > 0 ? calculatePowerCurve(previousCyclingActivities) : undefined;

  const currentFTP = currentPowerCurve ? estimateFTP(currentPowerCurve) : undefined;
  const previousFTP = previousPowerCurve ? estimateFTP(previousPowerCurve) : undefined;

  let ftpChange: number | undefined;
  let ftpChangePercent: number | undefined;

  if (currentFTP && previousFTP) {
    ftpChange = currentFTP - previousFTP;
    ftpChangePercent = (ftpChange / previousFTP) * 100;

    if (ftpChangePercent > 5) {
      insights.push(`Excellent FTP improvement: +${ftpChange}W (+${ftpChangePercent.toFixed(1)}%)`);
    } else if (ftpChangePercent < -5) {
      insights.push(`FTP declined: ${ftpChange}W (${ftpChangePercent.toFixed(1)}%) - review training and recovery`);
    }
  }

  // Power curve comparison
  let powerCurveComparison;
  if (currentPowerCurve && previousPowerCurve) {
    const improvements = currentPowerCurve.points
      .map((currentPoint) => {
        const previousPoint = previousPowerCurve.points.find((p) => p.duration === currentPoint.duration);
        if (!previousPoint) return null;

        const improvement = currentPoint.power - previousPoint.power;
        const improvementPercent = (improvement / previousPoint.power) * 100;

        return {
          duration: currentPoint.duration,
          improvement,
          improvementPercent,
        };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    powerCurveComparison = {
      current: currentPowerCurve,
      previous: previousPowerCurve,
      improvements,
    };

    const significantImprovements = improvements.filter((i) => i.improvementPercent > 5);
    if (significantImprovements.length > 0) {
      insights.push(`Improved power at ${significantImprovements.length} duration(s)`);
    }
  }

  // ========== Volume Metrics ==========
  const currentWeeklyVolume = currentActivities.reduce((sum, a) => sum + a.duration, 0) /
    ((currentPeriod.end.getTime() - currentPeriod.start.getTime()) / (1000 * 60 * 60 * 24 * 7));

  const previousWeeklyVolume = previousActivities.reduce((sum, a) => sum + a.duration, 0) /
    ((comparisonPeriod.end.getTime() - comparisonPeriod.start.getTime()) / (1000 * 60 * 60 * 24 * 7));

  const volumeChange = currentWeeklyVolume - previousWeeklyVolume;
  const volumeChangePercent = previousWeeklyVolume > 0 ? (volumeChange / previousWeeklyVolume) * 100 : 0;

  let volumeTrend: 'increasing' | 'stable' | 'decreasing';
  if (volumeChangePercent > 5) {
    volumeTrend = 'increasing';
    insights.push(`Training volume increased by ${volumeChangePercent.toFixed(1)}%`);
  } else if (volumeChangePercent < -5) {
    volumeTrend = 'decreasing';
    insights.push(`Training volume decreased by ${Math.abs(volumeChangePercent).toFixed(1)}%`);
  } else {
    volumeTrend = 'stable';
  }

  // ========== Consistency Metrics ==========
  const allDates = new Set<string>();
  const activeDates = new Set<string>();

  const start = new Date(currentPeriod.start);
  const end = new Date(currentPeriod.end);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDates.add(d.toISOString().split('T')[0]);
  }

  currentActivities.forEach((a) => {
    activeDates.add(a.date.toISOString().split('T')[0]);
  });

  const consistencyPercent = (activeDates.size / allDates.size) * 100;

  // Calculate longest streak
  const sortedActivities = [...currentActivities].sort((a, b) => a.date.getTime() - b.date.getTime());
  let longestStreak = 0;
  let currentStreak = 0;
  let lastDate: Date | null = null;

  sortedActivities.forEach((a) => {
    if (!lastDate || (a.date.getTime() - lastDate.getTime()) <= 1000 * 60 * 60 * 24 * 2) {
      currentStreak++;
    } else {
      longestStreak = Math.max(longestStreak, currentStreak);
      currentStreak = 1;
    }
    lastDate = a.date;
  });
  longestStreak = Math.max(longestStreak, currentStreak);

  if (consistencyPercent > 80) {
    insights.push(`Excellent consistency: ${consistencyPercent.toFixed(0)}% of days active`);
  } else if (consistencyPercent < 50) {
    insights.push(`Low consistency: ${consistencyPercent.toFixed(0)}% of days active - aim for more regular training`);
  }

  // ========== Compile Report ==========
  return {
    generatedAt: new Date(),
    period: currentPeriod,
    powerMetrics: {
      currentFTP,
      previousFTP,
      ftpChange,
      ftpChangePercent,
      powerCurveComparison,
    },
    volumeMetrics: {
      currentWeeklyVolume,
      previousWeeklyVolume,
      volumeChange,
      volumeChangePercent,
      trend: volumeTrend,
    },
    consistency: {
      activeDays: activeDates.size,
      totalDays: allDates.size,
      consistencyPercent,
      longestStreak,
    },
    insights,
  };
}

// ============================================================================
// READINESS HISTORY REPORT
// ============================================================================

export async function generateReadinessReport(
  metrics: ReportingMetric[],
  activities: ReportingActivity[],
  period: { start: Date; end: Date }
): Promise<ReadinessHistoryReport> {
  const recommendations: string[] = [];

  // Generate daily readiness scores for the period
  const dailyScores: ReadinessHistoryReport['dailyScores'] = [];

  const start = new Date(period.start);
  const end = new Date(period.end);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const currentDate = new Date(date);

    // Get metrics up to this date (last 30 days)
    const relevantMetrics = metrics
      .filter((m) => {
        const daysAgo = (currentDate.getTime() - m.date.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo >= 0 && daysAgo <= 30;
      })
      .map((m) => ({
        date: m.date,
        type: m.type as any,
        value: m.value,
        unit: m.unit,
      }));

    const relevantActivities = activities
      .filter((a) => {
        const daysAgo = (currentDate.getTime() - a.date.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo >= 0 && daysAgo <= 30;
      })
      .map((a) => ({ date: a.date, tss: a.tss || 0 }));

    if (relevantMetrics.length > 0) {
      const readiness = calculateReadinessScore(relevantMetrics, relevantActivities);

      dailyScores.push({
        date: currentDate,
        score: readiness.score,
        level: readiness.level,
        confidence: readiness.confidence,
      });
    }
  }

  // Calculate average score
  const averageScore = dailyScores.length > 0
    ? dailyScores.reduce((sum, s) => sum + s.score, 0) / dailyScores.length
    : 0;

  // Determine trend direction
  let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';

  if (dailyScores.length >= 7) {
    const recentScores = dailyScores.slice(-7);
    const olderScores = dailyScores.slice(0, 7);

    const recentAvg = recentScores.reduce((sum, s) => sum + s.score, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((sum, s) => sum + s.score, 0) / olderScores.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 5) {
      trendDirection = 'improving';
    } else if (change < -5) {
      trendDirection = 'declining';
      recommendations.push('Readiness declining - prioritize recovery and sleep');
    }
  }

  // Factor analysis
  const hrvValues = metrics.filter((m) => m.type === 'HRV').map((m) => m.value);
  const loadValues = metrics.filter((m) => m.type === 'TRAINING_LOAD' || m.type === 'TSS').map((m) => m.value);
  const sleepValues = metrics.filter((m) => m.type === 'SLEEP_HOURS').map((m) => m.value);
  const stressValues = metrics.filter((m) => m.type === 'STRESS_LEVEL').map((m) => m.value);

  const avgHRV = hrvValues.length > 0 ? hrvValues.reduce((sum, v) => sum + v, 0) / hrvValues.length : 0;
  const avgLoad = loadValues.length > 0 ? loadValues.reduce((sum, v) => sum + v, 0) / loadValues.length : 0;
  const avgSleep = sleepValues.length > 0 ? sleepValues.reduce((sum, v) => sum + v, 0) / sleepValues.length : 0;
  const avgStress = stressValues.length > 0 ? stressValues.reduce((sum, v) => sum + v, 0) / stressValues.length : 0;

  // Simple trend detection for factors
  const getFactorTrend = (values: number[]): 'improving' | 'stable' | 'declining' => {
    if (values.length < 7) return 'stable';

    const recent = values.slice(-7);
    const older = values.slice(0, 7);

    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  };

  const factorAnalysis = {
    hrv: { average: avgHRV, trend: getFactorTrend(hrvValues) },
    trainingLoad: { average: avgLoad, trend: getFactorTrend(loadValues) },
    sleep: { average: avgSleep, trend: getFactorTrend(sleepValues) },
    stress: { average: avgStress, trend: getFactorTrend(stressValues) },
  };

  // Add recommendations based on factors
  if (factorAnalysis.hrv.trend === 'declining') {
    recommendations.push('HRV declining - reduce training intensity and prioritize recovery');
  }

  if (avgSleep < 7) {
    recommendations.push('Average sleep below 7 hours - aim for 7-9 hours per night');
  }

  if (factorAnalysis.stress.average > 50) {
    recommendations.push('Stress levels elevated - consider stress management techniques');
  }

  return {
    generatedAt: new Date(),
    period,
    dailyScores,
    averageScore,
    trendDirection,
    factorAnalysis,
    recommendations,
  };
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

export function exportToJSON(report: UnifiedTrainingReport | PerformanceProgressionReport | ReadinessHistoryReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportToCSV(report: ReadinessHistoryReport): string {
  const headers = ['Date', 'Score', 'Level', 'Confidence'];
  const rows = report.dailyScores.map((score) => [
    score.date.toISOString().split('T')[0],
    score.score.toString(),
    score.level,
    score.confidence.toFixed(0),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function exportActivitiesToCSV(activities: ReportingActivity[]): string {
  const headers = ['Date', 'Sport', 'Duration (min)', 'Distance (km)', 'Avg HR', 'Avg Power', 'TSS'];
  const rows = activities.map((a) => [
    a.date.toISOString().split('T')[0],
    a.sport,
    a.duration.toString(),
    (a.distance || 0).toFixed(2),
    (a.avgHR || 0).toString(),
    (a.avgPower || 0).toString(),
    (a.tss || 0).toString(),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
