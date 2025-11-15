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
    restingHR: { score: number; impact: string };
    stress: { score: number; impact: string };
    workoutQuality: { score: number; impact: string };
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
  restingHRAvg?: number;
  restingHRBaseline?: number;
  stress?: number;
  stressAvg?: number;
  workoutQuality?: number;
  recentWorkoutQuality?: number[];
}

/**
 * Calculate readiness score based on multiple physiological metrics
 * Enhanced version with 7 signals: HRV, Training Load, Recovery, Sleep,
 * Resting HR, Stress, and Workout Quality
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
  const restingHRScore = calculateRestingHRScore(
    summary.restingHR,
    summary.restingHRAvg,
    summary.restingHRBaseline
  );
  const stressScore = calculateStressScore(summary.stress, summary.stressAvg);
  const workoutQualityScore = calculateWorkoutQualityScore(
    summary.workoutQuality,
    summary.recentWorkoutQuality
  );

  // Weighted average - redistributed to include new signals
  // HRV (25%), Training Load (25%), Resting HR (15%), Stress (15%),
  // Recovery (10%), Sleep (5%), Workout Quality (5%)
  const overallScore = Math.round(
    hrvScore * 0.25 +
      loadScore * 0.25 +
      restingHRScore * 0.15 +
      stressScore * 0.15 +
      recoveryScore * 0.10 +
      sleepScore * 0.05 +
      workoutQualityScore * 0.05
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
      restingHR: {
        score: restingHRScore,
        impact: getRestingHRImpact(summary.restingHR, summary.restingHRAvg, summary.restingHRBaseline),
      },
      stress: {
        score: stressScore,
        impact: getStressImpact(summary.stress, summary.stressAvg),
      },
      workoutQuality: {
        score: workoutQualityScore,
        impact: getWorkoutQualityImpact(summary.workoutQuality, summary.recentWorkoutQuality),
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

  // Resting HR (latest + 7-day average + 28-day baseline)
  const restingHRMetrics = recentMetrics.filter((m) => m.type === 'RESTING_HR');
  const restingHR = restingHRMetrics.length > 0 ? restingHRMetrics[0].value : undefined;
  const restingHRAvg =
    restingHRMetrics.length > 0
      ? restingHRMetrics.reduce((sum, m) => sum + m.value, 0) / restingHRMetrics.length
      : undefined;

  // 28-day baseline for resting HR
  const last28DaysRestingHR = metrics
    .filter((m) => m.type === 'RESTING_HR' && isAfter(new Date(m.date), last28Days))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const restingHRBaseline =
    last28DaysRestingHR.length > 0
      ? last28DaysRestingHR.reduce((sum, m) => sum + m.value, 0) / last28DaysRestingHR.length
      : undefined;

  // Stress (latest + 7-day average)
  const stressMetrics = recentMetrics.filter((m) => m.type === 'STRESS_LEVEL');
  const stress = stressMetrics.length > 0 ? stressMetrics[0].value : undefined;
  const stressAvg =
    stressMetrics.length > 0
      ? stressMetrics.reduce((sum, m) => sum + m.value, 0) / stressMetrics.length
      : undefined;

  // Workout Quality (average of last 7 workouts)
  const workoutQualityMetrics = recentMetrics
    .filter((m) => m.type === 'WORKOUT_QUALITY')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const workoutQuality =
    workoutQualityMetrics.length > 0
      ? workoutQualityMetrics.reduce((sum, m) => sum + m.value, 0) / workoutQualityMetrics.length
      : undefined;
  const recentWorkoutQuality = workoutQualityMetrics.slice(0, 7).map((m) => m.value);

  return {
    hrv,
    hrvAvg,
    acuteLoad,
    chronicLoad,
    recoveryTime,
    sleepHours,
    restingHR,
    restingHRAvg,
    restingHRBaseline,
    stress,
    stressAvg,
    workoutQuality,
    recentWorkoutQuality,
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

/**
 * Resting HR Score: Lower HR relative to baseline indicates better recovery
 * Elevated resting HR (+5-10 bpm) often signals fatigue or overtraining
 */
function calculateRestingHRScore(
  restingHR?: number,
  restingHRAvg?: number,
  restingHRBaseline?: number
): number {
  if (!restingHR || !restingHRBaseline) return 70; // Neutral if no data

  const difference = restingHR - restingHRBaseline;

  // Lower than baseline = better recovery
  if (difference <= -3) return 100; // 3+ bpm below baseline = excellent
  if (difference <= -1) return 90; // 1-3 bpm below = very good
  if (difference <= 2) return 75; // Within 2 bpm = good
  if (difference <= 5) return 55; // 2-5 bpm above = moderate concern
  if (difference <= 8) return 35; // 5-8 bpm above = high fatigue
  return 20; // >8 bpm above = severe fatigue or illness
}

