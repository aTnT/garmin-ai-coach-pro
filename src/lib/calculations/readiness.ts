import { Metric } from '@prisma/client';
import { subDays, startOfDay, isAfter } from 'date-fns';

export interface ReadinessScore {
  score: number; // 0-100
  level: 'low' | 'moderate' | 'good' | 'excellent';
  explanation: string;
  factors: {
    hrv: { score: number; impact: string };
    trainingLoad: { score: number; impact: string };
    recovery: { score: number; impact: string };
    sleep: { score: number; impact: string };
  };
}

export interface MetricSummary {
  hrv?: number;
  hrvAvg?: number;
  trainingLoad?: number;
  acuteLoad?: number;
  chronicLoad?: number;
  recoveryTime?: number;
  sleepHours?: number;
  restingHR?: number;
}

/**
 * Calculate readiness score based on multiple physiological metrics
 * This is a simplified formula-based approach (MVP version)
 */
export function calculateReadinessScore(
  metrics: Metric[]
): ReadinessScore {
  const summary = summarizeMetrics(metrics);

  // Calculate individual factor scores (0-100 each)
  const hrvScore = calculateHRVScore(summary.hrv, summary.hrvAvg);
  const loadScore = calculateTrainingLoadScore(
    summary.acuteLoad,
    summary.chronicLoad
  );
  const recoveryScore = calculateRecoveryScore(summary.recoveryTime);
  const sleepScore = calculateSleepScore(summary.sleepHours);

  // Weighted average (HRV and training load are most important)
  const overallScore = Math.round(
    hrvScore * 0.35 +
      loadScore * 0.35 +
      recoveryScore * 0.20 +
      sleepScore * 0.10
  );

  const level = getReadinessLevel(overallScore);
  const explanation = generateExplanation(overallScore, summary);

  return {
    score: overallScore,
    level,
    explanation,
    factors: {
      hrv: {
        score: hrvScore,
        impact: getHRVImpact(summary.hrv, summary.hrvAvg),
      },
      trainingLoad: {
        score: loadScore,
        impact: getTrainingLoadImpact(summary.acuteLoad, summary.chronicLoad),
      },
      recovery: {
        score: recoveryScore,
        impact: getRecoveryImpact(summary.recoveryTime),
      },
      sleep: {
        score: sleepScore,
        impact: getSleepImpact(summary.sleepHours),
      },
    },
  };
}

/**
 * Summarize metrics from raw data
 */
function summarizeMetrics(metrics: Metric[]): MetricSummary {
  const now = new Date();
  const last7Days = startOfDay(subDays(now, 7));
  const last28Days = startOfDay(subDays(now, 28));

  // Filter recent metrics
  const recentMetrics = metrics.filter((m) =>
    isAfter(new Date(m.date), last7Days)
  );

  // Get latest HRV
  const hrvMetrics = recentMetrics.filter((m) => m.type === 'HRV');
  const hrv = hrvMetrics.length > 0 ? hrvMetrics[0].value : undefined;

  // Calculate 7-day HRV average
  const hrvAvg =
    hrvMetrics.length > 0
      ? hrvMetrics.reduce((sum, m) => sum + m.value, 0) / hrvMetrics.length
      : undefined;

  // Training load (acute = 7 days, chronic = 28 days)
  const last7DaysMetrics = metrics.filter((m) =>
    isAfter(new Date(m.date), last7Days)
  );
  const last28DaysMetrics = metrics.filter((m) =>
    isAfter(new Date(m.date), last28Days)
  );

  const acuteLoad = calculateAverageLoad(
    last7DaysMetrics.filter((m) => m.type === 'TRAINING_LOAD')
  );
  const chronicLoad = calculateAverageLoad(
    last28DaysMetrics.filter((m) => m.type === 'TRAINING_LOAD')
  );

  // Recovery time (latest)
  const recoveryMetrics = recentMetrics.filter(
    (m) => m.type === 'RECOVERY_TIME'
  );
  const recoveryTime =
    recoveryMetrics.length > 0 ? recoveryMetrics[0].value : undefined;

  // Sleep hours (average last 7 days)
  const sleepMetrics = recentMetrics.filter((m) => m.type === 'SLEEP_HOURS');
  const sleepHours =
    sleepMetrics.length > 0
      ? sleepMetrics.reduce((sum, m) => sum + m.value, 0) / sleepMetrics.length
      : undefined;

  return {
    hrv,
    hrvAvg,
    acuteLoad,
    chronicLoad,
    recoveryTime,
    sleepHours,
  };
}

function calculateAverageLoad(metrics: Metric[]): number | undefined {
  if (metrics.length === 0) return undefined;
  return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
}

