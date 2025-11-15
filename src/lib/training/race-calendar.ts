/**
 * Race Calendar & Taper Planning Module
 *
 * Manages race schedules and generates taper recommendations:
 * - Race tracking and prioritization
 * - Taper period calculation based on race distance/importance
 * - Training plan integration with race peaks
 * - Race-specific workout recommendations
 */

import { Sport } from '@prisma/client';
import { addDays, differenceInDays, differenceInWeeks, format } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

export type RacePriority = 'A' | 'B' | 'C';
export type RaceDistance = '5K' | '10K' | 'HALF_MARATHON' | 'MARATHON' | 'ULTRA' | 'SPRINT' | 'OLYMPIC' | 'HALF_IM' | 'IRONMAN' | 'CUSTOM';

export interface Race {
  id: string;
  name: string;
  date: Date;
  sport: Sport;
  distance: RaceDistance;
  customDistance?: number; // km for CUSTOM races
  priority: RacePriority;
  location?: string;
  notes?: string;
  goalTime?: string; // e.g., "3:30:00" for marathon
}

export interface TaperPlan {
  race: Race;
  taperStart: Date;
  taperDuration: number; // days
  phases: TaperPhase[];
  weeklyVolumeReductions: Array<{
    week: number;
    reductionPercent: number;
    targetVolume: number; // minutes
  }>;
  recommendations: string[];
}

export interface TaperPhase {
  name: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  volumeReduction: number; // percent
  intensityAdjustment: 'maintain' | 'reduce' | 'sharpen';
  focus: string[];
}

export interface RacePeakPlan {
  race: Race;
  buildPhase: {
    start: Date;
    end: Date;
    focus: string;
    weeklyVolume: number; // minutes
  };
  peakPhase: {
    start: Date;
    end: Date;
    focus: string;
    weeklyVolume: number; // minutes
  };
  taperPhase: TaperPlan;
  raceWeek: {
    recommendations: string[];
    lastWorkout: Date;
    lastHardEffort: Date;
  };
}

// ============================================================================
// RACE CALENDAR MANAGEMENT
// ============================================================================

/**
 * Sort races by date (earliest first)
 */
