/**
 * Plan Modification Engine
 *
 * Applies adaptation recommendations to training plan structure.
 * Handles different modification types and preserves plan integrity.
 */

import { addDays, subDays, format } from 'date-fns';

export interface PlanModification {
  type:
    | 'REDUCE_LOAD'
    | 'INCREASE_LOAD'
    | 'EXTEND_RECOVERY'
    | 'RESCHEDULE_WORKOUT'
    | 'CHANGE_INTENSITY'
    | 'SWAP_WORKOUT_TYPE'
    | 'INSERT_REST_DAY'
    | 'SHIFT_SCHEDULE'
    | 'REPERIODIZE';
  target: {
    weekNumber?: number;
    date?: Date;
    workoutId?: string;
  };
  change: {
    before: any;
    after: any;
  };
  rationale: string;
}

export interface TrainingPlanData {
  name: string;
  description: string;
  goal: string;
  sport: string;
  startDate: Date;
  raceDate: Date;
  totalWeeks: number;
  weeks: Array<{
    weekNumber: number;
    startDate: Date;
    workouts: Array<{
      id: string;
      date: Date;
      type: string;
      duration: number;
      description: string;
      structure?: any;
    }>;
    targetLoad: number;
    theme: string;
  }>;
}

/**
 * Apply a single modification to plan data
 */
function applyModification(
  planData: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  const modifiedPlan = JSON.parse(JSON.stringify(planData)); // Deep clone

  switch (modification.type) {
    case 'REDUCE_LOAD':
      return reduceLoad(modifiedPlan, modification);

    case 'INCREASE_LOAD':
      return increaseLoad(modifiedPlan, modification);

    case 'EXTEND_RECOVERY':
      return extendRecovery(modifiedPlan, modification);

    case 'RESCHEDULE_WORKOUT':
      return rescheduleWorkout(modifiedPlan, modification);

    case 'CHANGE_INTENSITY':
      return changeIntensity(modifiedPlan, modification);

    case 'SWAP_WORKOUT_TYPE':
      return swapWorkoutType(modifiedPlan, modification);

    case 'INSERT_REST_DAY':
      return insertRestDay(modifiedPlan, modification);

    case 'SHIFT_SCHEDULE':
      return shiftSchedule(modifiedPlan, modification);

    case 'REPERIODIZE':
      return reperiodize(modifiedPlan, modification);

    default:
      console.warn(`Unknown modification type: ${modification.type}`);
      return modifiedPlan;
  }
}

/**
 * Reduce training load for a week or entire plan
 */
function reduceLoad(
  plan: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  const percentage = parsePercentage(modification.change.after?.load) || 0.7; // Default 30% reduction
  const weekNumber = modification.target.weekNumber;

  if (weekNumber) {
    // Reduce specific week
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (week) {
      week.targetLoad = Math.round(week.targetLoad * percentage);
      week.workouts.forEach((workout) => {
        workout.duration = Math.round(workout.duration * percentage);
        if (workout.description.includes('high intensity')) {
          workout.description = workout.description.replace('high intensity', 'moderate intensity');
        }
      });
    }
  } else {
    // Reduce all remaining weeks
    const today = new Date();
    plan.weeks.forEach((week) => {
      if (week.startDate >= today) {
        week.targetLoad = Math.round(week.targetLoad * percentage);
        week.workouts.forEach((workout) => {
          workout.duration = Math.round(workout.duration * percentage);
        });
      }
    });
  }

  return plan;
}

/**
 * Increase training load
 */
function increaseLoad(
  plan: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  const percentage = parsePercentage(modification.change.after?.load) || 1.15; // Default 15% increase
  const weekNumber = modification.target.weekNumber;

  if (weekNumber) {
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (week) {
      week.targetLoad = Math.round(week.targetLoad * percentage);
      week.workouts.forEach((workout) => {
        workout.duration = Math.round(workout.duration * percentage);
      });
    }
  }

  return plan;
}

/**
 * Extend recovery period
 */
function extendRecovery(
  plan: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  const weekNumber = modification.target.weekNumber || 1;
  const week = plan.weeks.find((w) => w.weekNumber === weekNumber);

  if (week) {
    // Convert hard workouts to easy/recovery
    week.workouts.forEach((workout) => {
      if (['INTERVAL', 'TEMPO', 'LONG'].includes(workout.type)) {
        workout.type = 'RECOVERY';
        workout.duration = Math.round(workout.duration * 0.5);
        workout.description = `Easy recovery - ${workout.description.split('-')[1] || ''}`;
      }
    });

    week.targetLoad = Math.round(week.targetLoad * 0.5);
    week.theme = 'Recovery Week';
  }

  return plan;
}

/**
 * Reschedule a workout to a different date
 */
