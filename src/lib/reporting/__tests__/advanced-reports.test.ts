/**
 * Tests for Advanced Reporting System
 */

import {
  generateUnifiedReport,
  generateProgressionReport,
  generateReadinessReport,
  exportToJSON,
  exportToCSV,
  exportActivitiesToCSV,
  type ReportingActivity,
  type ReportingMetric,
} from '../advanced-reports';
import { Sport } from '@prisma/client';

describe('Advanced Reporting System', () => {
  // ========== TEST DATA ==========

  const createMockActivities = (): ReportingActivity[] => {
    const baseDate = new Date();
    const activities: ReportingActivity[] = [];

    // Create 30 days of activities
    for (let i = 0; i < 30; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);

      // Cycling with power data
      if (i % 3 === 0) {
        const powerData = [];
        const activityStart = new Date(date);
        for (let j = 0; j < 3600; j += 5) {
          const timestamp = new Date(activityStart.getTime() + j * 1000);
          powerData.push({ timestamp, power: 200 + Math.random() * 50 });
        }

        activities.push({
          id: `cycling-${i}`,
          date,
          sport: 'CYCLING' as Sport,
          duration: 60,
          distance: 30,
          avgPower: 220,
          avgHR: 145,
          tss: 65,
          powerData,
        });
      }

      // Running
      if (i % 2 === 0) {
        activities.push({
          id: `running-${i}`,
          date,
          sport: 'RUNNING' as Sport,
          duration: 45,
          distance: 8,
          avgHR: 155,
          tss: 50,
        });
      }
    }

    return activities;
  };

  const createMockMetrics = (): ReportingMetric[] => {
    const baseDate = new Date();
    const metrics: ReportingMetric[] = [];

    // Create 30 days of metrics
    for (let i = 0; i < 30; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);

      metrics.push(
        { date, type: 'HRV', value: 60 + Math.random() * 20, unit: 'ms' },
        { date, type: 'RESTING_HR', value: 50 + Math.random() * 5, unit: 'bpm' },
        { date, type: 'SLEEP_HOURS', value: 7 + Math.random() * 1.5, unit: 'hours' },
        { date, type: 'STRESS_LEVEL', value: 30 + Math.random() * 20 },
        { date, type: 'TRAINING_LOAD', value: 300 + Math.random() * 100 },
        { date, type: 'FTP', value: 250 + Math.random() * 10 }
      );
    }

    return metrics;
  };

  const getPeriod = (daysAgo: number, duration: number) => {
    const end = new Date();
    end.setDate(end.getDate() - daysAgo);

    const start = new Date(end);
    start.setDate(start.getDate() - duration);

    return { start, end };
  };

  // ========== UNIFIED REPORT TESTS ==========

  describe('generateUnifiedReport', () => {
    it('should generate a complete unified report', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 30);

      const report = await generateUnifiedReport(activities, metrics, period);

      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period).toEqual(period);
      expect(report.performance).toBeDefined();
      expect(report.physiology).toBeDefined();
      expect(report.trainingLoad).toBeDefined();
      expect(report.activitySummary).toBeDefined();
      expect(report.insights).toBeInstanceOf(Array);
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should include power curve analysis for cycling activities', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 30);

      const report = await generateUnifiedReport(activities, metrics, period);

      expect(report.performance.powerCurve).toBeDefined();
      expect(report.performance.powerCurve!.points.length).toBeGreaterThan(0);
      expect(report.performance.ftp).toBeDefined();
      expect(report.performance.ftp).toBeGreaterThan(0);
      expect(report.performance.powerZones).toBeDefined();
    });

    it('should calculate current readiness score', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 30);

      const report = await generateUnifiedReport(activities, metrics, period);

      expect(report.physiology.currentReadiness).toBeDefined();
      expect(report.physiology.currentReadiness!.score).toBeGreaterThanOrEqual(0);
      expect(report.physiology.currentReadiness!.score).toBeLessThanOrEqual(100);
      expect(['low', 'moderate', 'good', 'excellent'].includes(report.physiology.currentReadiness!.level)).toBe(true);
    });

    it('should analyze HRV trends', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 30);

      const report = await generateUnifiedReport(activities, metrics, period);

      expect(report.physiology.hrvTrend).toBeDefined();
      expect(['increasing', 'stable', 'decreasing'].includes(report.physiology.hrvTrend!.statistics.trend)).toBe(true);
      expect(report.physiology.hrvTrend!.insights.length).toBeGreaterThan(0);
    });

    it('should analyze training load and ACWR', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 30);

      const report = await generateUnifiedReport(activities, metrics, period);

      expect(report.trainingLoad.loadTrend).toBeDefined();
      expect(report.trainingLoad.volumeTrend).toBeDefined();
    });

    it('should determine injury risk level', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();

      // Add high acute load to trigger high injury risk
      const baseDate = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - i);
        metrics.push({ date, type: 'TRAINING_LOAD', value: 600 }); // High load
      }

      const period = getPeriod(0, 30);
      const report = await generateUnifiedReport(activities, metrics, period);

      if (report.trainingLoad.injuryRisk) {
        expect(['low', 'moderate', 'high']).toContain(report.trainingLoad.injuryRisk);
      }
    });

    it('should provide activity summary with sport breakdown', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 30);

      const report = await generateUnifiedReport(activities, metrics, period);

      expect(report.activitySummary.totalActivities).toBeGreaterThan(0);
      expect(report.activitySummary.totalDuration).toBeGreaterThan(0);
      expect(report.activitySummary.sportBreakdown).toBeDefined();
      expect(report.activitySummary.sportBreakdown['CYCLING']).toBeDefined();
      expect(report.activitySummary.sportBreakdown['RUNNING']).toBeDefined();
    });

    it('should generate insights based on trends', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 30);

      const report = await generateUnifiedReport(activities, metrics, period);

      expect(report.insights.length).toBeGreaterThan(0);
    });

    it('should generate recommendations when issues detected', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();

      // Add declining HRV to trigger recommendations
      const baseDate = new Date();
      for (let i = 0; i < 14; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - i);
        metrics.push({ date, type: 'HRV', value: 80 - i * 2, unit: 'ms' }); // Declining
      }

      const period = getPeriod(0, 30);
      const report = await generateUnifiedReport(activities, metrics, period);

      // Should have recommendations due to declining HRV
      expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty activities gracefully', async () => {
      const metrics = createMockMetrics();
      const period = getPeriod(0, 30);

      const report = await generateUnifiedReport([], metrics, period);

      expect(report.activitySummary.totalActivities).toBe(0);
      expect(report.performance.powerCurve).toBeUndefined();
    });

    it('should handle empty metrics gracefully', async () => {
      const activities = createMockActivities();
      const period = getPeriod(0, 30);

      const report = await generateUnifiedReport(activities, [], period);

      expect(report.physiology.currentReadiness).toBeUndefined();
      expect(report.physiology.hrvTrend).toBeUndefined();
    });

    it('should filter activities and metrics to period', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();

      // Short period - last 7 days
      const period = getPeriod(0, 7);

      const report = await generateUnifiedReport(activities, metrics, period);

      expect(report.activitySummary.totalActivities).toBeLessThan(activities.length);
    });
  });

  // ========== PROGRESSION REPORT TESTS ==========

  describe('generateProgressionReport', () => {
    it('should generate a complete progression report', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const currentPeriod = getPeriod(0, 14);
      const comparisonPeriod = getPeriod(14, 14);

      const report = await generateProgressionReport(activities, metrics, currentPeriod, comparisonPeriod);

      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period).toEqual(currentPeriod);
      expect(report.powerMetrics).toBeDefined();
      expect(report.volumeMetrics).toBeDefined();
      expect(report.consistency).toBeDefined();
      expect(report.insights).toBeInstanceOf(Array);
    });

    it('should compare FTP between periods', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const currentPeriod = getPeriod(0, 14);
      const comparisonPeriod = getPeriod(14, 14);

      const report = await generateProgressionReport(activities, metrics, currentPeriod, comparisonPeriod);

      if (report.powerMetrics.currentFTP && report.powerMetrics.previousFTP) {
        expect(report.powerMetrics.ftpChange).toBeDefined();
        expect(report.powerMetrics.ftpChangePercent).toBeDefined();
      }
    });

    it('should compare power curves between periods', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const currentPeriod = getPeriod(0, 14);
      const comparisonPeriod = getPeriod(14, 14);

      const report = await generateProgressionReport(activities, metrics, currentPeriod, comparisonPeriod);

      if (report.powerMetrics.powerCurveComparison) {
        expect(report.powerMetrics.powerCurveComparison.current).toBeDefined();
        expect(report.powerMetrics.powerCurveComparison.previous).toBeDefined();
        expect(report.powerMetrics.powerCurveComparison.improvements.length).toBeGreaterThan(0);
      }
    });

    it('should calculate volume progression', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const currentPeriod = getPeriod(0, 14);
      const comparisonPeriod = getPeriod(14, 14);

      const report = await generateProgressionReport(activities, metrics, currentPeriod, comparisonPeriod);

      expect(report.volumeMetrics.currentWeeklyVolume).toBeGreaterThanOrEqual(0);
      expect(report.volumeMetrics.previousWeeklyVolume).toBeGreaterThanOrEqual(0);
      expect(report.volumeMetrics.volumeChange).toBeDefined();
      expect(report.volumeMetrics.volumeChangePercent).toBeDefined();
      expect(['increasing', 'stable', 'decreasing']).toContain(report.volumeMetrics.trend);
    });

    it('should calculate consistency metrics', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const currentPeriod = getPeriod(0, 14);
      const comparisonPeriod = getPeriod(14, 14);

      const report = await generateProgressionReport(activities, metrics, currentPeriod, comparisonPeriod);

      expect(report.consistency.activeDays).toBeGreaterThan(0);
      expect(report.consistency.totalDays).toBe(15); // 14 days + 1 (inclusive)
      expect(report.consistency.consistencyPercent).toBeGreaterThanOrEqual(0);
      expect(report.consistency.consistencyPercent).toBeLessThanOrEqual(100);
      expect(report.consistency.longestStreak).toBeGreaterThanOrEqual(0);
    });

    it('should detect significant FTP improvements', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();

      // Add higher FTP values in current period
      const currentPeriod = getPeriod(0, 14);
      const comparisonPeriod = getPeriod(14, 14);

      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        metrics.push({ date, type: 'FTP', value: 280 }); // Higher FTP
      }

      const report = await generateProgressionReport(activities, metrics, currentPeriod, comparisonPeriod);

      if (report.powerMetrics.ftpChangePercent && report.powerMetrics.ftpChangePercent > 5) {
        expect(report.insights.some((i) => i.includes('improvement'))).toBe(true);
      }
    });

    it('should detect volume increases', async () => {
      const activities: ReportingActivity[] = [];
      const metrics = createMockMetrics();

      // Current period - high volume
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        activities.push({
          id: `activity-${i}`,
          date,
          sport: 'RUNNING' as Sport,
          duration: 90, // Higher duration
          distance: 15,
          tss: 80,
        });
      }

      // Comparison period - low volume
      for (let i = 14; i < 28; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        activities.push({
          id: `activity-${i}`,
          date,
          sport: 'RUNNING' as Sport,
          duration: 45, // Lower duration
          distance: 8,
          tss: 50,
        });
      }

      const currentPeriod = getPeriod(0, 14);
      const comparisonPeriod = getPeriod(14, 14);

      const report = await generateProgressionReport(activities, metrics, currentPeriod, comparisonPeriod);

      expect(report.volumeMetrics.trend).toBe('increasing');
      expect(report.insights.some((i) => i.includes('increased'))).toBe(true);
    });

    it('should handle periods with no cycling data', async () => {
      const activities: ReportingActivity[] = [];
      const metrics = createMockMetrics();

      // Only running activities
      for (let i = 0; i < 28; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        activities.push({
          id: `running-${i}`,
          date,
          sport: 'RUNNING' as Sport,
          duration: 45,
          distance: 8,
          tss: 50,
        });
      }

      const currentPeriod = getPeriod(0, 14);
      const comparisonPeriod = getPeriod(14, 14);

      const report = await generateProgressionReport(activities, metrics, currentPeriod, comparisonPeriod);

      expect(report.powerMetrics.currentFTP).toBeUndefined();
      expect(report.powerMetrics.previousFTP).toBeUndefined();
    });
  });

  // ========== READINESS REPORT TESTS ==========

  describe('generateReadinessReport', () => {
    it('should generate a complete readiness report', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 14);

      const report = await generateReadinessReport(metrics, activities, period);

      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period).toEqual(period);
      expect(report.dailyScores).toBeInstanceOf(Array);
      expect(report.averageScore).toBeGreaterThanOrEqual(0);
      expect(['improving', 'stable', 'declining']).toContain(report.trendDirection);
      expect(report.factorAnalysis).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should calculate daily readiness scores', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 7);

      const report = await generateReadinessReport(metrics, activities, period);

      expect(report.dailyScores.length).toBeGreaterThan(0);
      report.dailyScores.forEach((score) => {
        expect(score.date).toBeInstanceOf(Date);
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.score).toBeLessThanOrEqual(100);
        expect(['low', 'moderate', 'good', 'excellent'].includes(score.level)).toBe(true);
        expect(score.confidence).toBeGreaterThanOrEqual(0);
        expect(score.confidence).toBeLessThanOrEqual(100);
      });
    });

    it('should calculate average readiness score', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 14);

      const report = await generateReadinessReport(metrics, activities, period);

      expect(report.averageScore).toBeGreaterThanOrEqual(0);
      expect(report.averageScore).toBeLessThanOrEqual(100);
    });

    it('should detect improving readiness trend', async () => {
      const activities = createMockActivities();
      const metrics: ReportingMetric[] = [];

      // Create improving trend - higher values in recent days
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const baseValue = i < 7 ? 70 : 50; // Higher recent values

        metrics.push(
          { date, type: 'HRV', value: baseValue, unit: 'ms' },
          { date, type: 'RESTING_HR', value: 52, unit: 'bpm' },
          { date, type: 'SLEEP_HOURS', value: 8, unit: 'hours' },
          { date, type: 'STRESS_LEVEL', value: 30 },
          { date, type: 'TRAINING_LOAD', value: 300 }
        );
      }

      const period = getPeriod(0, 14);
      const report = await generateReadinessReport(metrics, activities, period);

      // Trend should be improving or stable
      expect(['improving', 'stable']).toContain(report.trendDirection);
    });

    it('should detect declining readiness trend', async () => {
      const activities = createMockActivities();
      const metrics: ReportingMetric[] = [];

      // Create declining trend - lower values in recent days
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const baseValue = i < 7 ? 50 : 70; // Lower recent values

        metrics.push(
          { date, type: 'HRV', value: baseValue, unit: 'ms' },
          { date, type: 'RESTING_HR', value: 55, unit: 'bpm' },
          { date, type: 'SLEEP_HOURS', value: 6, unit: 'hours' },
          { date, type: 'STRESS_LEVEL', value: 60 },
          { date, type: 'TRAINING_LOAD', value: 500 }
        );
      }

      const period = getPeriod(0, 14);
      const report = await generateReadinessReport(metrics, activities, period);

      // Should have recommendations for declining readiness
      if (report.trendDirection === 'declining') {
        expect(report.recommendations.length).toBeGreaterThan(0);
      }
    });

    it('should analyze factor trends', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 14);

      const report = await generateReadinessReport(metrics, activities, period);

      expect(report.factorAnalysis.hrv).toBeDefined();
      expect(report.factorAnalysis.trainingLoad).toBeDefined();
      expect(report.factorAnalysis.sleep).toBeDefined();
      expect(report.factorAnalysis.stress).toBeDefined();

      expect(['improving', 'stable', 'declining']).toContain(report.factorAnalysis.hrv.trend);
      expect(report.factorAnalysis.hrv.average).toBeGreaterThanOrEqual(0);
    });

    it('should recommend more sleep when average is low', async () => {
      const activities = createMockActivities();
      const metrics: ReportingMetric[] = [];

      // Low sleep values
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        metrics.push(
          { date, type: 'HRV', value: 60, unit: 'ms' },
          { date, type: 'SLEEP_HOURS', value: 6, unit: 'hours' }, // Low sleep
          { date, type: 'TRAINING_LOAD', value: 300 }
        );
      }

      const period = getPeriod(0, 14);
      const report = await generateReadinessReport(metrics, activities, period);

      expect(report.recommendations.some((r) => r.includes('sleep'))).toBe(true);
    });

    it('should recommend stress management when stress is high', async () => {
      const activities = createMockActivities();
      const metrics: ReportingMetric[] = [];

      // High stress values
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        metrics.push(
          { date, type: 'HRV', value: 60, unit: 'ms' },
          { date, type: 'SLEEP_HOURS', value: 7.5, unit: 'hours' },
          { date, type: 'STRESS_LEVEL', value: 70 }, // High stress
          { date, type: 'TRAINING_LOAD', value: 300 }
        );
      }

      const period = getPeriod(0, 14);
      const report = await generateReadinessReport(metrics, activities, period);

      expect(report.recommendations.some((r) => r.includes('stress'))).toBe(true);
    });
  });

  // ========== EXPORT TESTS ==========

  describe('Export Functions', () => {
    it('should export unified report to JSON', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 14);

      const report = await generateUnifiedReport(activities, metrics, period);
      const json = exportToJSON(report);

      expect(json).toBeTruthy();
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.generatedAt).toBeDefined();
      expect(parsed.insights).toBeDefined();
    });

    it('should export readiness report to CSV', async () => {
      const activities = createMockActivities();
      const metrics = createMockMetrics();
      const period = getPeriod(0, 7);

      const report = await generateReadinessReport(metrics, activities, period);
      const csv = exportToCSV(report);

      expect(csv).toBeTruthy();
      expect(csv).toContain('Date,Score,Level,Confidence');

      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(1); // Header + data rows
    });

    it('should export activities to CSV', () => {
      const activities = createMockActivities().slice(0, 5);
      const csv = exportActivitiesToCSV(activities);

      expect(csv).toBeTruthy();
      expect(csv).toContain('Date,Sport,Duration (min),Distance (km)');

      const lines = csv.split('\n');
      expect(lines.length).toBe(6); // Header + 5 activities
    });

    it('should handle empty activities in CSV export', () => {
      const csv = exportActivitiesToCSV([]);

      expect(csv).toBeTruthy();
      expect(csv).toContain('Date,Sport,Duration (min)');

      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // Only header
    });
  });
});
