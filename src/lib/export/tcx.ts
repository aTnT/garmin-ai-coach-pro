/**
 * TCX (Training Center XML) Export
 *
 * Export workouts to TCX format compatible with:
 * - Garmin Connect
 * - Garmin Devices (watches, bike computers)
 * - Strava
 * - TrainingPeaks
 * - Wahoo
 *
 * TCX is an XML-based format standardized by Garmin for workout data exchange.
 */

import { format } from 'date-fns';

export interface TCXWorkout {
  id: string;
  name: string;
  sport: 'Running' | 'Biking' | 'Swimming' | 'Other';
  date: Date;
  duration: number; // seconds
  distance?: number; // meters
  steps: TCXStep[];
  notes?: string;
}

export interface TCXStep {
  type: 'warmup' | 'cooldown' | 'active' | 'rest' | 'repeat';
  duration: {
    type: 'time' | 'distance' | 'lap';
    value?: number; // seconds or meters
  };
  target?: {
    type: 'heartrate' | 'pace' | 'power' | 'cadence' | 'none';
    min?: number;
    max?: number;
    value?: number;
  };
  intensity: 'active' | 'resting';
  repetitions?: number; // For repeat steps
  children?: TCXStep[]; // For repeat blocks
}

/**
 * Convert workout type to TCX sport
 */
function getSportType(sport: string): string {
  const sportMap: Record<string, string> = {
    RUNNING: 'Running',
    CYCLING: 'Biking',
    SWIMMING: 'Swimming',
    TRIATHLON: 'Other',
    OTHER: 'Other',
  };

  return sportMap[sport] || 'Other';
}

/**
 * Format date to TCX timestamp (ISO 8601 with timezone)
 */
function formatTCXDate(date: Date): string {
  return date.toISOString();
}

/**
 * Convert workout structure to TCX steps
 */
function convertToTCXSteps(structure: any, workoutType: string): TCXStep[] {
  const steps: TCXStep[] = [];

  // If structure has intervals array
  if (structure?.intervals && Array.isArray(structure.intervals)) {
    for (const interval of structure.intervals) {
      const step: TCXStep = {
        type: determineStepType(interval.type || interval.description),
        duration: {
          type: 'time',
          value: (interval.duration || 10) * 60, // Convert minutes to seconds
        },
        intensity: interval.type?.toLowerCase().includes('rest') ? 'resting' : 'active',
      };

      // Add target zones if specified
      if (interval.zone || interval.pace) {
        step.target = {
          type: 'heartrate',
          min: interval.zone?.min || undefined,
          max: interval.zone?.max || undefined,
        };
      }

      steps.push(step);
    }
  } else {
    // Fallback: Create simple structure based on workout type
    steps.push(...generateDefaultSteps(workoutType));
  }

  return steps;
}

/**
 * Determine TCX step type from description
 */
function determineStepType(description: string): TCXStep['type'] {
  const lower = description.toLowerCase();

  if (lower.includes('warm') || lower.includes('warmup')) return 'warmup';
  if (lower.includes('cool') || lower.includes('cooldown')) return 'cooldown';
  if (lower.includes('rest') || lower.includes('recovery')) return 'rest';
  if (lower.includes('repeat')) return 'repeat';

  return 'active';
}

/**
 * Generate default TCX steps for workout types
 */
function generateDefaultSteps(workoutType: string): TCXStep[] {
  const steps: TCXStep[] = [];

  switch (workoutType) {
    case 'INTERVAL':
      steps.push(
        {
          type: 'warmup',
          duration: { type: 'time', value: 600 }, // 10 min
          intensity: 'active',
        },
        {
          type: 'repeat',
          duration: { type: 'lap' },
          intensity: 'active',
          repetitions: 6,
          children: [
            {
              type: 'active',
              duration: { type: 'time', value: 300 }, // 5 min
              intensity: 'active',
              target: { type: 'heartrate', min: 160, max: 175 },
            },
            {
              type: 'rest',
              duration: { type: 'time', value: 180 }, // 3 min
              intensity: 'resting',
            },
          ],
        },
        {
          type: 'cooldown',
          duration: { type: 'time', value: 600 }, // 10 min
          intensity: 'active',
        }
      );
      break;

    case 'TEMPO':
      steps.push(
        {
          type: 'warmup',
          duration: { type: 'time', value: 900 }, // 15 min
          intensity: 'active',
        },
        {
          type: 'active',
          duration: { type: 'time', value: 1800 }, // 30 min
          intensity: 'active',
          target: { type: 'heartrate', min: 155, max: 170 },
        },
        {
          type: 'cooldown',
          duration: { type: 'time', value: 900 }, // 15 min
          intensity: 'active',
        }
      );
      break;

    case 'LONG':
    case 'EASY':
      steps.push({
        type: 'active',
        duration: { type: 'time', value: 3600 }, // 60 min
        intensity: 'active',
        target: { type: 'heartrate', min: 130, max: 150 },
      });
      break;

    case 'RECOVERY':
      steps.push({
        type: 'active',
        duration: { type: 'time', value: 1800 }, // 30 min
        intensity: 'active',
        target: { type: 'heartrate', min: 110, max: 130 },
      });
      break;

    default:
      steps.push({
        type: 'active',
        duration: { type: 'time', value: 3600 }, // 60 min
        intensity: 'active',
      });
  }

  return steps;
}

/**
 * Generate TCX XML for a single step
 */
