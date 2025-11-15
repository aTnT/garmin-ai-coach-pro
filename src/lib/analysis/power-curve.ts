/**
 * Power Curve Analysis
 *
 * Analyzes athlete's power output across different time durations
 * to identify strengths and weaknesses in different energy systems.
 */

export interface PowerDataPoint {
  timestamp: Date;
  power: number; // watts
  heartRate?: number; // bpm
  cadence?: number; // rpm
}

export interface PowerCurvePoint {
  duration: number; // seconds
  power: number; // watts
  date: Date; // when this best effort occurred
  activityId?: string;
  normalized?: boolean;
}

export interface PowerCurve {
  points: PowerCurvePoint[];
  sport: 'CYCLING' | 'RUNNING';
  dateRange: {
    start: Date;
    end: Date;
  };
  totalActivities: number;
}

export interface PowerZones {
  z1: { min: number; max: number; name: string }; // Active Recovery
  z2: { min: number; max: number; name: string }; // Endurance
  z3: { min: number; max: number; name: string }; // Tempo
  z4: { min: number; max: number; name: string }; // Threshold
  z5: { min: number; max: number; name: string }; // VO2 Max
  z6: { min: number; max: number; name: string }; // Anaerobic
  z7: { min: number; max: number; name: string }; // Neuromuscular
}

/**
 * Standard durations for power curve analysis (in seconds)
 */
export const POWER_CURVE_DURATIONS = [
  5, // 5s - Neuromuscular power
  10, // 10s - Anaerobic capacity
  20, // 20s - Anaerobic capacity
  30, // 30s - Anaerobic capacity
  60, // 1min - Anaerobic capacity
  120, // 2min - VO2 max
  300, // 5min - VO2 max
  600, // 10min - Threshold
  1200, // 20min - FTP (Functional Threshold Power)
  1800, // 30min - Threshold
  3600, // 60min - Tempo/Threshold
];

/**
 * Calculate power curve from activity data
 */
export function calculatePowerCurve(
  activities: Array<{
    id: string;
    date: Date;
    powerData: PowerDataPoint[];
    sport: 'CYCLING' | 'RUNNING';
  }>,
  durations: number[] = POWER_CURVE_DURATIONS
): PowerCurve {
  if (activities.length === 0) {
    return {
      points: [],
      sport: 'CYCLING',
      dateRange: { start: new Date(), end: new Date() },
      totalActivities: 0,
    };
  }

  const sport = activities[0].sport;
  const points: PowerCurvePoint[] = [];

  // For each duration, find the best power across all activities
  for (const duration of durations) {
    let bestPower = 0;
    let bestDate = new Date();
    let bestActivityId: string | undefined;

    for (const activity of activities) {
      const maxPower = findMaxAveragePower(
        activity.powerData,
        duration
      );

      if (maxPower > bestPower) {
        bestPower = maxPower;
        bestDate = activity.date;
        bestActivityId = activity.id;
      }
    }

    if (bestPower > 0) {
      points.push({
        duration,
        power: Math.round(bestPower),
        date: bestDate,
        activityId: bestActivityId,
      });
    }
  }

  // Calculate date range
  const dates = activities.map((a) => a.date);
  const start = new Date(Math.min(...dates.map((d) => d.getTime())));
  const end = new Date(Math.max(...dates.map((d) => d.getTime())));

  return {
    points,
    sport,
    dateRange: { start, end },
    totalActivities: activities.length,
  };
}

/**
 * Find maximum average power for a given duration
 * Uses a rolling window to find the highest average power
 */
export function findMaxAveragePower(
  powerData: PowerDataPoint[],
  durationSeconds: number
): number {
  if (powerData.length === 0) return 0;

  // Sort by timestamp
  const sorted = [...powerData].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  let maxAvg = 0;

  // Sliding window approach
  for (let i = 0; i < sorted.length; i++) {
    const windowStart = sorted[i].timestamp;
    const windowEnd = new Date(
      windowStart.getTime() + durationSeconds * 1000
    );

    // Find all points within the window
    const windowPoints = sorted.filter(
      (p) =>
        p.timestamp >= windowStart &&
        p.timestamp <= windowEnd &&
        p.power > 0
    );

    if (windowPoints.length > 0) {
      const sum = windowPoints.reduce((acc, p) => acc + p.power, 0);
      const avg = sum / windowPoints.length;
      maxAvg = Math.max(maxAvg, avg);
    }
  }

  return maxAvg;
}