/**
 * HRV Score: Higher HRV relative to average is better
 */
function calculateHRVScore(
  hrv?: number,
  hrvAvg?: number
): number {
  if (!hrv || !hrvAvg) return 50; // Neutral if no data

  const ratio = hrv / hrvAvg;

  if (ratio >= 1.1) return 100; // 10%+ above average = excellent
  if (ratio >= 1.05) return 85; // 5-10% above = very good
  if (ratio >= 0.95) return 70; // Within 5% of average = good
  if (ratio >= 0.85) return 50; // 5-15% below = moderate
  return 30; // >15% below = low
}

/**
 * Training Load Score: ACWR (Acute:Chronic Workload Ratio)
 * Optimal range: 0.8-1.3
 */
function calculateTrainingLoadScore(
  acute?: number,
  chronic?: number
): number {
  if (!acute || !chronic) return 70; // Assume decent if no data

  const acwr = acute / chronic;

  if (acwr >= 0.8 && acwr <= 1.3) return 100; // Optimal zone
  if (acwr >= 0.7 && acwr <= 1.5) return 75; // Acceptable
  if (acwr >= 1.5) return 40; // Overreaching risk
  return 50; // Under-training
}

/**
 * Recovery Score: Hours remaining
 */
function calculateRecoveryScore(recoveryTime?: number): number {
  if (!recoveryTime) return 100; // No recovery needed

  if (recoveryTime <= 12) return 100; // Fully recovered or minor
  if (recoveryTime <= 24) return 80;
  if (recoveryTime <= 36) return 60;
  if (recoveryTime <= 48) return 40;
  return 20; // >48 hours = very fatigued
}

/**
 * Sleep Score: Based on hours per night
 */
function calculateSleepScore(sleepHours?: number): number {
  if (!sleepHours) return 70; // Assume decent if no data

  if (sleepHours >= 8) return 100; // Optimal
  if (sleepHours >= 7) return 85; // Good
  if (sleepHours >= 6) return 65; // Adequate
  if (sleepHours >= 5) return 40; // Poor
  return 20; // Very poor
}

function getReadinessLevel(score: number): 'low' | 'moderate' | 'good' | 'excellent' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'moderate';
  return 'low';
}

function generateExplanation(score: number, summary: MetricSummary): string {
  if (score >= 85) {
    return 'Excellent! Your body is well-recovered and ready for hard training.';
  }
  if (score >= 70) {
    return 'Good readiness. You can handle moderate to hard training today.';
  }
  if (score >= 50) {
    return 'Moderate readiness. Consider an easy workout or active recovery.';
  }
  return 'Low readiness. Your body needs more recovery. Consider rest or very light activity.';
}

function getHRVImpact(hrv?: number, hrvAvg?: number): string {
  if (!hrv || !hrvAvg) return 'No HRV data available';

  const ratio = hrv / hrvAvg;
  if (ratio >= 1.1) return 'Well above average - excellent recovery';
  if (ratio >= 1.05) return 'Above average - good recovery';
  if (ratio >= 0.95) return 'Normal - adequate recovery';
  if (ratio >= 0.85) return 'Below average - increased stress';
  return 'Significantly below average - poor recovery';
}

function getTrainingLoadImpact(acute?: number, chronic?: number): string {
  if (!acute || !chronic) return 'Insufficient training load data';

  const acwr = acute / chronic;
  if (acwr >= 0.8 && acwr <= 1.3) return 'Optimal training load balance';
  if (acwr >= 1.5) return 'High acute load - injury risk increased';
  if (acwr < 0.8) return 'Low acute load - consider increasing training';
  return 'Moderate training load';
}

function getRecoveryImpact(recoveryTime?: number): string {
  if (!recoveryTime) return 'Fully recovered';
  if (recoveryTime <= 12) return 'Minimal recovery needed';
  if (recoveryTime <= 24) return `${recoveryTime}h recovery time remaining`;
  if (recoveryTime <= 48) return `${recoveryTime}h recovery needed - limit intensity`;
  return `${recoveryTime}h recovery needed - consider rest day`;
}

function getSleepImpact(sleepHours?: number): string {
  if (!sleepHours) return 'No sleep data available';

  if (sleepHours >= 8) return `${sleepHours.toFixed(1)}h - optimal sleep`;
  if (sleepHours >= 7) return `${sleepHours.toFixed(1)}h - good sleep`;
  if (sleepHours >= 6) return `${sleepHours.toFixed(1)}h - adequate sleep`;
  return `${sleepHours.toFixed(1)}h - insufficient sleep`;
}
