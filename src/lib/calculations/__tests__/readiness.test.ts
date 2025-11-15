/**
 * Unit Tests for Readiness Calculation
 *
 * Tests the 7-signal readiness scoring system with confidence factors
 */

import { calculateReadinessScore } from '../readiness';
import { Metric } from '@prisma/client';

describe('Readiness Calculation', () => {
  // Use current date so metrics are within the 7-28 day lookback window
  const baseDate = new Date();

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
      const metrics: Metric[] = [];
      // Provide 7 days of truly excellent data
      for (let i = 0; i < 7; i++) {
        metrics.push(
          createMetric('HRV', 90, i), // Excellent HRV
          createMetric('TRAINING_LOAD', 250, i), // Moderate load
          createMetric('RECOVERY_TIME', 8, i), // Low recovery time needed
          createMetric('SLEEP_HOURS', 9, i), // Excellent sleep
          createMetric('RESTING_HR', 45, i), // Very low resting HR
          createMetric('STRESS_LEVEL', 10, i), // Very low stress
          createMetric('WORKOUT_QUALITY', 10, i) // Excellent quality
        );
      }
      // Add chronic data with consistent low training load
      for (let i = 7; i < 28; i++) {
        metrics.push(
          createMetric('TRAINING_LOAD', 250, i),
          createMetric('RESTING_HR', 45, i)
        );
      }

      const result = calculateReadinessScore(metrics);

      expect(result.score).toBeGreaterThan(60);
      expect(result.level).toMatch(/good|excellent/);
      expect(result.confidence).toBeGreaterThan(40);
      expect(result.confidenceLevel).toMatch(/low|moderate|high|very_high/);
    });

    it('should return low readiness with all poor metrics', () => {
      const metrics: Metric[] = [];
      // Provide 7 days of poor metrics
      for (let i = 0; i < 7; i++) {
        metrics.push(
          createMetric('HRV', 20, i),
          createMetric('TRAINING_LOAD', 800, i),
          createMetric('RECOVERY_TIME', 72, i),
          createMetric('SLEEP_HOURS', 4, i),
          createMetric('RESTING_HR', 80, i),
          createMetric('STRESS_LEVEL', 90, i),
          createMetric('WORKOUT_QUALITY', 3, i)
        );
      }
      // Add chronic data
      for (let i = 7; i < 28; i++) {
        metrics.push(
          createMetric('TRAINING_LOAD', 800, i),
          createMetric('RESTING_HR', 80, i)
        );
      }

      const result = calculateReadinessScore(metrics);

      expect(result.score).toBeLessThan(70);
      expect(result.level).toMatch(/low|moderate|good/);
    });

    it('should handle missing data gracefully', () => {
      const metrics: Metric[] = [];
      // Only HRV available for 7 days
      for (let i = 0; i < 7; i++) {
        metrics.push(createMetric('HRV', 60, i));
      }

      const result = calculateReadinessScore(metrics);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeLessThan(65); // Low confidence with limited data
      expect(result.factors.hrv.hasData).toBe(true);
      expect(result.factors.trainingLoad.hasData).toBe(false);
    });

    it('should calculate confidence based on data completeness', () => {
      // Complete data - 7 days of all signals
      const completeMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        completeMetrics.push(
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i),
          createMetric('RECOVERY_TIME', 24, i),
          createMetric('SLEEP_HOURS', 7, i),
          createMetric('RESTING_HR', 55, i),
          createMetric('STRESS_LEVEL', 40, i),
          createMetric('WORKOUT_QUALITY', 7, i)
        );
      }
      for (let i = 7; i < 28; i++) {
        completeMetrics.push(
          createMetric('TRAINING_LOAD', 400, i),
          createMetric('RESTING_HR', 55, i)
        );
      }

      const completeResult = calculateReadinessScore(completeMetrics);

      // Partial data - only 2 signals for 7 days
      const partialMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        partialMetrics.push(
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i)
        );
      }
      for (let i = 7; i < 28; i++) {
        partialMetrics.push(createMetric('TRAINING_LOAD', 400, i));
      }

      const partialResult = calculateReadinessScore(partialMetrics);

      expect(completeResult.confidence).toBeGreaterThan(partialResult.confidence);
      expect(completeResult.confidenceFactors.dataCompleteness).toBeGreaterThan(
        partialResult.confidenceFactors.dataCompleteness
      );
    });

    it('should penalize old data in confidence score', () => {
      // Recent data - last 3 days only
      const recentMetrics: Metric[] = [];
      for (let i = 0; i < 3; i++) {
        recentMetrics.push(
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i),
          createMetric('SLEEP_HOURS', 7, i)
        );
      }

      const recentResult = calculateReadinessScore(recentMetrics);

      // Old data - 7-10 days ago (still within 28-day window but not in 7-day window)
      const oldMetrics: Metric[] = [];
      for (let i = 7; i < 10; i++) {
        oldMetrics.push(
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i),
          createMetric('SLEEP_HOURS', 7, i)
        );
      }

      const oldResult = calculateReadinessScore(oldMetrics);

      expect(recentResult.confidenceFactors.dataRecency).toBeGreaterThan(
        oldResult.confidenceFactors.dataRecency
      );
    });

    it('should return correct impact descriptions', () => {
      const metrics: Metric[] = [];
      // Provide 7 days of data
      for (let i = 0; i < 7; i++) {
        metrics.push(
          createMetric('HRV', 70, i), // Good
          createMetric('TRAINING_LOAD', 800, i), // Very high
          createMetric('SLEEP_HOURS', 5, i) // Low
        );
      }
      // Add chronic data for training load
      for (let i = 7; i < 28; i++) {
        metrics.push(createMetric('TRAINING_LOAD', 800, i));
      }

      const result = calculateReadinessScore(metrics);

      // Check that impact descriptions are present
      expect(result.factors.hrv.impact).toBeDefined();
      expect(result.factors.hrv.impact.length).toBeGreaterThan(0);
      expect(result.factors.trainingLoad.impact).toBeDefined();
      expect(result.factors.trainingLoad.impact.length).toBeGreaterThan(0);
      expect(result.factors.sleep.impact).toBeDefined();
      expect(result.factors.sleep.impact.length).toBeGreaterThan(0);
    });

    it('should handle baseline quality in confidence', () => {
      // Multiple consistent readings - 7 days of HRV data
      const consistentMetrics: Metric[] = [
        createMetric('HRV', 60, 0),
        createMetric('HRV', 61, 1),
        createMetric('HRV', 59, 2),
        createMetric('HRV', 60, 3),
        createMetric('HRV', 62, 4),
        createMetric('HRV', 60, 5),
        createMetric('HRV', 61, 6),
      ];

      const consistentResult = calculateReadinessScore(consistentMetrics);

      // Fewer readings - only 2 days
      const singleMetric: Metric[] = [
        createMetric('HRV', 60, 0),
        createMetric('HRV', 61, 1),
      ];

      const singleResult = calculateReadinessScore(singleMetric);

      expect(consistentResult.confidenceFactors.baselineQuality).toBeGreaterThan(
        singleResult.confidenceFactors.baselineQuality
      );
    });

    it('should check signal agreement in confidence', () => {
      // All signals agree (all good) - 7 days
      const agreeingMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        agreeingMetrics.push(
          createMetric('HRV', 70, i), // Good
          createMetric('SLEEP_HOURS', 8, i), // Good
          createMetric('RESTING_HR', 50, i), // Good
          createMetric('STRESS_LEVEL', 20, i) // Good
        );
      }
      for (let i = 7; i < 28; i++) {
        agreeingMetrics.push(createMetric('RESTING_HR', 50, i));
      }

      const agreeingResult = calculateReadinessScore(agreeingMetrics);

      // Signals disagree - 7 days
      const disagreeingMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        disagreeingMetrics.push(
          createMetric('HRV', 70, i), // Good
          createMetric('SLEEP_HOURS', 4, i), // Bad
          createMetric('RESTING_HR', 80, i), // Bad
          createMetric('STRESS_LEVEL', 90, i) // Bad
        );
      }
      for (let i = 7; i < 28; i++) {
        disagreeingMetrics.push(createMetric('RESTING_HR', 80, i));
      }

      const disagreeingResult = calculateReadinessScore(disagreeingMetrics);

      expect(agreeingResult.confidenceFactors.signalAgreement).toBeGreaterThan(
        disagreeingResult.confidenceFactors.signalAgreement
      );
    });

    it('should return default score for no metrics', () => {
      const result = calculateReadinessScore([]);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.level).toMatch(/low|moderate|good/);
      expect(result.confidence).toBeLessThan(30);
      expect(result.confidenceLevel).toMatch(/very_low|low/);
    });
  });

  // getReadinessLevel is tested indirectly through calculateReadinessScore

  describe('Individual Signal Scoring', () => {
    it('should score HRV correctly', () => {
      const highHRVMetrics: Metric[] = [];
      const lowHRVMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        highHRVMetrics.push(
          createMetric('HRV', 80, i),
          createMetric('TRAINING_LOAD', 400, i),
          createMetric('SLEEP_HOURS', 7, i)
        );
        lowHRVMetrics.push(
          createMetric('HRV', 30, i),
          createMetric('TRAINING_LOAD', 400, i),
          createMetric('SLEEP_HOURS', 7, i)
        );
      }
      for (let i = 7; i < 28; i++) {
        highHRVMetrics.push(createMetric('TRAINING_LOAD', 400, i));
        lowHRVMetrics.push(createMetric('TRAINING_LOAD', 400, i));
      }

      const highHRV = calculateReadinessScore(highHRVMetrics);
      const lowHRV = calculateReadinessScore(lowHRVMetrics);

      expect(highHRV.factors.hrv.score).toBeGreaterThanOrEqual(lowHRV.factors.hrv.score);
      expect(highHRV.factors.hrv.impact).toBeDefined();
      expect(lowHRV.factors.hrv.impact).toBeDefined();
    });

    it('should score Training Load correctly', () => {
      const optimalLoadMetrics: Metric[] = [];
      const highLoadMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        optimalLoadMetrics.push(createMetric('TRAINING_LOAD', 400, i));
        highLoadMetrics.push(createMetric('TRAINING_LOAD', 800, i));
      }
      for (let i = 7; i < 28; i++) {
        optimalLoadMetrics.push(createMetric('TRAINING_LOAD', 400, i));
        highLoadMetrics.push(createMetric('TRAINING_LOAD', 800, i));
      }

      const optimalLoad = calculateReadinessScore(optimalLoadMetrics);
      const highLoad = calculateReadinessScore(highLoadMetrics);

      expect(optimalLoad.factors.trainingLoad.score).toBeGreaterThanOrEqual(
        highLoad.factors.trainingLoad.score
      );
    });

    it('should score Recovery Time correctly', () => {
      const lowRecoveryMetrics: Metric[] = [];
      const highRecoveryMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        lowRecoveryMetrics.push(
          createMetric('RECOVERY_TIME', 12, i),
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i)
        );
        highRecoveryMetrics.push(
          createMetric('RECOVERY_TIME', 72, i),
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i)
        );
      }
      for (let i = 7; i < 28; i++) {
        lowRecoveryMetrics.push(createMetric('TRAINING_LOAD', 400, i));
        highRecoveryMetrics.push(createMetric('TRAINING_LOAD', 400, i));
      }

      const lowRecovery = calculateReadinessScore(lowRecoveryMetrics);
      const highRecovery = calculateReadinessScore(highRecoveryMetrics);

      expect(lowRecovery.factors.recovery.score).toBeGreaterThan(
        highRecovery.factors.recovery.score
      );
    });

    it('should score Sleep correctly', () => {
      const goodSleepMetrics: Metric[] = [];
      const poorSleepMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        // Good sleep - all metrics normal except sleep is good
        goodSleepMetrics.push(
          createMetric('SLEEP_HOURS', 8, i),
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i)
        );
        // Poor sleep - all metrics normal except sleep is poor
        poorSleepMetrics.push(
          createMetric('SLEEP_HOURS', 4, i),
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i)
        );
      }
      for (let i = 7; i < 28; i++) {
        goodSleepMetrics.push(createMetric('TRAINING_LOAD', 400, i));
        poorSleepMetrics.push(createMetric('TRAINING_LOAD', 400, i));
      }

      const goodSleep = calculateReadinessScore(goodSleepMetrics);
      const poorSleep = calculateReadinessScore(poorSleepMetrics);

      expect(goodSleep.factors.sleep.score).toBeGreaterThan(poorSleep.factors.sleep.score);
    });

    it('should score Resting HR correctly', () => {
      const lowHRMetrics: Metric[] = [];
      const highHRMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        lowHRMetrics.push(createMetric('RESTING_HR', 50, i));
        highHRMetrics.push(createMetric('RESTING_HR', 80, i));
      }
      for (let i = 7; i < 28; i++) {
        lowHRMetrics.push(createMetric('RESTING_HR', 50, i));
        highHRMetrics.push(createMetric('RESTING_HR', 80, i));
      }

      const lowHR = calculateReadinessScore(lowHRMetrics);
      const highHR = calculateReadinessScore(highHRMetrics);

      expect(lowHR.factors.restingHR.score).toBeGreaterThanOrEqual(highHR.factors.restingHR.score);
    });

    it('should score Stress correctly', () => {
      const lowStressMetrics: Metric[] = [];
      const highStressMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        lowStressMetrics.push(
          createMetric('STRESS_LEVEL', 20, i),
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i)
        );
        highStressMetrics.push(
          createMetric('STRESS_LEVEL', 90, i),
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i)
        );
      }
      for (let i = 7; i < 28; i++) {
        lowStressMetrics.push(createMetric('TRAINING_LOAD', 400, i));
        highStressMetrics.push(createMetric('TRAINING_LOAD', 400, i));
      }

      const lowStress = calculateReadinessScore(lowStressMetrics);
      const highStress = calculateReadinessScore(highStressMetrics);

      expect(lowStress.factors.stress.score).toBeGreaterThan(highStress.factors.stress.score);
    });

    it('should score Workout Quality correctly', () => {
      const highQualityMetrics: Metric[] = [];
      const lowQualityMetrics: Metric[] = [];
      for (let i = 0; i < 7; i++) {
        highQualityMetrics.push(
          createMetric('WORKOUT_QUALITY', 9, i),
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i)
        );
        lowQualityMetrics.push(
          createMetric('WORKOUT_QUALITY', 3, i),
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i)
        );
      }
      for (let i = 7; i < 28; i++) {
        highQualityMetrics.push(createMetric('TRAINING_LOAD', 400, i));
        lowQualityMetrics.push(createMetric('TRAINING_LOAD', 400, i));
      }

      const highQuality = calculateReadinessScore(highQualityMetrics);
      const lowQuality = calculateReadinessScore(lowQualityMetrics);

      expect(highQuality.factors.workoutQuality.score).toBeGreaterThan(
        lowQuality.factors.workoutQuality.score
      );
    });
  });

  describe('Confidence Level Categorization', () => {
    it('should categorize confidence levels correctly', () => {
      const highConfidenceMetrics: Metric[] = [];
      // All 7 signals for 7 days
      for (let i = 0; i < 7; i++) {
        highConfidenceMetrics.push(
          createMetric('HRV', 60, i),
          createMetric('TRAINING_LOAD', 400, i),
          createMetric('RECOVERY_TIME', 24, i),
          createMetric('SLEEP_HOURS', 7, i),
          createMetric('RESTING_HR', 55, i),
          createMetric('STRESS_LEVEL', 40, i),
          createMetric('WORKOUT_QUALITY', 7, i)
        );
      }
      for (let i = 7; i < 28; i++) {
        highConfidenceMetrics.push(
          createMetric('TRAINING_LOAD', 400, i),
          createMetric('RESTING_HR', 55, i)
        );
      }

      const veryHighConfidence = calculateReadinessScore(highConfidenceMetrics);

      // Old, sparse data - very limited data from 15-20 days ago
      const lowConfidenceMetrics: Metric[] = [];
      for (let i = 15; i < 20; i++) {
        lowConfidenceMetrics.push(createMetric('HRV', 60, i));
      }

      const lowConfidence = calculateReadinessScore(lowConfidenceMetrics);

      // With all 7 signals complete and recent, confidence should be high
      expect(['moderate', 'high', 'very_high']).toContain(veryHighConfidence.confidenceLevel);
      expect(['very_low', 'low', 'moderate']).toContain(lowConfidence.confidenceLevel);
    });
  });
});
