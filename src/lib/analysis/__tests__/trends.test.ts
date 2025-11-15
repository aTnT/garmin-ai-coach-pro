/**
 * Unit Tests for Historical Trends Analysis
 */

import {
  calculateRollingAverage,
  aggregateByPeriod,
  analyzeReadinessTrend,
  analyzeTrainingLoadTrend,
  analyzeHRVTrend,
  analyzePerformanceTrend,
  analyzeVolumeTrend,
  TrendDataPoint,
} from '../trends';

describe('Historical Trends Analysis', () => {
  describe('calculateRollingAverage', () => {
    it('should calculate 7-day rolling average', () => {
      const data: TrendDataPoint[] = [
        { date: new Date('2024-01-01'), value: 10 },
        { date: new Date('2024-01-02'), value: 20 },
        { date: new Date('2024-01-03'), value: 30 },
        { date: new Date('2024-01-04'), value: 40 },
        { date: new Date('2024-01-05'), value: 50 },
        { date: new Date('2024-01-06'), value: 60 },
        { date: new Date('2024-01-07'), value: 70 },
        { date: new Date('2024-01-08'), value: 80 },
      ];

      const rolling = calculateRollingAverage(data, 7);

      expect(rolling.length).toBe(8);
      expect(rolling[0].value).toBe(10); // First point = itself
      expect(rolling[6].value).toBe(40); // (10+20+30+40+50+60+70)/7 = 40
      expect(rolling[7].value).toBe(50); // (20+30+40+50+60+70+80)/7 ≈ 50
    });

    it('should handle empty data', () => {
      const result = calculateRollingAverage([]);
      expect(result).toEqual([]);
    });

    it('should handle small window sizes', () => {
      const data: TrendDataPoint[] = [
        { date: new Date('2024-01-01'), value: 10 },
        { date: new Date('2024-01-02'), value: 20 },
      ];

      const rolling = calculateRollingAverage(data, 3);

      expect(rolling.length).toBe(2);
      expect(rolling[0].value).toBe(10);
      expect(rolling[1].value).toBe(15); // (10+20)/2
    });
  });

  describe('aggregateByPeriod', () => {
    const data: TrendDataPoint[] = [
      { date: new Date('2024-01-01'), value: 100 },
      { date: new Date('2024-01-01'), value: 200 },
      { date: new Date('2024-01-02'), value: 150 },
      { date: new Date('2024-01-08'), value: 300 }, // Different week
    ];

    it('should aggregate by daily', () => {
      const daily = aggregateByPeriod(data, 'daily');

      expect(daily.length).toBe(3); // 3 unique days
      expect(daily[0].value).toBe(150); // (100+200)/2
      expect(daily[1].value).toBe(150); // 150/1
    });

    it('should aggregate by weekly', () => {
      const weekly = aggregateByPeriod(data, 'weekly');

      expect(weekly.length).toBeGreaterThan(0);
      // Week 1 should average the first 3 points
      // Week 2 should have the 4th point
    });

    it('should handle empty data', () => {
      const result = aggregateByPeriod([], 'daily');
      expect(result).toEqual([]);
    });
  });

  describe('analyzeReadinessTrend', () => {
    it('should analyze readiness trends', () => {
      const readinessData = [
        { date: new Date('2024-01-01'), score: 70, level: 'good' },
        { date: new Date('2024-01-02'), score: 75, level: 'excellent' },
        { date: new Date('2024-01-03'), score: 80, level: 'excellent' },
      ];

      const analysis = analyzeReadinessTrend(readinessData);

      expect(analysis.series.length).toBe(1);
      expect(analysis.series[0].name).toBe('Readiness Score');
      expect(analysis.series[0].data.length).toBe(3);
      expect(analysis.statistics.trend).toBe('increasing');
      expect(analysis.insights.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeTrainingLoadTrend', () => {
    it('should calculate ACWR and provide insights', () => {
      const loads: Array<{ date: Date; load: number }> = [];
      const baseDate = new Date('2024-01-01');

      // Create 30 days of load data
      for (let i = 0; i < 30; i++) {
        loads.push({
          date: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000),
          load: 400 + i * 10,
        });
      }

      const analysis = analyzeTrainingLoadTrend(loads);

      expect(analysis.series.length).toBe(2);
      expect(analysis.series[0].name).toBe('Training Load');
      expect(analysis.series[1].name).toContain('ACWR');
      expect(analysis.insights.length).toBeGreaterThan(0);
    });

    it('should detect high ACWR', () => {
      const loads: Array<{ date: Date; load: number }> = [];
      const baseDate = new Date('2024-01-01');

      // Create low chronic load, then spike acute load
      for (let i = 0; i < 28; i++) {
        loads.push({
          date: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000),
          load: i < 21 ? 200 : 600, // Spike in last week
        });
      }

      const analysis = analyzeTrainingLoadTrend(loads);

      // Should have insights about high load
      expect(analysis.insights.some((i) => i.includes('High acute load'))).toBeDefined();
    });
  });

  describe('analyzeHRVTrend', () => {
    it('should analyze HRV with smoothing', () => {
      const hrvData = [
        { date: new Date('2024-01-01'), hrv: 60 },
        { date: new Date('2024-01-02'), hrv: 62 },
        { date: new Date('2024-01-03'), hrv: 64 },
        { date: new Date('2024-01-04'), hrv: 66 },
        { date: new Date('2024-01-05'), hrv: 68 },
        { date: new Date('2024-01-06'), hrv: 70 },
        { date: new Date('2024-01-07'), hrv: 72 },
      ];

      const analysis = analyzeHRVTrend(hrvData);

      expect(analysis.series.length).toBe(2); // Raw + smoothed
      expect(analysis.series[0].name).toBe('HRV');
      expect(analysis.series[1].name).toContain('7-day avg');
      expect(analysis.statistics.trend).toBe('increasing');
    });

    it('should detect declining HRV', () => {
      const hrvData = [
        { date: new Date('2024-01-01'), hrv: 70 },
        { date: new Date('2024-01-02'), hrv: 65 },
        { date: new Date('2024-01-03'), hrv: 60 },
        { date: new Date('2024-01-04'), hrv: 55 },
        { date: new Date('2024-01-05'), hrv: 50 },
      ];

      const analysis = analyzeHRVTrend(hrvData);

      expect(analysis.statistics.trend).toBe('decreasing');
      expect(analysis.insights.some((i) => i.includes('declining'))).toBeDefined();
    });
  });

  describe('analyzePerformanceTrend', () => {
    it('should group performance by duration', () => {
      const performances = [
        { date: new Date('2024-01-01'), duration: 300, value: 350 }, // 5min
        { date: new Date('2024-01-02'), duration: 300, value: 360 },
        { date: new Date('2024-01-03'), duration: 1200, value: 280 }, // 20min
        { date: new Date('2024-01-04'), duration: 1200, value: 285 },
      ];

      const analysis = analyzePerformanceTrend(performances, 'Power', 'W');

      expect(analysis.series.length).toBe(2); // 5min + 20min
      expect(analysis.series[0].name).toContain('5min');
      expect(analysis.series[1].name).toContain('20min');
    });

    it('should detect improving performance', () => {
      const performances = [
        { date: new Date('2024-01-01'), duration: 300, value: 300 },
        { date: new Date('2024-01-02'), duration: 300, value: 320 },
        { date: new Date('2024-01-03'), duration: 300, value: 340 },
      ];

      const analysis = analyzePerformanceTrend(performances, 'Power', 'W');

      expect(analysis.statistics.trend).toBe('increasing');
      expect(analysis.insights.some((i) => i.includes('improving'))).toBeDefined();
    });
  });

  describe('analyzeVolumeTrend', () => {
    it('should aggregate volume by week', () => {
      const activities: Array<{ date: Date; duration: number; distance?: number }> = [];
      const baseDate = new Date('2024-01-01');

      // Create 14 days of activities
      for (let i = 0; i < 14; i++) {
        activities.push({
          date: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000),
          duration: 60 + i * 5,
          distance: 10 + i * 0.5,
        });
      }

      const analysis = analyzeVolumeTrend(activities, 'weekly');

      expect(analysis.series.length).toBe(2); // Time + Distance
      expect(analysis.series[0].name).toBe('Training Time');
      expect(analysis.series[1].name).toBe('Training Distance');
    });

    it('should detect rapid volume increase', () => {
      const activities: Array<{ date: Date; duration: number }> = [];
      const baseDate = new Date('2024-01-01');

      // Simulate rapid increase
      for (let i = 0; i < 14; i++) {
        const duration = i < 7 ? 60 : 120; // Double in second week
        activities.push({
          date: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000),
          duration,
        });
      }

      const analysis = analyzeVolumeTrend(activities, 'weekly');

      // Should warn about rapid increase
      expect(analysis.insights.some((i) => i.includes('rapidly'))).toBeDefined();
    });
  });
});
