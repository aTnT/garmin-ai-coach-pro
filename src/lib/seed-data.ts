import { subDays, format } from 'date-fns';
import { MetricType } from '@prisma/client';

/**
 * Generate realistic training data for the last 60 days
 * This creates a believable training progression with:
 * - Natural variation in HRV
 * - Progressive training load (with recovery weeks)
 * - Correlated readiness scores
 * - Sleep patterns
 * - VO2max progression
 */
export function generateSampleMetrics(userId: string) {
  const metrics: any[] = [];
  const today = new Date();

  // Base values
  let baseHRV = 65;
  let baseLoad = 350;
  let baseVO2max = 48;
  let baseSleep = 7.5;
  let baseRestingHR = 52;

  // Generate data for each of the last 60 days
  for (let i = 60; i >= 0; i--) {
    const date = subDays(today, i);
    const weekNumber = Math.floor((60 - i) / 7);
    const isRecoveryWeek = weekNumber % 4 === 3;

    // HRV: Natural variation with weekly patterns
    const hrvVariation = Math.sin(i / 7) * 5 + (Math.random() - 0.5) * 8;
    const hrvTrend = (60 - i) * 0.1; // Slight upward trend (improving)
    const hrv = Math.max(40, Math.min(85, baseHRV + hrvVariation + hrvTrend));

    // Training Load: Progressive with recovery weeks
    let loadMultiplier = 1.0;
    if (isRecoveryWeek) {
      loadMultiplier = 0.6; // Recovery week
    } else {
      loadMultiplier = 1.0 + (weekNumber % 4) * 0.1; // Build up
    }
    const loadVariation = (Math.random() - 0.3) * 50;
    const trainingLoad = Math.max(
      200,
      Math.min(700, (baseLoad + loadVariation) * loadMultiplier)
    );

    // Sleep: Mostly good with occasional poor nights
    const sleepVariation = (Math.random() - 0.5) * 2;
    const occasionalBadNight = Math.random() < 0.1 ? -2 : 0;
    const sleep = Math.max(
      5,
      Math.min(9, baseSleep + sleepVariation + occasionalBadNight)
    );

    // VO2max: Slowly improving
    const vo2maxTrend = (60 - i) * 0.02;
    const vo2max = Math.min(55, baseVO2max + vo2maxTrend);

    // Resting HR: Improving (lower is better)
    const restingHRTrend = -(60 - i) * 0.01;
    const restingHR = Math.max(45, baseRestingHR + restingHRTrend);

    // Recovery Time: Based on training load
    const recoveryTime = trainingLoad > 500 ? 24 + Math.random() * 24 : Math.random() * 12;

    // Stress Level: Correlated with poor sleep and high load
    const stressLevel = Math.min(
      100,
      (sleep < 6 ? 60 : 30) + (trainingLoad > 550 ? 20 : 0) + Math.random() * 20
    );

    // Calculate readiness score based on factors
    const readinessScore = calculateReadinessScore(
      hrv,
      baseHRV + hrvTrend,
      trainingLoad,
      recoveryTime,
      sleep
    );

    // Add metrics for this day
    metrics.push(
      {
        userId,
        date,
        type: 'HRV' as MetricType,
        value: Math.round(hrv * 10) / 10,
        unit: 'ms',
      },
      {
        userId,
        date,
        type: 'TRAINING_LOAD' as MetricType,
        value: Math.round(trainingLoad),
        unit: null,
      },
      {
        userId,
        date,
        type: 'SLEEP_HOURS' as MetricType,
        value: Math.round(sleep * 10) / 10,
        unit: 'hours',
      },
      {
        userId,
        date,
        type: 'VO2MAX' as MetricType,
        value: Math.round(vo2max * 10) / 10,
        unit: 'ml/kg/min',
      },
      {
        userId,
        date,
        type: 'RESTING_HR' as MetricType,
        value: Math.round(restingHR),
        unit: 'bpm',
      },
      {
        userId,
        date,
        type: 'RECOVERY_TIME' as MetricType,
        value: Math.round(recoveryTime),
        unit: 'hours',
      },
      {
        userId,
        date,
        type: 'STRESS_LEVEL' as MetricType,
        value: Math.round(stressLevel),
        unit: null,
      },
      {
        userId,
        date,
        type: 'READINESS_SCORE' as MetricType,
        value: readinessScore,
        unit: null,
      }
    );
  }

  return metrics;
}

