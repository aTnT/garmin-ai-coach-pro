import { Sport } from '@prisma/client';
import { addWeeks, format, startOfWeek, addDays } from 'date-fns';

export interface PlanParams {
  sport: Sport;
  raceDate: Date;
  currentFitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  weeksAvailable?: number;
  daysPerWeek: number;
  hoursPerWeek: number;
  goal: 'finish' | 'improve' | 'compete';
  raceDistance?: number; // km
}

export interface TrainingWeek {
  weekNumber: number;
  startDate: Date;
  phase: 'base' | 'build' | 'peak' | 'taper' | 'race';
  focus: string;
  volume: number; // percentage of max volume
  workouts: PlannedWorkout[];
}

export interface PlannedWorkout {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  date: Date;
  type: 'EASY' | 'TEMPO' | 'INTERVAL' | 'LONG' | 'RECOVERY' | 'RACE';
  name: string;
  duration: number; // minutes
  distance?: number; // km
  description: string;
  intensity: 'low' | 'moderate' | 'high';
}

export interface GeneratedPlan {
  name: string;
  description: string;
  sport: Sport;
  totalWeeks: number;
  startDate: Date;
  raceDate: Date;
  goal: string;
  weeks: TrainingWeek[];
  summary: {
    totalWorkouts: number;
    totalHours: number;
    baseWeeks: number;
    buildWeeks: number;
    peakWeeks: number;
    taperWeeks: number;
  };
}

/**
 * Generate a periodized training plan
 */
export function generateTrainingPlan(params: PlanParams): GeneratedPlan {
  const {
    sport,
    raceDate,
    currentFitnessLevel,
    daysPerWeek,
    hoursPerWeek,
    goal,
    raceDistance,
  } = params;

  // Calculate plan duration
  const today = new Date();
  const weeksAvailable = params.weeksAvailable || calculateWeeksUntilRace(today, raceDate);
  const totalWeeks = Math.min(weeksAvailable, getMaxPlanWeeks(currentFitnessLevel));

  // Calculate phase durations using proper periodization
  const phases = calculatePhaseDurations(totalWeeks);

  // Generate weekly structure
  const weeks: TrainingWeek[] = [];
  let weekNumber = 1;
  let currentDate = startOfWeek(today);

  // Base Phase
  for (let i = 0; i < phases.base; i++) {
    weeks.push(
      generateBaseWeek(
        weekNumber++,
        currentDate,
        sport,
        daysPerWeek,
        hoursPerWeek,
        currentFitnessLevel,
        i
      )
    );
    currentDate = addWeeks(currentDate, 1);
  }

  // Build Phase
  for (let i = 0; i < phases.build; i++) {
    weeks.push(
      generateBuildWeek(
        weekNumber++,
        currentDate,
        sport,
        daysPerWeek,
        hoursPerWeek,
        currentFitnessLevel,
        i
      )
    );
    currentDate = addWeeks(currentDate, 1);
  }

  // Peak Phase
  for (let i = 0; i < phases.peak; i++) {
    weeks.push(
      generatePeakWeek(
        weekNumber++,
        currentDate,
        sport,
        daysPerWeek,
        hoursPerWeek,
        currentFitnessLevel,
        i
      )
    );
    currentDate = addWeeks(currentDate, 1);
  }

  // Taper Phase
  for (let i = 0; i < phases.taper; i++) {
    weeks.push(
      generateTaperWeek(
        weekNumber++,
        currentDate,
        sport,
        daysPerWeek,
        hoursPerWeek,
        i,
        i === phases.taper - 1 // is race week
      )
    );
    currentDate = addWeeks(currentDate, 1);
  }

  const summary = calculatePlanSummary(weeks, phases);

  return {
    name: `${getSportName(sport)} ${getRaceDistanceName(raceDistance)} Training Plan`,
    description: `${totalWeeks}-week ${currentFitnessLevel} plan for ${goal === 'finish' ? 'completing' : goal === 'improve' ? 'improving your time in' : 'competing in'} a ${getRaceDistanceName(raceDistance)} ${getSportName(sport).toLowerCase()} event`,
    sport,
    totalWeeks,
    startDate: weeks[0].startDate,
    raceDate,
    goal: `${goal.charAt(0).toUpperCase() + goal.slice(1)} ${getRaceDistanceName(raceDistance)}`,
    weeks,
    summary,
  };
}

/**
 * Calculate weeks until race date
 */
function calculateWeeksUntilRace(from: Date, raceDate: Date): number {
  const diffTime = raceDate.getTime() - from.getTime();
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  return Math.max(4, diffWeeks); // Minimum 4 weeks
}