function generateStepXML(step: TCXStep, stepId: number): string {
  let xml = `        <Step xsi:type="Step_t">\n`;
  xml += `          <StepId>${stepId}</StepId>\n`;

  // Duration
  if (step.duration.type === 'time' && step.duration.value) {
    xml += `          <Duration xsi:type="Time_t">\n`;
    xml += `            <Seconds>${step.duration.value}</Seconds>\n`;
    xml += `          </Duration>\n`;
  } else if (step.duration.type === 'distance' && step.duration.value) {
    xml += `          <Duration xsi:type="Distance_t">\n`;
    xml += `            <Meters>${step.duration.value}</Meters>\n`;
    xml += `          </Duration>\n`;
  } else {
    xml += `          <Duration xsi:type="Lap_Button_t"/>\n`;
  }

  // Intensity
  xml += `          <Intensity>${step.intensity === 'active' ? 'Active' : 'Resting'}</Intensity>\n`;

  // Target
  if (step.target) {
    if (step.target.type === 'heartrate' && step.target.min && step.target.max) {
      xml += `          <Target xsi:type="HeartRate_t">\n`;
      xml += `            <HeartRateZone xsi:type="CustomHeartRateZone_t">\n`;
      xml += `              <Low>${step.target.min}</Low>\n`;
      xml += `              <High>${step.target.max}</High>\n`;
      xml += `            </HeartRateZone>\n`;
      xml += `          </Target>\n`;
    } else if (step.target.type === 'pace' && step.target.min && step.target.max) {
      xml += `          <Target xsi:type="Speed_t">\n`;
      xml += `            <SpeedZone xsi:type="CustomSpeedZone_t">\n`;
      xml += `              <LowInMetersPerSecond>${step.target.min}</LowInMetersPerSecond>\n`;
      xml += `              <HighInMetersPerSecond>${step.target.max}</HighInMetersPerSecond>\n`;
      xml += `            </SpeedZone>\n`;
      xml += `          </Target>\n`;
    } else {
      xml += `          <Target xsi:type="None_t"/>\n`;
    }
  } else {
    xml += `          <Target xsi:type="None_t"/>\n`;
  }

  xml += `        </Step>\n`;

  return xml;
}

/**
 * Generate TCX XML for repeat step
 */
function generateRepeatXML(step: TCXStep, stepId: number): string {
  if (!step.children || !step.repetitions) {
    return generateStepXML(step, stepId);
  }

  let xml = `        <Step xsi:type="Repeat_t">\n`;
  xml += `          <StepId>${stepId}</StepId>\n`;
  xml += `          <Repetitions>${step.repetitions}</Repetitions>\n`;
  xml += `          <Child xsi:type="StepList_t">\n`;

  let childStepId = 100;
  for (const child of step.children) {
    xml += generateStepXML(child, childStepId++);
  }

  xml += `          </Child>\n`;
  xml += `        </Step>\n`;

  return xml;
}

/**
 * Export workout to TCX format
 */
export function exportWorkoutToTCX(workout: TCXWorkout): string {
  const timestamp = formatTCXDate(workout.date);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">\n`;
  xml += `  <Workouts>\n`;
  xml += `    <Workout Sport="${workout.sport}">\n`;
  xml += `      <Name>${escapeXML(workout.name)}</Name>\n`;
  xml += `      <Step xsi:type="StepList_t">\n`;
  xml += `        <StepId>0</StepId>\n`;

  // Add steps
  let stepId = 1;
  for (const step of workout.steps) {
    if (step.type === 'repeat' && step.children) {
      xml += generateRepeatXML(step, stepId++);
    } else {
      xml += generateStepXML(step, stepId++);
    }
  }

  xml += `      </Step>\n`;

  // Add creator/notes
  xml += `      <Creator xsi:type="Device_t">\n`;
  xml += `        <Name>Garmin AI Coach Pro</Name>\n`;
  xml += `        <UnitId>0</UnitId>\n`;
  xml += `        <ProductID>0</ProductID>\n`;
  xml += `        <Version>\n`;
  xml += `          <VersionMajor>1</VersionMajor>\n`;
  xml += `          <VersionMinor>0</VersionMinor>\n`;
  xml += `        </Version>\n`;
  xml += `      </Creator>\n`;

  if (workout.notes) {
    xml += `      <Notes>${escapeXML(workout.notes)}</Notes>\n`;
  }

  xml += `    </Workout>\n`;
  xml += `  </Workouts>\n`;
  xml += `</TrainingCenterDatabase>\n`;

  return xml;
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate filename for TCX download
 */
export function generateTCXFilename(workoutName: string): string {
  const sanitized = workoutName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const timestamp = format(new Date(), 'yyyy-MM-dd');

  return `${sanitized}-${timestamp}.tcx`;
}

/**
 * Convert internal workout structure to TCX workout
 */
export function convertWorkoutToTCX(workout: {
  id: string;
  name: string;
  sport: string;
  type: string;
  date: Date;
  duration: number;
  distance?: number;
  structure?: any;
  notes?: string;
}): TCXWorkout {
  return {
    id: workout.id,
    name: workout.name,
    sport: getSportType(workout.sport) as any,
    date: workout.date,
    duration: workout.duration * 60, // Convert minutes to seconds
    distance: workout.distance ? workout.distance * 1000 : undefined, // Convert km to meters
    steps: convertToTCXSteps(workout.structure, workout.type),
    notes: workout.notes,
  };
}