/**
 * Simplified readiness calculation for seed data
 */
function calculateReadinessScore(
  hrv: number,
  hrvAvg: number,
  trainingLoad: number,
  recoveryTime: number,
  sleep: number
): number {
  // HRV score (0-100)
  const hrvRatio = hrv / hrvAvg;
  let hrvScore = 50;
  if (hrvRatio >= 1.1) hrvScore = 100;
  else if (hrvRatio >= 1.05) hrvScore = 85;
  else if (hrvRatio >= 0.95) hrvScore = 70;
  else if (hrvRatio >= 0.85) hrvScore = 50;
  else hrvScore = 30;

  // Training load score (0-100)
  let loadScore = 70;
  if (trainingLoad < 400) loadScore = 85;
  else if (trainingLoad < 500) loadScore = 75;
  else if (trainingLoad < 600) loadScore = 60;
  else loadScore = 40;

  // Recovery score (0-100)
  let recoveryScore = 100;
  if (recoveryTime > 48) recoveryScore = 20;
  else if (recoveryTime > 36) recoveryScore = 40;
  else if (recoveryTime > 24) recoveryScore = 60;
  else if (recoveryTime > 12) recoveryScore = 80;

  // Sleep score (0-100)
  let sleepScore = 70;
  if (sleep >= 8) sleepScore = 100;
  else if (sleep >= 7) sleepScore = 85;
  else if (sleep >= 6) sleepScore = 65;
  else if (sleep >= 5) sleepScore = 40;
  else sleepScore = 20;

  // Weighted average
  const readiness = Math.round(
    hrvScore * 0.35 + loadScore * 0.35 + recoveryScore * 0.2 + sleepScore * 0.1
  );

  return Math.max(0, Math.min(100, readiness));
}

/**
 * Generate sample workouts for the last 30 days
 */
export function generateSampleWorkouts(userId: string) {
  const workouts: any[] = [];
  const today = new Date();

  const workoutTypes = [
    { type: 'EASY', sport: 'RUNNING', duration: 45, distance: 7 },
    { type: 'TEMPO', sport: 'RUNNING', duration: 60, distance: 9.5 },
    { type: 'INTERVAL', sport: 'RUNNING', duration: 50, distance: 8 },
    { type: 'LONG', sport: 'RUNNING', duration: 120, distance: 18 },
    { type: 'RECOVERY', sport: 'RUNNING', duration: 30, distance: 4 },
    { type: 'EASY', sport: 'CYCLING', duration: 60, distance: 25 },
    { type: 'TEMPO', sport: 'CYCLING', duration: 90, distance: 40 },
  ];

  // Generate 3-4 workouts per week for last 30 days
  for (let i = 30; i >= 0; i--) {
    const date = subDays(today, i);
    const dayOfWeek = date.getDay();

    // Workout on Sun, Tue, Thu, Sat
    if ([0, 2, 4, 6].includes(dayOfWeek)) {
      const workout =
        workoutTypes[Math.floor(Math.random() * workoutTypes.length)];

      // 70% completed if in the past
      const completed = i > 2 && Math.random() < 0.7;

      workouts.push({
        userId,
        date,
        sport: workout.sport,
        type: workout.type,
        name: `${workout.type.charAt(0)}${workout.type.slice(1).toLowerCase()} ${
          workout.sport.charAt(0)
        }${workout.sport.slice(1).toLowerCase()}`,
        duration: workout.duration,
        distance: workout.distance,
        structure: {
          description: `Sample ${workout.type.toLowerCase()} workout`,
          intensity: workout.type === 'RECOVERY' || workout.type === 'EASY' ? 'low' :
                     workout.type === 'TEMPO' ? 'moderate' : 'high',
        },
        completed,
        completedAt: completed ? date : null,
      });
    }
  }

  return workouts;
}
