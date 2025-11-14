/**
 * CSV Mapper - Handles mapping various CSV formats to our schema
 * Supports Garmin Connect, Strava, and custom formats
 */

import { MetricType, Sport, WorkoutType } from '@prisma/client';

export interface CSVRow {
  [key: string]: string;
}

export interface MappedMetric {
  date: string;
  type: MetricType;
  value: number;
  unit?: string;
}

export interface MappedWorkout {
  date: string;
  sport: Sport;
  type: WorkoutType;
  name: string;
  duration: number;
  distance?: number;
  description?: string;
}

// Column name mappings for different export formats
const METRIC_COLUMN_MAPPINGS: Record<string, string[]> = {
  date: ['date', 'Date', 'timestamp', 'Timestamp', 'calendarDate'],
  type: ['type', 'Type', 'metric', 'Metric', 'metricType'],
  value: ['value', 'Value', 'amount', 'Amount'],
  unit: ['unit', 'Unit', 'units', 'Units'],

  // Specific metric mappings
  hrv: ['hrv', 'HRV', 'Heart Rate Variability', 'hrvAverage'],
  vo2max: ['vo2max', 'VO2MAX', 'VO2 Max', 'vo2Max'],
  restingHR: ['resting_hr', 'restingHR', 'Resting Heart Rate', 'restingHeartRate'],
  maxHR: ['max_hr', 'maxHR', 'Maximum Heart Rate', 'maxHeartRate'],
  trainingLoad: ['training_load', 'trainingLoad', 'Training Load', 'acuteLoad'],
  sleepHours: ['sleep_hours', 'sleepHours', 'Sleep', 'totalSleep'],
  stressLevel: ['stress_level', 'stressLevel', 'Stress', 'allDayStress'],
};

const WORKOUT_COLUMN_MAPPINGS: Record<string, string[]> = {
  date: ['date', 'Date', 'timestamp', 'Timestamp', 'Activity Date'],
  sport: ['sport', 'Sport', 'activity', 'Activity', 'Activity Type'],
  type: ['type', 'Type', 'workout_type', 'workoutType'],
  name: ['name', 'Name', 'title', 'Title', 'Activity Name'],
  duration: ['duration', 'Duration', 'time', 'Time', 'Moving Time', 'Elapsed Time'],
  distance: ['distance', 'Distance'],
  description: ['description', 'Description', 'notes', 'Notes'],
};

/**
 * Find a column value using multiple possible column names
 */
function findColumnValue(row: CSVRow, possibleNames: string[]): string | undefined {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }
  return undefined;
}

/**
 * Detect if CSV contains metrics or workouts
 */
export function detectCSVType(headers: string[]): 'metrics' | 'workouts' | 'unknown' {
  const headerLower = headers.map(h => h.toLowerCase());

  // Check for metric indicators
  const hasMetricColumns = headerLower.some(h =>
    h.includes('hrv') || h.includes('vo2') || h.includes('training_load') ||
    (h.includes('type') && h.includes('value'))
  );

  // Check for workout indicators
  const hasWorkoutColumns = headerLower.some(h =>
    h.includes('activity') || h.includes('sport') || h.includes('duration') ||
    h.includes('distance') || h.includes('elapsed')
  );

  if (hasMetricColumns) return 'metrics';
  if (hasWorkoutColumns) return 'workouts';
  return 'unknown';
}

/**
 * Map CSV row to metric
 */
export function mapRowToMetric(row: CSVRow): MappedMetric | null {
  const date = findColumnValue(row, METRIC_COLUMN_MAPPINGS.date);
  const type = findColumnValue(row, METRIC_COLUMN_MAPPINGS.type);
  const value = findColumnValue(row, METRIC_COLUMN_MAPPINGS.value);

  if (!date || !value) return null;

  // If type column exists, use it directly
  if (type) {
    const metricType = type.toUpperCase().replace(/\s+/g, '_') as MetricType;
    if (Object.values(MetricType).includes(metricType)) {
      return {
        date,
        type: metricType,
        value: parseFloat(value),
        unit: findColumnValue(row, METRIC_COLUMN_MAPPINGS.unit),
      };
    }
  }

  // Otherwise, try to detect metric type from column names
  const hrvValue = findColumnValue(row, METRIC_COLUMN_MAPPINGS.hrv);
  if (hrvValue) {
    return { date, type: MetricType.HRV, value: parseFloat(hrvValue), unit: 'ms' };
  }

  const vo2maxValue = findColumnValue(row, METRIC_COLUMN_MAPPINGS.vo2max);
  if (vo2maxValue) {
    return { date, type: MetricType.VO2MAX, value: parseFloat(vo2maxValue), unit: 'ml/kg/min' };
  }

  const restingHRValue = findColumnValue(row, METRIC_COLUMN_MAPPINGS.restingHR);
  if (restingHRValue) {
    return { date, type: MetricType.RESTING_HR, value: parseFloat(restingHRValue), unit: 'bpm' };
  }

  const trainingLoadValue = findColumnValue(row, METRIC_COLUMN_MAPPINGS.trainingLoad);
  if (trainingLoadValue) {
    return { date, type: MetricType.TRAINING_LOAD, value: parseFloat(trainingLoadValue) };
  }

  const sleepValue = findColumnValue(row, METRIC_COLUMN_MAPPINGS.sleepHours);
  if (sleepValue) {
    return { date, type: MetricType.SLEEP_HOURS, value: parseFloat(sleepValue), unit: 'hours' };
  }

  const stressValue = findColumnValue(row, METRIC_COLUMN_MAPPINGS.stressLevel);
  if (stressValue) {
    return { date, type: MetricType.STRESS_LEVEL, value: parseFloat(stressValue) };
  }

  return null;
}