function getRestingHRImpact(
  restingHR?: number,
  restingHRAvg?: number,
  restingHRBaseline?: number
): string {
  if (!restingHR || !restingHRBaseline) return 'No resting HR data available';

  const difference = restingHR - restingHRBaseline;
  const sign = difference >= 0 ? '+' : '';

  if (difference <= -3)
    return `${restingHR.toFixed(0)} bpm (${sign}${difference.toFixed(0)}) - excellent recovery`;
  if (difference <= -1)
    return `${restingHR.toFixed(0)} bpm (${sign}${difference.toFixed(0)}) - good recovery`;
  if (difference <= 2)
    return `${restingHR.toFixed(0)} bpm (${sign}${difference.toFixed(0)}) - normal`;
  if (difference <= 5)
    return `${restingHR.toFixed(0)} bpm (${sign}${difference.toFixed(0)}) - elevated, monitor closely`;
  if (difference <= 8)
    return `${restingHR.toFixed(0)} bpm (${sign}${difference.toFixed(0)}) - high fatigue detected`;
  return `${restingHR.toFixed(0)} bpm (${sign}${difference.toFixed(0)}) - severe fatigue or illness risk`;
}

/**
 * Stress Score: Based on Garmin stress level (0-100 scale)
 * Lower stress = better readiness
 */
function calculateStressScore(stress?: number, stressAvg?: number): number {
  if (!stress) return 70; // Neutral if no data

  // Garmin stress: 0-25 = rest, 26-50 = low, 51-75 = medium, 76-100 = high
  if (stress <= 25) return 100; // Rest/very low stress
  if (stress <= 40) return 85; // Low stress
  if (stress <= 60) return 65; // Medium stress
  if (stress <= 75) return 45; // High stress
  return 25; // Very high stress
}

function getStressImpact(stress?: number, stressAvg?: number): string {
  if (!stress) return 'No stress data available';

  if (stress <= 25) return `${stress.toFixed(0)} - rest/relaxed state`;
  if (stress <= 40) return `${stress.toFixed(0)} - low stress, well-managed`;
  if (stress <= 60) return `${stress.toFixed(0)} - medium stress, monitor recovery`;
  if (stress <= 75) return `${stress.toFixed(0)} - high stress, prioritize rest`;
  return `${stress.toFixed(0)} - very high stress, recovery essential`;
}

/**
 * Workout Quality Score: Based on recent workout completion and subjective quality
 * Scale: 1-5 (1=very poor, 2=poor, 3=okay, 4=good, 5=excellent)
 * Trend matters: declining quality suggests accumulating fatigue
 */
function calculateWorkoutQualityScore(
  avgQuality?: number,
  recentQuality?: number[]
): number {
  if (!avgQuality || !recentQuality || recentQuality.length === 0) return 70; // Neutral if no data

  // Check for declining trend (last 3 workouts vs previous)
  let trendPenalty = 0;
  if (recentQuality.length >= 5) {
    const recent3 = recentQuality.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const previous3 = recentQuality.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
    if (recent3 < previous3 - 0.5) trendPenalty = -15; // Declining quality
  }

  // Base score on average quality
  let baseScore = 50;
  if (avgQuality >= 4.5) baseScore = 100;
  else if (avgQuality >= 4.0) baseScore = 90;
  else if (avgQuality >= 3.5) baseScore = 80;
  else if (avgQuality >= 3.0) baseScore = 70;
  else if (avgQuality >= 2.5) baseScore = 55;
  else if (avgQuality >= 2.0) baseScore = 40;
  else baseScore = 25;

  return Math.max(0, Math.min(100, baseScore + trendPenalty));
}

function getWorkoutQualityImpact(
  avgQuality?: number,
  recentQuality?: number[]
): string {
  if (!avgQuality) return 'No workout quality data available';

  let trend = '';
  if (recentQuality && recentQuality.length >= 5) {
    const recent3 = recentQuality.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const previous3 = recentQuality.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
    if (recent3 < previous3 - 0.5) trend = ' (declining trend - watch for fatigue)';
    else if (recent3 > previous3 + 0.5) trend = ' (improving trend)';
  }

  if (avgQuality >= 4.5) return `${avgQuality.toFixed(1)}/5 - excellent workout quality${trend}`;
  if (avgQuality >= 4.0) return `${avgQuality.toFixed(1)}/5 - good quality${trend}`;
  if (avgQuality >= 3.0) return `${avgQuality.toFixed(1)}/5 - adequate quality${trend}`;
  if (avgQuality >= 2.0) return `${avgQuality.toFixed(1)}/5 - poor quality${trend}`;
  return `${avgQuality.toFixed(1)}/5 - very poor quality, consider extra recovery${trend}`;
}