/**
 * Get maximum recommended plan length based on fitness level
 */
function getMaxPlanWeeks(level: string): number {
  switch (level) {
    case 'beginner':
      return 16;
    case 'intermediate':
      return 20;
    case 'advanced':
      return 24;
    default:
      return 16;
  }
}

/**
 * Calculate duration of each training phase
 */
function calculatePhaseDurations(totalWeeks: number) {
  if (totalWeeks < 8) {
    // Short plan: compressed phases
    return {
      base: Math.floor(totalWeeks * 0.5),
      build: Math.floor(totalWeeks * 0.3),
      peak: Math.floor(totalWeeks * 0.1),
      taper: Math.max(1, totalWeeks - Math.floor(totalWeeks * 0.9)),
    };
  } else if (totalWeeks <= 12) {
    // Medium plan: standard periodization
    return {
      base: Math.floor(totalWeeks * 0.5),
      build: Math.floor(totalWeeks * 0.3),
      peak: Math.floor(totalWeeks * 0.1),
      taper: Math.max(2, totalWeeks - Math.floor(totalWeeks * 0.9)),
    };
  } else {
    // Long plan: extended base
    return {
      base: Math.floor(totalWeeks * 0.55),
      build: Math.floor(totalWeeks * 0.25),
      peak: Math.floor(totalWeeks * 0.1),
      taper: Math.max(2, totalWeeks - Math.floor(totalWeeks * 0.9)),
    };
  }
}

/**
 * Generate Base Phase week
 */
function generateBaseWeek(
  weekNumber: number,
  startDate: Date,
  sport: Sport,
  daysPerWeek: number,
  hoursPerWeek: number,
  fitnessLevel: string,
  weekInPhase: number
): TrainingWeek {
  const isRecoveryWeek = (weekNumber - 1) % 4 === 3;
  const volumeMultiplier = isRecoveryWeek ? 0.7 : 1.0 + weekInPhase * 0.05;

  const weeklyMinutes = hoursPerWeek * 60 * volumeMultiplier;
  const workouts: PlannedWorkout[] = [];

  // Base phase: 80% easy, 20% long runs
  const workoutDays = selectWorkoutDays(daysPerWeek, 'base');

  workoutDays.forEach((day, index) => {
    const date = addDays(startDate, day);

    if (index === workoutDays.length - 1) {
      // Long workout on last training day (usually weekend)
      const duration = Math.round(weeklyMinutes * 0.35);
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'LONG',
        name: `Long ${getSportName(sport)}`,
        duration,
        distance: estimateDistance(sport, duration, 'easy'),
        description: 'Extended aerobic endurance at easy pace',
        intensity: 'low',
      });
    } else {
      // Easy workouts
      const duration = Math.round((weeklyMinutes * 0.65) / (workoutDays.length - 1));
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'EASY',
        name: `Easy ${getSportName(sport)}`,
        duration,
        distance: estimateDistance(sport, duration, 'easy'),
        description: 'Aerobic base building at conversational pace',
        intensity: 'low',
      });
    }
  });

  return {
    weekNumber,
    startDate,
    phase: 'base',
    focus: isRecoveryWeek ? 'Recovery Week' : 'Aerobic Base Building',
    volume: Math.round(volumeMultiplier * 100),
    workouts,
  };
}

/**
 * Generate Build Phase week
 */
