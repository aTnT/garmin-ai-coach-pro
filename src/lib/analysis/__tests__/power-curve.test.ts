/**
 * Unit Tests for Power Curve Analysis
 */

import {
  calculatePowerCurve,
  findMaxAveragePower,
  estimateFTP,
  calculatePowerZones,
  comparePowerCurves,
  analyzePowerProfile,
  formatDuration,
  PowerDataPoint,
  POWER_CURVE_DURATIONS,
} from '../power-curve';

describe('Power Curve Analysis', () => {
  const createPowerData = (
    powers: number[],
    startTime: Date = new Date()
  ): PowerDataPoint[] => {
    return powers.map((power, index) => ({
      timestamp: new Date(startTime.getTime() + index * 1000), // 1s intervals
      power,
    }));
  };

  describe('findMaxAveragePower', () => {
    it('should find max average power for given duration', () => {
      const powerData = createPowerData([100, 200, 300, 400, 300, 200, 100]);

      const max5s = findMaxAveragePower(powerData, 5);
      expect(max5s).toBeGreaterThan(0);
    });

    it('should handle empty power data', () => {
      const result = findMaxAveragePower([], 60);
      expect(result).toBe(0);
    });

    it('should handle short duration', () => {
      const powerData = createPowerData([200, 250, 300, 250, 200]);

      const max3s = findMaxAveragePower(powerData, 3);
      expect(max3s).toBeGreaterThan(200);
    });

    it('should find peak power in varying data', () => {
      // Simulate a sprint effort
      const powerData = createPowerData([
        100, 150, 400, 450, 500, 480, 450, 200, 150, 100,
      ]);

      const max5s = findMaxAveragePower(powerData, 5);
      expect(max5s).toBeGreaterThan(400); // Should capture the sprint
    });
  });

  describe('calculatePowerCurve', () => {
    it('should calculate power curve from activities', () => {
      const activities = [
        {
          id: 'activity-1',
          date: new Date('2024-01-01'),
          sport: 'CYCLING' as const,
          powerData: createPowerData([200, 250, 300, 280, 260, 240]),
        },
        {
          id: 'activity-2',
          date: new Date('2024-01-02'),
          sport: 'CYCLING' as const,
          powerData: createPowerData([250, 300, 350, 320, 300, 280]),
        },
      ];

      const curve = calculatePowerCurve(activities, [5, 10]);

      expect(curve.points.length).toBeGreaterThan(0);
      expect(curve.sport).toBe('CYCLING');
      expect(curve.totalActivities).toBe(2);
      expect(curve.dateRange.start).toEqual(new Date('2024-01-01'));
      expect(curve.dateRange.end).toEqual(new Date('2024-01-02'));
    });

    it('should return empty curve for no activities', () => {
      const curve = calculatePowerCurve([]);

      expect(curve.points).toEqual([]);
      expect(curve.totalActivities).toBe(0);
    });

    it('should use all standard durations by default', () => {
      const activities = [
        {
          id: 'activity-1',
          date: new Date(),
          sport: 'CYCLING' as const,
          powerData: createPowerData(new Array(3700).fill(200)), // 1+ hour of data
        },
      ];

      const curve = calculatePowerCurve(activities);

      // Should have tried to calculate for all durations (may skip if no data)
      expect(curve.points.length).toBeGreaterThan(0);
    });

    it('should identify best power across multiple activities', () => {
      const baseTime = new Date('2024-01-01');

      const activities = [
        {
          id: 'activity-1',
          date: new Date('2024-01-01'),
          sport: 'CYCLING' as const,
          powerData: createPowerData([200, 200, 200, 200, 200], baseTime),
        },
        {
          id: 'activity-2',
          date: new Date('2024-01-02'),
          sport: 'CYCLING' as const,
          powerData: createPowerData([300, 300, 300, 300, 300], baseTime),
        },
      ];

      const curve = calculatePowerCurve(activities, [5]);

      expect(curve.points[0].power).toBe(300); // Should pick the higher power
      expect(curve.points[0].activityId).toBe('activity-2');
    });
  });

  describe('estimateFTP', () => {
    it('should estimate FTP from 20-minute power', () => {
      const curve = {
        points: [
          { duration: 1200, power: 300, date: new Date() }, // 20 min at 300W
          { duration: 300, power: 350, date: new Date() },
        ],
        sport: 'CYCLING' as const,
        dateRange: { start: new Date(), end: new Date() },
        totalActivities: 1,
      };

      const ftp = estimateFTP(curve);

      expect(ftp).toBe(285); // 300 * 0.95 = 285
    });

    it('should return null if no 20-minute data', () => {
      const curve = {
        points: [{ duration: 300, power: 350, date: new Date() }],
        sport: 'CYCLING' as const,
        dateRange: { start: new Date(), end: new Date() },
        totalActivities: 1,
      };

      const ftp = estimateFTP(curve);

      expect(ftp).toBeNull();
    });
  });

  describe('calculatePowerZones', () => {
    it('should calculate 7 power zones from FTP', () => {
      const zones = calculatePowerZones(200);

      expect(zones.z1.max).toBe(110); // 55% of 200
      expect(zones.z2.min).toBe(112); // 56% of 200
      expect(zones.z4.min).toBe(182); // 91% of 200
      expect(zones.z4.max).toBe(210); // 105% of 200
      expect(zones.z7.min).toBe(302); // 151% of 200
    });

    it('should have non-overlapping zones', () => {
      const zones = calculatePowerZones(250);

      expect(zones.z1.max).toBeLessThan(zones.z2.min);
      expect(zones.z2.max).toBeLessThan(zones.z3.min);
      expect(zones.z3.max).toBeLessThan(zones.z4.min);
      expect(zones.z4.max).toBeLessThan(zones.z5.min);
      expect(zones.z5.max).toBeLessThan(zones.z6.min);
      expect(zones.z6.max).toBeLessThan(zones.z7.min);
    });

    it('should include zone names', () => {
      const zones = calculatePowerZones(200);

      expect(zones.z1.name).toBe('Active Recovery');
      expect(zones.z4.name).toBe('Threshold');
      expect(zones.z7.name).toBe('Neuromuscular');
    });
  });

  describe('comparePowerCurves', () => {
    it('should compare power curves and calculate improvements', () => {
      const current = {
        points: [
          { duration: 60, power: 400, date: new Date() },
          { duration: 300, power: 350, date: new Date() },
        ],
        sport: 'CYCLING' as const,
        dateRange: { start: new Date(), end: new Date() },
        totalActivities: 5,
      };

      const previous = {
        points: [
          { duration: 60, power: 380, date: new Date() },
          { duration: 300, power: 350, date: new Date() },
        ],
        sport: 'CYCLING' as const,
        dateRange: { start: new Date(), end: new Date() },
        totalActivities: 3,
      };

      const comparison = comparePowerCurves(current, previous);

      expect(comparison.length).toBe(2);
      expect(comparison[0].duration).toBe(60);
      expect(comparison[0].change).toBeGreaterThan(0); // 400 vs 380 = improvement
      expect(comparison[0].improved).toBe(true);
      expect(comparison[1].change).toBe(0); // No change at 5min
    });

    it('should handle decreases in power', () => {
      const current = {
        points: [{ duration: 60, power: 350, date: new Date() }],
        sport: 'CYCLING' as const,
        dateRange: { start: new Date(), end: new Date() },
        totalActivities: 1,
      };

      const previous = {
        points: [{ duration: 60, power: 400, date: new Date() }],
        sport: 'CYCLING' as const,
        dateRange: { start: new Date(), end: new Date() },
        totalActivities: 1,
      };

      const comparison = comparePowerCurves(current, previous);

      expect(comparison[0].change).toBeLessThan(0);
      expect(comparison[0].improved).toBe(false);
    });
  });

  describe('analyzePowerProfile', () => {
    it('should identify endurance profile', () => {
      const curve = {
        points: [
          { duration: 5, power: 800, date: new Date() },
          { duration: 30, power: 450, date: new Date() },
          { duration: 60, power: 400, date: new Date() },
          { duration: 300, power: 300, date: new Date() }, // Good retention
          { duration: 1200, power: 270, date: new Date() }, // Good retention
        ],
        sport: 'CYCLING' as const,
        dateRange: { start: new Date(), end: new Date() },
        totalActivities: 10,
      };

      const analysis = analyzePowerProfile(curve);

      expect(analysis.profile).toBe('endurance');
      expect(analysis.strengths.length).toBeGreaterThan(0);
    });

    it('should identify sprinter profile', () => {
      const curve = {
        points: [
          { duration: 5, power: 1000, date: new Date() },
          { duration: 30, power: 550, date: new Date() },
          { duration: 60, power: 500, date: new Date() },
          { duration: 300, power: 250, date: new Date() }, // Poor retention
          { duration: 1200, power: 200, date: new Date() }, // Poor retention
        ],
        sport: 'CYCLING' as const,
        dateRange: { start: new Date(), end: new Date() },
        totalActivities: 10,
      };

      const analysis = analyzePowerProfile(curve);

      expect(analysis.profile).toBe('sprinter');
      expect(analysis.weaknesses.length).toBeGreaterThan(0);
    });

    it('should handle insufficient data', () => {
      const curve = {
        points: [
          { duration: 60, power: 400, date: new Date() },
        ],
        sport: 'CYCLING' as const,
        dateRange: { start: new Date(), end: new Date() },
        totalActivities: 1,
      };

      const analysis = analyzePowerProfile(curve);

      expect(analysis.profile).toBe('unknown');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(5)).toBe('5s');
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(59)).toBe('59s');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(60)).toBe('1min');
      expect(formatDuration(120)).toBe('2min');
      expect(formatDuration(300)).toBe('5min');
      expect(formatDuration(1200)).toBe('20min');
    });

    it('should format hours correctly', () => {
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(7200)).toBe('2h');
    });
  });

  describe('POWER_CURVE_DURATIONS', () => {
    it('should include standard durations', () => {
      expect(POWER_CURVE_DURATIONS).toContain(5); // 5s
      expect(POWER_CURVE_DURATIONS).toContain(60); // 1min
      expect(POWER_CURVE_DURATIONS).toContain(300); // 5min
      expect(POWER_CURVE_DURATIONS).toContain(1200); // 20min (FTP)
      expect(POWER_CURVE_DURATIONS).toContain(3600); // 1hr
    });

    it('should be in ascending order', () => {
      for (let i = 1; i < POWER_CURVE_DURATIONS.length; i++) {
        expect(POWER_CURVE_DURATIONS[i]).toBeGreaterThan(
          POWER_CURVE_DURATIONS[i - 1]
        );
      }
    });
  });
});