export function sortRaces(races: Race[]): Race[] {
  return [...races].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get upcoming races (future dates only)
 */
export function getUpcomingRaces(races: Race[], referenceDate: Date = new Date()): Race[] {
  return races.filter((race) => race.date > referenceDate).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get primary race (next A-priority race)
 */
export function getPrimaryRace(races: Race[], referenceDate: Date = new Date()): Race | null {
  const upcoming = getUpcomingRaces(races, referenceDate);
  const aPriority = upcoming.filter((r) => r.priority === 'A');
  return aPriority.length > 0 ? aPriority[0] : (upcoming.length > 0 ? upcoming[0] : null);
}

/**
 * Calculate weeks until race
 */
export function weeksUntilRace(race: Race, referenceDate: Date = new Date()): number {
  return differenceInWeeks(race.date, referenceDate);
}

/**
 * Calculate days until race
 */
export function daysUntilRace(race: Race, referenceDate: Date = new Date()): number {
  return differenceInDays(race.date, referenceDate);
}

// ============================================================================
// TAPER PLANNING
// ============================================================================

/**
 * Calculate recommended taper duration based on race distance and priority
 */
export function calculateTaperDuration(race: Race): number {
  // Taper duration in days
  const baseDuration: Record<RaceDistance, number> = {
    '5K': 3,
    '10K': 5,
    'HALF_MARATHON': 7,
    'MARATHON': 14,
    'ULTRA': 21,
    'SPRINT': 3,
    'OLYMPIC': 5,
    'HALF_IM': 10,
    'IRONMAN': 21,
    'CUSTOM': 7,
  };

  let duration = baseDuration[race.distance];

  // Adjust for priority
  if (race.priority === 'A') {
    duration = Math.round(duration * 1.2); // 20% longer taper for A races
  } else if (race.priority === 'C') {
    duration = Math.round(duration * 0.7); // 30% shorter taper for C races
  }

  return duration;
}

/**
 * Generate detailed taper plan for a race
 */
export function generateTaperPlan(race: Race, baselineWeeklyVolume: number): TaperPlan {
  const taperDuration = calculateTaperDuration(race);
  const taperStart = addDays(race.date, -taperDuration);

  const phases: TaperPhase[] = [];
  const weeklyVolumeReductions: TaperPlan['weeklyVolumeReductions'] = [];
  const recommendations: string[] = [];

  // Phase 1: Early taper (first half) - moderate volume reduction
  const phase1Duration = Math.ceil(taperDuration / 2);
  const phase1End = addDays(taperStart, phase1Duration);

  phases.push({
    name: 'Early Taper',
    startDate: taperStart,
    endDate: phase1End,
    durationDays: phase1Duration,
    volumeReduction: 20,
    intensityAdjustment: 'maintain',
    focus: ['Maintain intensity', 'Reduce volume gradually', 'Focus on quality over quantity'],
  });

  // Phase 2: Late taper (second half) - significant volume reduction
  const phase2Duration = taperDuration - phase1Duration;
  const phase2End = addDays(phase1End, phase2Duration - 1); // -1 to account for race day

  phases.push({
    name: 'Late Taper',
    startDate: addDays(phase1End, 1),
    endDate: phase2End,
    durationDays: phase2Duration,
    volumeReduction: 40,
    intensityAdjustment: 'sharpen',
    focus: ['Sharpen with short efforts', 'Significant volume reduction', 'Prioritize rest and recovery'],
  });

  // Calculate weekly volume reductions
  const weeksInTaper = Math.ceil(taperDuration / 7);
  for (let week = 1; week <= weeksInTaper; week++) {
    const reductionPercent = 20 + (week - 1) * 15; // Progressive reduction
    const targetVolume = Math.round(baselineWeeklyVolume * (1 - reductionPercent / 100));

    weeklyVolumeReductions.push({
      week,
      reductionPercent: Math.min(reductionPercent, 60), // Cap at 60% reduction
      targetVolume: Math.max(targetVolume, baselineWeeklyVolume * 0.4), // Min 40% of baseline
    });
  }

  // Generate recommendations
  recommendations.push(`Start taper ${taperDuration} days before race on ${format(taperStart, 'MMM d, yyyy')}`);
  recommendations.push('Reduce training volume progressively while maintaining intensity');
  recommendations.push('Prioritize sleep (aim for 8-9 hours per night)');
  recommendations.push('Stay hydrated and focus on nutrition');

  if (race.priority === 'A') {
    recommendations.push('This is an A-priority race - optimize all aspects of taper');
    recommendations.push('Consider a shakeout run 1-2 days before race');
  }

  if (['MARATHON', 'ULTRA', 'HALF_IM', 'IRONMAN'].includes(race.distance)) {
    recommendations.push('Practice race-day nutrition and hydration strategy');
    recommendations.push('Avoid trying anything new in final 2 weeks');
  }

  return {
    race,
    taperStart,
    taperDuration,
    phases,
    weeklyVolumeReductions,
    recommendations,
  };
}

// ============================================================================
// RACE PEAK PLANNING
// ============================================================================

/**
 * Generate comprehensive peak plan for a race (build + peak + taper)
 */
export function generateRacePeakPlan(
  race: Race,
  currentWeeklyVolume: number,
  weeksAvailable: number
): RacePeakPlan {
  const taperPlan = generateTaperPlan(race, currentWeeklyVolume);
  const taperWeeks = Math.ceil(taperPlan.taperDuration / 7);

  // Allocate remaining weeks to build and peak phases
  const remainingWeeks = weeksAvailable - taperWeeks;
  const buildWeeks = Math.ceil(remainingWeeks * 0.7); // 70% for build
  const peakWeeks = remainingWeeks - buildWeeks; // 30% for peak

  const buildStart = addDays(race.date, -weeksAvailable * 7);
  const buildEnd = addDays(buildStart, buildWeeks * 7);
  const peakStart = addDays(buildEnd, 1);
  const peakEnd = addDays(taperPlan.taperStart, -1);

  // Calculate target volumes
  const peakVolume = currentWeeklyVolume * 1.2; // 20% increase at peak

  // Race week recommendations
  const lastWorkout = addDays(race.date, -2); // 2 days before race
  const lastHardEffort = addDays(race.date, -5); // 5 days before race

  const raceWeekRecommendations: string[] = [];

  if (race.priority === 'A') {
    raceWeekRecommendations.push('Minimize stress and prioritize rest');
    raceWeekRecommendations.push('Stay off your feet when possible');
    raceWeekRecommendations.push('Trust your training - no last-minute heroics');
  }

  raceWeekRecommendations.push(`Last workout: ${format(lastWorkout, 'EEEE, MMM d')} (short, easy)`);
  raceWeekRecommendations.push(`Last hard effort: ${format(lastHardEffort, 'EEEE, MMM d')} (brief intensity)`);
  raceWeekRecommendations.push('Review race strategy and pacing plan');
  raceWeekRecommendations.push('Prepare gear and nutrition the night before');

  return {
    race,
    buildPhase: {
      start: buildStart,
      end: buildEnd,
      focus: 'Build endurance and strength progressively',
      weeklyVolume: currentWeeklyVolume,
    },
    peakPhase: {
      start: peakStart,
      end: peakEnd,
      focus: 'Achieve peak fitness with race-specific intensity',
      weeklyVolume: peakVolume,
    },
    taperPhase: taperPlan,
    raceWeek: {
      recommendations: raceWeekRecommendations,
      lastWorkout,
      lastHardEffort,
    },
  };
}

// ============================================================================
// RACE-SPECIFIC RECOMMENDATIONS
// ============================================================================

/**
 * Get race-specific training focus based on distance and sport
 */
export function getRaceTrainingFocus(race: Race): string[] {
  const focus: string[] = [];

  // Distance-specific focus
  switch (race.distance) {
    case '5K':
    case '10K':
      focus.push('VO2max intervals');
      focus.push('Lactate threshold work');
      focus.push('Speed endurance');
      break;

    case 'HALF_MARATHON':
      focus.push('Tempo runs at race pace');
      focus.push('Long runs with race-pace segments');
      focus.push('Lactate threshold intervals');
      break;

    case 'MARATHON':
    case 'ULTRA':
      focus.push('Long endurance runs');
      focus.push('Race-pace practice');
      focus.push('Nutrition and fueling strategy');
      focus.push('Mental resilience training');
      break;

    case 'SPRINT':
    case 'OLYMPIC':
      focus.push('Brick workouts (bike-run transitions)');
      focus.push('Open water swimming');
      focus.push('High-intensity interval training');
      break;

    case 'HALF_IM':
    case 'IRONMAN':
      focus.push('Long endurance sessions');
      focus.push('Brick workouts');
      focus.push('Pacing discipline');
      focus.push('Nutrition and hydration strategy');
      focus.push('Mental preparation');
      break;
  }

  // Sport-specific additions
  if (race.sport === 'TRIATHLON') {
    focus.push('Transition practice');
    focus.push('Multi-sport endurance');
  }

  return focus;
}

/**
 * Calculate ideal race pacing strategy
 */
export function calculateRacePacing(race: Race, goalTime?: string): {
  strategy: string;
  splits: Array<{ segment: string; pace: string; effort: string }>;
} {
  const strategies: Record<RaceDistance, string> = {
    '5K': 'Evenly paced with slight negative split',
    '10K': 'Conservative first 2K, then settle into race pace',
    'HALF_MARATHON': 'Even pacing, save energy for final 5K',
    'MARATHON': 'Conservative first half, steady second half (negative split)',
    'ULTRA': 'Very conservative start, maintain steady effort, finish strong',
    'SPRINT': 'All-out effort with efficient transitions',
    'OLYMPIC': 'Controlled swim, steady bike, strong run',
    'HALF_IM': 'Controlled swim, disciplined bike (70%), strong run',
    'IRONMAN': 'Easy swim, very disciplined bike (60-65%), survive the run',
    'CUSTOM': 'Even effort throughout',
  };

  const strategy = strategies[race.distance];
  const splits: Array<{ segment: string; pace: string; effort: string }> = [];

  // Generate example splits based on race type
  if (race.distance === 'MARATHON' && goalTime) {
    const [hours, minutes, seconds] = goalTime.split(':').map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const avgPacePerKm = totalSeconds / 42.195;

    splits.push(
      { segment: 'First Half', pace: `${Math.floor((avgPacePerKm * 1.02) / 60)}:${Math.floor((avgPacePerKm * 1.02) % 60).toString().padStart(2, '0')}/km`, effort: '80-85% max HR' },
      { segment: 'Second Half', pace: `${Math.floor((avgPacePerKm * 0.98) / 60)}:${Math.floor((avgPacePerKm * 0.98) % 60).toString().padStart(2, '0')}/km`, effort: '85-90% max HR' },
      { segment: 'Final 10K', pace: `${Math.floor(avgPacePerKm / 60)}:${Math.floor(avgPacePerKm % 60).toString().padStart(2, '0')}/km`, effort: '90-95% max HR' }
    );
  }

  return { strategy, splits };
}

// ============================================================================
// INTEGRATION WITH TRAINING PLANS
// ============================================================================

/**
 * Determine if a date falls within a taper period
 */
export function isInTaperPeriod(date: Date, race: Race): boolean {
  const taperDuration = calculateTaperDuration(race);
  const taperStart = addDays(race.date, -taperDuration);
  return date >= taperStart && date <= race.date;
}

/**
 * Get volume adjustment factor for a date based on race calendar
 */
export function getVolumeAdjustmentFactor(date: Date, races: Race[]): number {
  // Find races that this date might be tapering for
  const relevantRaces = races.filter((race) => isInTaperPeriod(date, race));

  if (relevantRaces.length === 0) return 1.0; // No adjustment

  // Use the most restrictive taper (earliest race)
  const nearestRace = relevantRaces.sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const daysUntil = daysUntilRace(nearestRace, date);
  const taperDuration = calculateTaperDuration(nearestRace);

  // Linear volume reduction over taper period
  const reductionPercent = 60 * (1 - daysUntil / taperDuration); // Up to 60% reduction
  return 1 - reductionPercent / 100;
}