/**
 * Parse duration string to minutes
 */
function parseDuration(durationStr: string): number {
  // Handle formats: "1:30:45", "90:45", "5400" (seconds), "1.5" (hours)
  if (!durationStr) return 0;

  const str = durationStr.toString().trim();

  // HH:MM:SS or MM:SS format
  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseInt(p));
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 60 + parts[1] + parts[2] / 60;
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] + parts[1] / 60;
    }
  }

  const num = parseFloat(str);

  // If very large number, assume seconds
  if (num > 500) {
    return num / 60;
  }

  // Otherwise assume minutes or hours (depending on magnitude)
  return num > 24 ? num : num * 60; // If > 24, assume minutes; else hours
}

/**
 * Map sport name to Sport enum
 */
function mapSport(sportStr: string): Sport {
  const sport = sportStr.toLowerCase().trim();

  if (sport.includes('run')) return Sport.RUNNING;
  if (sport.includes('cycl') || sport.includes('bike')) return Sport.CYCLING;
  if (sport.includes('swim')) return Sport.SWIMMING;
  if (sport.includes('tri')) return Sport.TRIATHLON;

  return Sport.OTHER;
}

/**
 * Map workout type from name or description
 */
function mapWorkoutType(name: string, description?: string): WorkoutType {
  const text = `${name} ${description || ''}`.toLowerCase();

  if (text.includes('easy') || text.includes('recovery')) return WorkoutType.RECOVERY;
  if (text.includes('tempo') || text.includes('threshold')) return WorkoutType.TEMPO;
  if (text.includes('interval') || text.includes('repeat')) return WorkoutType.INTERVAL;
  if (text.includes('long')) return WorkoutType.LONG;
  if (text.includes('race')) return WorkoutType.RACE;
  if (text.includes('strength')) return WorkoutType.STRENGTH;

  return WorkoutType.EASY;
}

/**
 * Map CSV row to workout
 */
export function mapRowToWorkout(row: CSVRow): MappedWorkout | null {
  const date = findColumnValue(row, WORKOUT_COLUMN_MAPPINGS.date);
  const sportStr = findColumnValue(row, WORKOUT_COLUMN_MAPPINGS.sport);
  const durationStr = findColumnValue(row, WORKOUT_COLUMN_MAPPINGS.duration);

  if (!date || !durationStr) return null;

  const name = findColumnValue(row, WORKOUT_COLUMN_MAPPINGS.name) || 'Imported Workout';
  const description = findColumnValue(row, WORKOUT_COLUMN_MAPPINGS.description);
  const distanceStr = findColumnValue(row, WORKOUT_COLUMN_MAPPINGS.distance);

  const sport = sportStr ? mapSport(sportStr) : Sport.OTHER;
  const duration = parseDuration(durationStr);
  const distance = distanceStr ? parseFloat(distanceStr) : undefined;
  const type = mapWorkoutType(name, description);

  return {
    date,
    sport,
    type,
    name,
    duration: Math.round(duration),
    distance,
    description,
  };
}

/**
 * Validate mapped metrics
 */
export function validateMetrics(metrics: MappedMetric[]): { valid: MappedMetric[]; errors: string[] } {
  const valid: MappedMetric[] = [];
  const errors: string[] = [];

  metrics.forEach((metric, index) => {
    // Validate date
    const date = new Date(metric.date);
    if (isNaN(date.getTime())) {
      errors.push(`Row ${index + 1}: Invalid date "${metric.date}"`);
      return;
    }

    // Validate value
    if (isNaN(metric.value) || metric.value < 0) {
      errors.push(`Row ${index + 1}: Invalid value "${metric.value}"`);
      return;
    }

    // Validate type
    if (!Object.values(MetricType).includes(metric.type)) {
      errors.push(`Row ${index + 1}: Invalid metric type "${metric.type}"`);
      return;
    }

    valid.push(metric);
  });

  return { valid, errors };
}

/**
 * Validate mapped workouts
 */
export function validateWorkouts(workouts: MappedWorkout[]): { valid: MappedWorkout[]; errors: string[] } {
  const valid: MappedWorkout[] = [];
  const errors: string[] = [];

  workouts.forEach((workout, index) => {
    // Validate date
    const date = new Date(workout.date);
    if (isNaN(date.getTime())) {
      errors.push(`Row ${index + 1}: Invalid date "${workout.date}"`);
      return;
    }

    // Validate duration
    if (workout.duration <= 0 || workout.duration > 1440) {
      errors.push(`Row ${index + 1}: Invalid duration "${workout.duration}" (must be 1-1440 minutes)`);
      return;
    }

    // Validate distance if present
    if (workout.distance !== undefined && (workout.distance < 0 || workout.distance > 500)) {
      errors.push(`Row ${index + 1}: Invalid distance "${workout.distance}"`);
      return;
    }

    valid.push(workout);
  });

  return { valid, errors };
}