function rescheduleWorkout(
  plan: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  const workoutId = modification.target.workoutId;
  const newDate = modification.change.after?.date;

  if (!workoutId || !newDate) {
    return plan;
  }

  // Find workout in any week
  for (const week of plan.weeks) {
    const workoutIndex = week.workouts.findIndex((w) => w.id === workoutId);
    if (workoutIndex >= 0) {
      const workout = week.workouts[workoutIndex];
      const targetDate = new Date(newDate);

      // Find target week for new date
      const targetWeek = plan.weeks.find(
        (w) =>
          targetDate >= w.startDate &&
          targetDate < addDays(w.startDate, 7)
      );

      if (targetWeek) {
        // Remove from original week
        week.workouts.splice(workoutIndex, 1);

        // Add to target week
        workout.date = targetDate;
        targetWeek.workouts.push(workout);
        targetWeek.workouts.sort((a, b) => a.date.getTime() - b.date.getTime());
      }

      break;
    }
  }

  return plan;
}

/**
 * Change workout intensity zones
 */
function changeIntensity(
  plan: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  const weekNumber = modification.target.weekNumber;
  const targetIntensity = modification.change.after?.intensity;

  if (weekNumber) {
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
    if (week && targetIntensity) {
      week.workouts.forEach((workout) => {
        if (targetIntensity.toLowerCase().includes('easy')) {
          if (!['RECOVERY', 'EASY'].includes(workout.type)) {
            workout.type = 'EASY';
            workout.description = `Easy - ${workout.description.split('-')[1] || ''}`;
          }
        }
      });
    }
  }

  return plan;
}

/**
 * Swap workout type (e.g., INTERVAL → RECOVERY)
 */
function swapWorkoutType(
  plan: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  const workoutId = modification.target.workoutId;
  const date = modification.target.date;
  const newType = modification.change.after?.type;

  if (!newType) {
    return plan;
  }

  for (const week of plan.weeks) {
    let workout;

    if (workoutId) {
      workout = week.workouts.find((w) => w.id === workoutId);
    } else if (date) {
      workout = week.workouts.find(
        (w) =>
          format(w.date, 'yyyy-MM-dd') ===
          format(new Date(date), 'yyyy-MM-dd')
      );
    }

    if (workout) {
      const oldType = workout.type;
      workout.type = newType;

      // Adjust duration based on type change
      if (newType === 'RECOVERY' && oldType !== 'RECOVERY') {
        workout.duration = Math.round(workout.duration * 0.6);
      } else if (oldType === 'RECOVERY' && newType !== 'RECOVERY') {
        workout.duration = Math.round(workout.duration * 1.5);
      }

      workout.description = `${newType} - Swapped from ${oldType}`;
      break;
    }
  }

  return plan;
}

/**
 * Insert a rest day
 */
function insertRestDay(
  plan: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  const date = modification.target.date;

  if (!date) {
    return plan;
  }

  const targetDate = new Date(date);
  const targetWeek = plan.weeks.find(
    (w) =>
      targetDate >= w.startDate &&
      targetDate < addDays(w.startDate, 7)
  );

  if (targetWeek) {
    // Remove any existing workout on this date
    targetWeek.workouts = targetWeek.workouts.filter(
      (w) =>
        format(w.date, 'yyyy-MM-dd') !==
        format(targetDate, 'yyyy-MM-dd')
    );

    // Reduce target load
    targetWeek.targetLoad = Math.round(targetWeek.targetLoad * 0.9);
  }

  return plan;
}

/**
 * Shift entire schedule forward/backward
 */
function shiftSchedule(
  plan: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  const days = modification.change.after?.shiftDays || 0;

  if (days === 0) {
    return plan;
  }

  // Shift all dates
  plan.startDate = addDays(plan.startDate, days);
  plan.raceDate = addDays(plan.raceDate, days);

  plan.weeks.forEach((week) => {
    week.startDate = addDays(week.startDate, days);
    week.workouts.forEach((workout) => {
      workout.date = addDays(workout.date, days);
    });
  });

  return plan;
}

/**
 * Major restructuring of plan phases
 */
function reperiodize(
  plan: TrainingPlanData,
  modification: PlanModification
): TrainingPlanData {
  // This is complex - for now, just update description
  plan.description = `${plan.description} (Reperiodized: ${modification.rationale})`;

  // TODO: Implement full reperiodization logic
  // - Recalculate phase lengths
  // - Redistribute workouts
  // - Adjust load progression

  return plan;
}

/**
 * Helper: Parse percentage from string like "60-70%" or 0.7
 */
function parsePercentage(value: any): number | null {
  if (typeof value === 'number') {
    return value > 1 ? value / 100 : value;
  }

  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) {
      return parseInt(match[1]) / 100;
    }
  }

  return null;
}

/**
 * Main entry point: Apply all modifications to a plan
 */
export function applyModificationsToPlan(
  planData: TrainingPlanData,
  modifications: PlanModification[]
): TrainingPlanData {
  let modifiedPlan = planData;

  for (const modification of modifications) {
    try {
      modifiedPlan = applyModification(modifiedPlan, modification);
    } catch (error: any) {
      console.error(
        `Error applying modification ${modification.type}:`,
        error
      );
      // Continue with other modifications
    }
  }

  return modifiedPlan;
}

/**
 * Create a backup of plan data before modifications
 */
export function createPlanBackup(planData: any): any {
  return JSON.parse(JSON.stringify(planData));
}

/**
 * Restore plan from backup
 */
export function restorePlanFromBackup(backup: any): any {
  return JSON.parse(JSON.stringify(backup));
}