function generateBuildWeek(
  weekNumber: number,
  startDate: Date,
  sport: Sport,
  daysPerWeek: number,
  hoursPerWeek: number,
  fitnessLevel: string,
  weekInPhase: number
): TrainingWeek {
  const isRecoveryWeek = (weekNumber - 1) % 4 === 3;
  const volumeMultiplier = isRecoveryWeek ? 0.7 : 1.0 + weekInPhase * 0.03;

  const weeklyMinutes = hoursPerWeek * 60 * volumeMultiplier;
  const workouts: PlannedWorkout[] = [];

  // Build phase: 60% easy, 20% tempo/intervals, 20% long
  const workoutDays = selectWorkoutDays(daysPerWeek, 'build');

  workoutDays.forEach((day, index) => {
    const date = addDays(startDate, day);

    if (index === 0 && !isRecoveryWeek) {
      // Tempo workout early in week
      const duration = Math.round(weeklyMinutes * 0.2);
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'TEMPO',
        name: `Tempo ${getSportName(sport)}`,
        duration,
        distance: estimateDistance(sport, duration, 'tempo'),
        description: 'Sustained threshold effort to build lactate clearance',
        intensity: 'high',
      });
    } else if (index === Math.floor(workoutDays.length / 2) && !isRecoveryWeek) {
      // Interval workout mid-week
      const duration = Math.round(weeklyMinutes * 0.2);
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'INTERVAL',
        name: `Intervals`,
        duration,
        distance: estimateDistance(sport, duration, 'interval'),
        description: 'High-intensity intervals to build VO2max',
        intensity: 'high',
      });
    } else if (index === workoutDays.length - 1) {
      // Long workout on weekend
      const duration = Math.round(weeklyMinutes * 0.25);
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'LONG',
        name: `Long ${getSportName(sport)}`,
        duration,
        distance: estimateDistance(sport, duration, 'easy'),
        description: 'Extended endurance at moderate pace',
        intensity: 'moderate',
      });
    } else {
      // Easy recovery workouts
      const remainingMinutes = weeklyMinutes * 0.35;
      const easyWorkoutCount = workoutDays.length - 3;
      const duration = Math.round(remainingMinutes / Math.max(1, easyWorkoutCount));
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'EASY',
        name: `Easy ${getSportName(sport)}`,
        duration,
        distance: estimateDistance(sport, duration, 'easy'),
        description: 'Recovery pace to absorb training load',
        intensity: 'low',
      });
    }
  });

  return {
    weekNumber,
    startDate,
    phase: 'build',
    focus: isRecoveryWeek ? 'Recovery Week' : 'Building Speed & Endurance',
    volume: Math.round(volumeMultiplier * 100),
    workouts,
  };
}

/**
 * Generate Peak Phase week
 */
function generatePeakWeek(
  weekNumber: number,
  startDate: Date,
  sport: Sport,
  daysPerWeek: number,
  hoursPerWeek: number,
  fitnessLevel: string,
  weekInPhase: number
): TrainingWeek {
  const volumeMultiplier = 1.0;
  const weeklyMinutes = hoursPerWeek * 60 * volumeMultiplier;
  const workouts: PlannedWorkout[] = [];

  // Peak phase: Race-specific training
  const workoutDays = selectWorkoutDays(daysPerWeek, 'peak');

  workoutDays.forEach((day, index) => {
    const date = addDays(startDate, day);

    if (index === 0) {
      // Race-pace intervals
      const duration = Math.round(weeklyMinutes * 0.25);
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'INTERVAL',
        name: `Race Pace Intervals`,
        duration,
        distance: estimateDistance(sport, duration, 'interval'),
        description: 'Intervals at goal race pace',
        intensity: 'high',
      });
    } else if (index === Math.floor(workoutDays.length / 2)) {
      // Tempo at race pace
      const duration = Math.round(weeklyMinutes * 0.25);
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'TEMPO',
        name: `Race Pace Tempo`,
        duration,
        distance: estimateDistance(sport, duration, 'tempo'),
        description: 'Sustained effort at race pace',
        intensity: 'high',
      });
    } else if (index === workoutDays.length - 1) {
      // Long run with race pace segments
      const duration = Math.round(weeklyMinutes * 0.3);
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'LONG',
        name: `Long Run with Race Pace`,
        duration,
        distance: estimateDistance(sport, duration, 'easy'),
        description: 'Long endurance with race pace segments',
        intensity: 'moderate',
      });
    } else {
      // Easy recovery
      const remainingMinutes = weeklyMinutes * 0.2;
      const easyCount = workoutDays.length - 3;
      const duration = Math.round(remainingMinutes / Math.max(1, easyCount));
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'RECOVERY',
        name: `Recovery ${getSportName(sport)}`,
        duration,
        distance: estimateDistance(sport, duration, 'recovery'),
        description: 'Very easy recovery pace',
        intensity: 'low',
      });
    }
  });

  return {
    weekNumber,
    startDate,
    phase: 'peak',
    focus: 'Race-Specific Training',
    volume: 100,
    workouts,
  };
}

/**
 * Generate Taper Phase week
 */
