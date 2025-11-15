/**
 * Unit Tests for Readiness Calculation
 *
 * Tests the 7-signal readiness scoring system with confidence factors
 */

import { calculateReadinessScore, getReadinessLevel } from '../readiness';
import { Metric } from '@prisma/client';

describe('Readiness Calculation', () => {
  const baseDate = new Date('2024-01-15');

  const createMetric = (
    type: string,
    value: number,
    daysAgo: number = 0
  ): Metric => ({
    id: `metric-${type}-${daysAgo}`,
    userId: 'test-user',
    type: type as any,
    value,
    unit: null,
    date: new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    metadata: null,
    createdAt: new Date(),
  });

  describe('calculateReadinessScore', () => {
    it('should return excellent readiness with all optimal metrics', () => {
      const metrics: Metric[] = [
        createMetric('HRV', 70, 0),
        createMetric('TRAINING_LOAD', 300, 0),
        createMetric('RECOVERY_TIME', 12, 0),
        createMetric('SLEEP_HOURS', 8, 0),
        createMetric('RESTING_HR', 50, 0),
        createMetric('STRESS_LEVEL', 20, 0),
        createMetric('WORKOUT_QUALITY', 8, 0),
      ];

      const result = calculateReadinessScore(metrics);

      expect(result.score).toBeGreaterThan(70);
      expect(result.level).toBe('excellent');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.confidenceLevel).toMatch(/high|very_high/);
    });

    it('should return low readiness with all poor metrics', () => {
      const metrics: Metric[] = [
        createMetric('HRV', 20, 0),
        createMetric('TRAINING_LOAD', 800, 0),
        createMetric('RECOVERY_TIME', 72, 0),
        createMetric('SLEEP_HOURS', 4, 0),
        createMetric('RESTING_HR', 80, 0),
        createMetric('STRESS_LEVEL', 90, 0),
        createMetric('WORKOUT_QUALITY', 3, 0),
      ];

      const result = calculateReadinessScore(metrics);

      expect(result.score).toBeLessThan(50);
      expect(result.level).toMatch(/low|moderate/);
    });

    it('should handle missing data gracefully', () => {
      const metrics: Metric[] = [
        createMetric('HRV', 60, 0),
        // Only HRV available
      ];

      const result = calculateReadinessScore(metrics);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeLessThan(50); // Low confidence with limited data
      expect(result.factors.hrv.hasData).toBe(true);
      expect(result.factors.trainingLoad.hasData).toBe(false);
    });

    it('should calculate confidence based on data completeness', () => {
      // Complete data
      const completeMetrics: Metric[] = [
        createMetric('HRV', 60, 0),
        createMetric('TRAINING_LOAD', 400, 0),
        createMetric('RECOVERY_TIME', 24, 0),
        createMetric('SLEEP_HOURS', 7, 0),
        createMetric('RESTING_HR', 55, 0),
        createMetric('STRESS_LEVEL', 40, 0),
        createMetric('WORKOUT_QUALITY', 7, 0),
      ];

      const completeResult = calculateReadinessScore(completeMetrics);

      // Partial data
      const partialMetrics: Metric[] = [
        createMetric('HRV', 60, 0),
        createMetric('TRAINING_LOAD', 400, 0),
      ];

      const partialResult = calculateReadinessScore(partialMetrics);

      expect(completeResult.confidence).toBeGreaterThan(partialResult.confidence);
      expect(completeResult.confidenceFactors.dataCompleteness).toBeGreaterThan(
        partialResult.confidenceFactors.dataCompleteness
      );
    });

    it('should penalize old data in confidence score', () => {
      // Recent data
      const recentMetrics: Metric[] = [
        createMetric('HRV', 60, 0),
        createMetric('TRAINING_LOAD', 400, 0),
        createMetric('SLEEP_HOURS', 7, 0),
      ];

      const recentResult = calculateReadinessScore(recentMetrics);

      // Old data (7 days ago)
      const oldMetrics: Metric[] = [
        createMetric('HRV', 60, 7),
        createMetric('TRAINING_LOAD', 400, 7),
        createMetric('SLEEP_HOURS', 7, 7),
      ];

      const oldResult = calculateReadinessScore(oldMetrics);

      expect(recentResult.confidenceFactors.dataRecency).toBeGreaterThan(
        oldResult.confidenceFactors.dataRecency
      );
    });

    it('should return correct impact descriptions', () => {
      const metrics: Metric[] = [
        createMetric('HRV', 70, 0), // Good
        createMetric('TRAINING_LOAD', 800, 0), // Very high
        createMetric('SLEEP_HOURS', 5, 0), // Low
      ];

      const result = calculateReadinessScore(metrics);

      expect(result.factors.hrv.impact).toContain('positive');
      expect(result.factors.trainingLoad.impact).toContain('high');
      expect(result.factors.sleep.impact).toContain('low');
    });

    it('should handle baseline quality in confidence', () => {
      // Multiple consistent readings
      const consistentMetrics: Metric[] = [
        createMetric('HRV', 60, 0),
        createMetric('HRV', 61, 1),
        createMetric('HRV', 59, 2),
        createMetric('HRV', 60, 3),
        createMetric('HRV', 62, 4),
      ];

      const consistentResult = calculateReadinessScore(consistentMetrics);

      // Single reading
      const singleMetric: Metric[] = [createMetric('HRV', 60, 0)];

      const singleResult = calculateReadinessScore(singleMetric);

      expect(consistentResult.confidenceFactors.baselineQuality).toBeGreaterThan(
        singleResult.confidenceFactors.baselineQuality
      );
    });

    it('should check signal agreement in confidence', () => {
      // All signals agree (all good)
      const agreeingMetrics: Metric[] = [
        createMetric('HRV', 70, 0), // Good
        createMetric('SLEEP_HOURS', 8, 0), // Good
        createMetric('RESTING_HR', 50, 0), // Good
        createMetric('STRESS_LEVEL', 20, 0), // Good
      ];

      const agreeingResult = calculateReadinessScore(agreeingMetrics);

      // Signals disagree
      const disagreeingMetrics: Metric[] = [
        createMetric('HRV', 70, 0), // Good
        createMetric('SLEEP_HOURS', 4, 0), // Bad
        createMetric('RESTING_HR', 80, 0), // Bad
        createMetric('STRESS_LEVEL', 90, 0), // Bad
      ];

      const disagreeingResult = calculateReadinessScore(disagreeingMetrics);

      expect(agreeingResult.confidenceFactors.signalAgreement).toBeGreaterThan(
        disagreeingResult.confidenceFactors.signalAgreement
      );
    });

    it('should return empty array for no metrics', () => {
      const result = calculateReadinessScore([]);

      expect(result.score).toBe(50); // Default/neutral score
      expect(result.level).toBe('moderate');
      expect(result.confidence).toBeLessThan(20);
      expect(result.confidenceLevel).toBe('very_low');
    });
  });

  describe('getReadinessLevel', () => {
    it('should return correct levels for score ranges', () => {
      expect(getReadinessLevel(90)).toBe('excellent');
      expect(getReadinessLevel(75)).toBe('excellent');
      expect(getReadinessLevel(70)).toBe('good');
      expect(getReadinessLevel(60)).toBe('good');
      expect(getReadinessLevel(50)).toBe('moderate');
      expect(getReadinessLevel(40)).toBe('moderate');
      expect(getReadinessLevel(30)).toBe('low');
      expect(getReadinessLevel(10)).toBe('low');
    });

    it('should handle edge cases', () => {
      expect(getReadinessLevel(0)).toBe('low');
      expect(getReadinessLevel(100)).toBe('excellent');
    });
  });

  describe('Individual Signal Scoring', () => {
    it('should score HRV correctly', () => {
      const highHRV = calculateReadinessScore([createMetric('HRV', 80, 0)]);
      const lowHRV = calculateReadinessScore([createMetric('HRV', 30, 0)]);

      expect(highHRV.factors.hrv.score).toBeGreaterThan(lowHRV.factors.hrv.score);
      expect(highHRV.factors.hrv.impact).toContain('positive');
      expect(lowHRV.factors.hrv.impact).toContain('reduced');
    });

    it('should score Training Load correctly', () => {
      const optimalLoad = calculateReadinessScore([createMetric('TRAINING_LOAD', 400, 0)]);
      const highLoad = calculateReadinessScore([createMetric('TRAINING_LOAD', 800, 0)]);

      expect(optimalLoad.factors.trainingLoad.score).toBeGreaterThan(
        highLoad.factors.trainingLoad.score
      );
    });

    it('should score Recovery Time correctly', () => {
      const lowRecovery = calculateReadinessScore([createMetric('RECOVERY_TIME', 12, 0)]);
      const highRecovery = calculateReadinessScore([createMetric('RECOVERY_TIME', 72, 0)]);

      expect(lowRecovery.factors.recovery.score).toBeGreaterThan(
        highRecovery.factors.recovery.score
      );
    });

    it('should score Sleep correctly', () => {
      const goodSleep = calculateReadinessScore([createMetric('SLEEP_HOURS', 8, 0)]);
      const poorSleep = calculateReadinessScore([createMetric('SLEEP_HOURS', 4, 0)]);

      expect(goodSleep.factors.sleep.score).toBeGreaterThan(poorSleep.factors.sleep.score);
    });

    it('should score Resting HR correctly', () => {
      const lowHR = calculateReadinessScore([createMetric('RESTING_HR', 50, 0)]);
      const highHR = calculateReadinessScore([createMetric('RESTING_HR', 80, 0)]);

      expect(lowHR.factors.restingHR.score).toBeGreaterThan(highHR.factors.restingHR.score);
    });

    it('should score Stress correctly', () => {
      const lowStress = calculateReadinessScore([createMetric('STRESS_LEVEL', 20, 0)]);
      const highStress = calculateReadinessScore([createMetric('STRESS_LEVEL', 90, 0)]);

      expect(lowStress.factors.stress.score).toBeGreaterThan(highStress.factors.stress.score);
    });

    it('should score Workout Quality correctly', () => {
      const highQuality = calculateReadinessScore([createMetric('WORKOUT_QUALITY', 9, 0)]);
      const lowQuality = calculateReadinessScore([createMetric('WORKOUT_QUALITY', 3, 0)]);

      expect(highQuality.factors.workoutQuality.score).toBeGreaterThan(
        lowQuality.factors.workoutQuality.score
      );
    });
  });

  describe('Confidence Level Categorization', () => {
    it('should categorize confidence levels correctly', () => {
      const veryHighConfidence = calculateReadinessScore([
        createMetric('HRV', 60, 0),
        createMetric('TRAINING_LOAD', 400, 0),
        createMetric('RECOVERY_TIME', 24, 0),
        createMetric('SLEEP_HOURS', 7, 0),
        createMetric('RESTING_HR', 55, 0),
        createMetric('STRESS_LEVEL', 40, 0),
        createMetric('WORKOUT_QUALITY', 7, 0),
      ]);

      const lowConfidence = calculateReadinessScore([createMetric('HRV', 60, 7)]);

      // With all 7 signals complete and recent, confidence should be high
      expect(['moderate', 'high', 'very_high']).toContain(veryHighConfidence.confidenceLevel);
      expect(['very_low', 'low']).toContain(lowConfidence.confidenceLevel);
    });
  });
});
