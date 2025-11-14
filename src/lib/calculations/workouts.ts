import { Sport, WorkoutType } from '@prisma/client';

export interface WorkoutParams {
  sport: Sport;
  type: WorkoutType;
  duration: number; // minutes
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface WorkoutStructure {
  name: string;
  description: string;
  sport: Sport;
  type: WorkoutType;
  totalDuration: number; // minutes
  estimatedDistance?: number; // km
  segments: WorkoutSegment[];
  notes: string[];
}

export interface WorkoutSegment {
  order: number;
  name: string;
  duration: number; // minutes
  intensity: 'warmup' | 'easy' | 'moderate' | 'hard' | 'max' | 'recovery';
  heartRateZone?: number; // 1-5
  paceGuidance?: string;
  powerGuidance?: string;
  description: string;
}

/**
 * Generate a structured workout based on parameters
 * This is a template-based approach for MVP
 */
export function generateWorkout(params: WorkoutParams): WorkoutStructure {
  const { sport, type, duration } = params;

  switch (type) {
    case 'EASY':
      return generateEasyWorkout(sport, duration);
    case 'TEMPO':
      return generateTempoWorkout(sport, duration);
    case 'INTERVAL':
      return generateIntervalWorkout(sport, duration);
    case 'LONG':
      return generateLongWorkout(sport, duration);
    case 'RECOVERY':
      return generateRecoveryWorkout(sport, duration);
    default:
      return generateEasyWorkout(sport, duration);
  }
}

function generateEasyWorkout(sport: Sport, duration: number): WorkoutStructure {
  const mainDuration = duration;

  return {
    name: `Easy ${getSportName(sport)}`,
    description: 'Aerobic endurance workout at comfortable pace',
    sport,
    type: 'EASY',
    totalDuration: duration,
    estimatedDistance: estimateDistance(sport, duration, 'easy'),
    segments: [
      {
        order: 1,
        name: 'Easy Pace',
        duration: mainDuration,
        intensity: 'easy',
        heartRateZone: 2,
        paceGuidance: 'Conversational pace - you should be able to talk easily',
        description: 'Maintain a comfortable, sustainable pace throughout',
      },
    ],
    notes: [
      'Focus on form and breathing',
      'Should feel energized after, not depleted',
      'Stay in Zone 2 (60-70% max HR)',
    ],
  };
}

function generateTempoWorkout(sport: Sport, duration: number): WorkoutStructure {
  const warmup = Math.round(duration * 0.2);
  const tempo = Math.round(duration * 0.6);
  const cooldown = duration - warmup - tempo;

  return {
    name: `Tempo ${getSportName(sport)}`,
    description: 'Sustained effort at lactate threshold pace',
    sport,
    type: 'TEMPO',
    totalDuration: duration,
    estimatedDistance: estimateDistance(sport, duration, 'tempo'),
    segments: [
      {
        order: 1,
        name: 'Warm-up',
        duration: warmup,
        intensity: 'easy',
        heartRateZone: 2,
        paceGuidance: 'Easy conversational pace',
        description: 'Gradually increase effort to prepare for tempo',
      },
      {
        order: 2,
        name: 'Tempo',
        duration: tempo,
        intensity: 'hard',
        heartRateZone: 4,
        paceGuidance: 'Comfortably hard - can speak in short sentences',
        description: 'Sustained effort at threshold pace, ~85-90% max HR',
      },
      {
        order: 3,
        name: 'Cool-down',
        duration: cooldown,
        intensity: 'easy',
        heartRateZone: 2,
        paceGuidance: 'Very easy pace',
        description: 'Easy pace to facilitate recovery',
      },
    ],
    notes: [
      'The tempo portion should feel "comfortably hard"',
      'Maintain steady effort throughout tempo segment',
      'This builds lactate threshold and race pace endurance',
    ],
  };
}

function generateIntervalWorkout(
  sport: Sport,
  duration: number
): WorkoutStructure {
  const warmup = Math.round(duration * 0.25);
  const cooldown = Math.round(duration * 0.2);
  const intervalTime = duration - warmup - cooldown;

  // 4-6 intervals depending on duration
  const numIntervals = Math.floor(intervalTime / 10);
  const intervalDuration = 3; // 3 minutes hard
  const recoveryDuration = Math.floor(
    (intervalTime - numIntervals * intervalDuration) / numIntervals
  );

  const segments: WorkoutSegment[] = [
    {
      order: 1,
      name: 'Warm-up',
      duration: warmup,
      intensity: 'easy',
      heartRateZone: 2,
      paceGuidance: 'Easy pace with gradual pickup',
      description: 'Progressive warm-up ending at moderate pace',
    },
  ];

  for (let i = 0; i < numIntervals; i++) {
    segments.push({
      order: segments.length + 1,
      name: `Interval ${i + 1}`,
      duration: intervalDuration,
      intensity: 'hard',
      heartRateZone: 5,
      paceGuidance: 'Hard effort - 90-95% max HR',
      description: `Hard effort interval #${i + 1}`,
    });

    if (i < numIntervals - 1) {
      segments.push({
        order: segments.length + 1,
        name: `Recovery ${i + 1}`,
        duration: recoveryDuration,
        intensity: 'recovery',
        heartRateZone: 2,
        paceGuidance: 'Very easy recovery pace',
        description: 'Active recovery between intervals',
      });
    }
  }

  segments.push({
    order: segments.length + 1,
    name: 'Cool-down',
    duration: cooldown,
    intensity: 'easy',
    heartRateZone: 2,
    paceGuidance: 'Very easy pace',
    description: 'Easy cool-down to finish',
  });

  return {
    name: `${numIntervals}x${intervalDuration}min Intervals`,
    description: 'High-intensity interval training',
    sport,
    type: 'INTERVAL',
    totalDuration: duration,
    estimatedDistance: estimateDistance(sport, duration, 'interval'),
    segments,
    notes: [
      `Complete ${numIntervals} hard intervals with recovery between`,
      'Focus on maintaining consistent effort in each interval',
      'Recovery should be easy enough to complete all intervals',
      'Builds VO2max and high-end fitness',
    ],
  };
}

function generateLongWorkout(sport: Sport, duration: number): WorkoutStructure {
  return {
    name: `Long ${getSportName(sport)}`,
    description: 'Extended aerobic endurance session',
    sport,
    type: 'LONG',
    totalDuration: duration,
    estimatedDistance: estimateDistance(sport, duration, 'easy'),
    segments: [
      {
        order: 1,
        name: 'Long Endurance',
        duration: duration,
        intensity: 'easy',
        heartRateZone: 2,
        paceGuidance: 'Easy, sustainable pace',
        description: 'Steady aerobic effort for extended duration',
      },
    ],
    notes: [
      'Focus on staying aerobic (Zone 2)',
      'Practice nutrition and hydration strategy',
      'Build mental toughness and time on feet',
      'Take walking breaks if needed to maintain effort level',
    ],
  };
}

function generateRecoveryWorkout(
  sport: Sport,
  duration: number
): WorkoutStructure {
  return {
    name: `Recovery ${getSportName(sport)}`,
    description: 'Very easy active recovery session',
    sport,
    type: 'RECOVERY',
    totalDuration: duration,
    estimatedDistance: estimateDistance(sport, duration, 'recovery'),
    segments: [
      {
        order: 1,
        name: 'Recovery Pace',
        duration: duration,
        intensity: 'recovery',
        heartRateZone: 1,
        paceGuidance: 'Very easy - slower than you think',
        description: 'Extremely easy effort to facilitate recovery',
      },
    ],
    notes: [
      'This should feel almost too easy',
      'Focus on movement quality and relaxation',
      'Helps flush out metabolic waste',
      'Do not exceed Zone 2 heart rate',
    ],
  };
}

function getSportName(sport: Sport): string {
  switch (sport) {
    case 'RUNNING':
      return 'Run';
    case 'CYCLING':
      return 'Ride';
    case 'SWIMMING':
      return 'Swim';
    case 'TRIATHLON':
      return 'Brick';
    default:
      return 'Workout';
  }
}

function estimateDistance(
  sport: Sport,
  duration: number,
  intensity: string
): number {
  // Rough estimates in km
  const minutesToHours = duration / 60;

  switch (sport) {
    case 'RUNNING':
      if (intensity === 'easy' || intensity === 'recovery') {
        return minutesToHours * 9; // 9 km/hr
      } else if (intensity === 'tempo') {
        return minutesToHours * 11; // 11 km/hr
      } else {
        return minutesToHours * 10; // 10 km/hr average
      }

    case 'CYCLING':
      if (intensity === 'easy' || intensity === 'recovery') {
        return minutesToHours * 25; // 25 km/hr
      } else if (intensity === 'tempo') {
        return minutesToHours * 30; // 30 km/hr
      } else {
        return minutesToHours * 28; // 28 km/hr average
      }

    case 'SWIMMING':
      if (intensity === 'easy' || intensity === 'recovery') {
        return minutesToHours * 2; // 2 km/hr
      } else {
        return minutesToHours * 2.5; // 2.5 km/hr
      }

    default:
      return 0;
  }
}