function generateTaperWeek(
  weekNumber: number,
  startDate: Date,
  sport: Sport,
  daysPerWeek: number,
  hoursPerWeek: number,
  weekInTaper: number,
  isRaceWeek: boolean
): TrainingWeek {
  const volumeMultiplier = isRaceWeek ? 0.3 : 0.6;
  const weeklyMinutes = hoursPerWeek * 60 * volumeMultiplier;
  const workouts: PlannedWorkout[] = [];

  const workoutDays = isRaceWeek
    ? [0, 2, 6] // Sun, Tue, Sat (race day)
    : selectWorkoutDays(Math.max(3, daysPerWeek - 1), 'taper');

  workoutDays.forEach((day, index) => {
    const date = addDays(startDate, day);

    if (isRaceWeek && index === workoutDays.length - 1) {
      // Race day!
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'RACE',
        name: '🏁 Race Day!',
        duration: 0,
        description: 'Your target race - give it your best!',
        intensity: 'high',
      });
    } else if (index === 0 && !isRaceWeek) {
      // Short tempo to maintain sharpness
      const duration = Math.round(weeklyMinutes * 0.3);
      workouts.push({
        dayOfWeek: day,
        date,
        type: 'TEMPO',
        name: `Short Tempo`,
        duration,
        distance: estimateDistance(sport, duration, 'tempo'),
        description: 'Brief tempo to maintain fitness',
        intensity: 'moderate',
      });
    } else {
      // Easy recovery workouts
      const duration = Math.round((weeklyMinutes * 0.7) / (workoutDays.length - 1));
      workouts.push({
        dayOfWeek: day,
        date,
        type: isRaceWeek ? 'RECOVERY' : 'EASY',
        name: `${isRaceWeek ? 'Recovery' : 'Easy'} ${getSportName(sport)}`,
        duration,
        distance: estimateDistance(sport, duration, 'easy'),
        description: isRaceWeek
          ? 'Very easy - stay fresh for race'
          : 'Easy pace to maintain fitness',
        intensity: 'low',
      });
    }
  });

  return {
    weekNumber,
    startDate,
    phase: isRaceWeek ? 'race' : 'taper',
    focus: isRaceWeek ? 'Race Week' : 'Taper & Recovery',
    volume: Math.round(volumeMultiplier * 100),
    workouts,
  };
}

/**
 * Select workout days based on days per week and phase
 */
function selectWorkoutDays(daysPerWeek: number, phase: string): number[] {
  // Common patterns: rest on Monday (1), workout Sun/Tue/Thu/Sat or similar
  const patterns: { [key: number]: number[] } = {
    3: [0, 3, 6], // Sun, Wed, Sat
    4: [0, 2, 4, 6], // Sun, Tue, Thu, Sat
    5: [0, 2, 3, 5, 6], // Sun, Tue, Wed, Fri, Sat
    6: [0, 1, 2, 4, 5, 6], // All except Wednesday
    7: [0, 1, 2, 3, 4, 5, 6], // Every day
  };

  return patterns[Math.min(daysPerWeek, 7)] || patterns[4];
}

/**
 * Estimate distance based on sport, duration, and intensity
 */
function estimateDistance(
  sport: Sport,
  durationMinutes: number,
  intensity: string
): number {
  const hours = durationMinutes / 60;

  switch (sport) {
    case 'RUNNING':
      if (intensity === 'easy' || intensity === 'recovery') return hours * 9;
      if (intensity === 'tempo') return hours * 11;
      if (intensity === 'interval') return hours * 10;
      return hours * 10;

    case 'CYCLING':
      if (intensity === 'easy' || intensity === 'recovery') return hours * 25;
      if (intensity === 'tempo') return hours * 30;
      if (intensity === 'interval') return hours * 28;
      return hours * 27;

    case 'SWIMMING':
      if (intensity === 'easy' || intensity === 'recovery') return hours * 2;
      if (intensity === 'tempo') return hours * 2.5;
      return hours * 2.2;

    default:
      return 0;
  }
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
      return 'Triathlon';
    default:
      return 'Workout';
  }
}

function getRaceDistanceName(distance?: number): string {
  if (!distance) return 'Event';

  if (distance <= 5) return '5K';
  if (distance <= 10) return '10K';
  if (distance <= 21.1) return 'Half Marathon';
  if (distance <= 42.2) return 'Marathon';
  if (distance <= 50) return '50K';
  if (distance <= 100) return '100K';
  return 'Ultra';
}

function calculatePlanSummary(weeks: TrainingWeek[], phases: any) {
  const totalWorkouts = weeks.reduce((sum, week) => sum + week.workouts.length, 0);
  const totalHours = weeks.reduce((sum, week) => {
    const weekMinutes = week.workouts.reduce((s, w) => s + w.duration, 0);
    return sum + weekMinutes / 60;
  }, 0);

  return {
    totalWorkouts,
    totalHours: Math.round(totalHours),
    baseWeeks: phases.base,
    buildWeeks: phases.build,
    peakWeeks: phases.peak,
    taperWeeks: phases.taper,
  };
}