/**
 * Calculate Functional Threshold Power (FTP) from power curve
 * FTP is typically 95% of best 20-minute power
 */
export function estimateFTP(powerCurve: PowerCurve): number | null {
  const twentyMinPoint = powerCurve.points.find((p) => p.duration === 1200);
  if (!twentyMinPoint) return null;

  return Math.round(twentyMinPoint.power * 0.95);
}

/**
 * Calculate power zones based on FTP
 * Uses standard 7-zone model (Coggan)
 */
export function calculatePowerZones(ftp: number): PowerZones {
  return {
    z1: {
      min: 0,
      max: Math.round(ftp * 0.55),
      name: 'Active Recovery',
    },
    z2: {
      min: Math.round(ftp * 0.56),
      max: Math.round(ftp * 0.75),
      name: 'Endurance',
    },
    z3: {
      min: Math.round(ftp * 0.76),
      max: Math.round(ftp * 0.90),
      name: 'Tempo',
    },
    z4: {
      min: Math.round(ftp * 0.91),
      max: Math.round(ftp * 1.05),
      name: 'Threshold',
    },
    z5: {
      min: Math.round(ftp * 1.06),
      max: Math.round(ftp * 1.20),
      name: 'VO2 Max',
    },
    z6: {
      min: Math.round(ftp * 1.21),
      max: Math.round(ftp * 1.50),
      name: 'Anaerobic',
    },
    z7: {
      min: Math.round(ftp * 1.51),
      max: 9999,
      name: 'Neuromuscular',
    },
  };
}

/**
 * Compare current power curve to historical data
 */
export function comparePowerCurves(
  current: PowerCurve,
  previous: PowerCurve
): Array<{
  duration: number;
  currentPower: number;
  previousPower: number;
  change: number; // percentage change
  improved: boolean;
}> {
  const comparison: Array<{
    duration: number;
    currentPower: number;
    previousPower: number;
    change: number;
    improved: boolean;
  }> = [];

  for (const point of current.points) {
    const prevPoint = previous.points.find(
      (p) => p.duration === point.duration
    );

    if (prevPoint) {
      const change =
        ((point.power - prevPoint.power) / prevPoint.power) * 100;
      comparison.push({
        duration: point.duration,
        currentPower: point.power,
        previousPower: prevPoint.power,
        change: Math.round(change * 10) / 10, // Round to 1 decimal
        improved: change > 0,
      });
    }
  }

  return comparison;
}

/**
 * Identify strengths and weaknesses from power curve
 */
export function analyzePowerProfile(
  powerCurve: PowerCurve
): {
  strengths: string[];
  weaknesses: string[];
  profile: 'sprinter' | 'all-rounder' | 'endurance' | 'unknown';
} {
  if (powerCurve.points.length < 5) {
    return {
      strengths: [],
      weaknesses: [],
      profile: 'unknown',
    };
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Get power at key durations
  const p5s = powerCurve.points.find((p) => p.duration === 5)?.power || 0;
  const p1min = powerCurve.points.find((p) => p.duration === 60)?.power || 0;
  const p5min = powerCurve.points.find((p) => p.duration === 300)?.power || 0;
  const p20min = powerCurve.points.find((p) => p.duration === 1200)?.power || 0;

  // Calculate power retention percentages
  const retention1to5 = p5min / p1min;
  const retention5to20 = p20min / p5min;

  // Identify profile
  let profile: 'sprinter' | 'all-rounder' | 'endurance' | 'unknown' = 'unknown';

  if (retention1to5 > 0.70 && retention5to20 > 0.85) {
    profile = 'endurance';
    strengths.push('Excellent endurance and power retention');
    strengths.push('Strong sustained efforts');
  } else if (retention1to5 < 0.60) {
    profile = 'sprinter';
    strengths.push('Strong short-duration power');
    weaknesses.push('Power drops significantly in longer efforts');
  } else {
    profile = 'all-rounder';
    strengths.push('Balanced power across durations');
  }

  // Specific strengths/weaknesses
  if (p5s > p1min * 3) {
    strengths.push('Exceptional sprint power (neuromuscular)');
  }

  if (retention5to20 < 0.80) {
    weaknesses.push('Threshold endurance needs improvement');
  }

  return { strengths, weaknesses, profile };
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  return `${Math.floor(seconds / 3600)}h`;
}
