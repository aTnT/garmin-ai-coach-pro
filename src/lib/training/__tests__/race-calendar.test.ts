/**
 * Tests for Race Calendar & Taper Planning Module
 */

import {
  sortRaces,
  getUpcomingRaces,
  getPrimaryRace,
  weeksUntilRace,
  daysUntilRace,
  calculateTaperDuration,
  generateTaperPlan,
  generateRacePeakPlan,
  getRaceTrainingFocus,
  calculateRacePacing,
  isInTaperPeriod,
  getVolumeAdjustmentFactor,
  type Race,
  type RacePriority,
  type RaceDistance,
} from '../race-calendar';
import { Sport } from '@prisma/client';
import { addDays, subDays } from 'date-fns';

describe('Race Calendar & Taper Planning', () => {
  // ========== HELPER FUNCTIONS ==========

  const createMockRace = (
    daysFromNow: number,
    priority: RacePriority = 'B',
    distance: RaceDistance = 'HALF_MARATHON'
  ): Race => {
    const date = addDays(new Date(), daysFromNow);
    return {
      id: `race-${daysFromNow}`,
      name: `Test ${distance} Race`,
      date,
      sport: 'RUNNING' as Sport,
      distance,
      priority,
    };
  };

  // ========== RACE CALENDAR MANAGEMENT TESTS ==========

  describe('sortRaces', () => {
    it('should sort races by date (earliest first)', () => {
      const races = [
        createMockRace(30, 'B'),
        createMockRace(7, 'A'),
        createMockRace(60, 'C'),
      ];

      const sorted = sortRaces(races);

      expect(sorted[0].id).toBe('race-7');
      expect(sorted[1].id).toBe('race-30');
      expect(sorted[2].id).toBe('race-60');
    });

    it('should not mutate original array', () => {
      const races = [
        createMockRace(30, 'B'),
        createMockRace(7, 'A'),
      ];

      const original = [...races];
      sortRaces(races);

      expect(races).toEqual(original);
    });
  });

  describe('getUpcomingRaces', () => {
    it('should return only future races', () => {
      const races = [
        createMockRace(-7, 'A'), // Past
        createMockRace(7, 'A'), // Future
        createMockRace(30, 'B'), // Future
      ];

      const upcoming = getUpcomingRaces(races);

      expect(upcoming.length).toBe(2);
      expect(upcoming.every((r) => r.date > new Date())).toBe(true);
    });

    it('should sort upcoming races by date', () => {
      const races = [
        createMockRace(30, 'B'),
        createMockRace(7, 'A'),
        createMockRace(60, 'C'),
      ];

      const upcoming = getUpcomingRaces(races);

      expect(upcoming[0].id).toBe('race-7');
      expect(upcoming[1].id).toBe('race-30');
      expect(upcoming[2].id).toBe('race-60');
    });

    it('should work with custom reference date', () => {
      const refDate = new Date('2024-01-01');
      const races = [
        { ...createMockRace(0, 'A'), date: new Date('2023-12-25') }, // Before ref
        { ...createMockRace(0, 'B'), date: new Date('2024-01-15') }, // After ref
      ];

      const upcoming = getUpcomingRaces(races, refDate);

      expect(upcoming.length).toBe(1);
      expect(upcoming[0].priority).toBe('B');
    });
  });

  describe('getPrimaryRace', () => {
    it('should return next A-priority race', () => {
      const races = [
        createMockRace(30, 'B'),
        createMockRace(60, 'A'),
        createMockRace(90, 'A'),
      ];

      const primary = getPrimaryRace(races);

      expect(primary?.id).toBe('race-60');
      expect(primary?.priority).toBe('A');
    });

    it('should return first race if no A-priority races', () => {
      const races = [
        createMockRace(30, 'B'),
        createMockRace(60, 'C'),
      ];

      const primary = getPrimaryRace(races);

      expect(primary?.id).toBe('race-30');
    });

    it('should return null if no upcoming races', () => {
      const races = [
        createMockRace(-7, 'A'),
        createMockRace(-30, 'B'),
      ];

      const primary = getPrimaryRace(races);

      expect(primary).toBeNull();
    });
  });

  describe('weeksUntilRace', () => {
    it('should calculate weeks until race', () => {
      const race = createMockRace(21); // 3 weeks

      const weeks = weeksUntilRace(race);

      expect(weeks).toBe(3);
    });

    it('should work with custom reference date', () => {
      const race = { ...createMockRace(0), date: new Date('2024-02-01') };
      const refDate = new Date('2024-01-01');

      const weeks = weeksUntilRace(race, refDate);

      expect(weeks).toBeGreaterThanOrEqual(4);
    });
  });

  describe('daysUntilRace', () => {
    it('should calculate days until race', () => {
      const race = createMockRace(14);

      const days = daysUntilRace(race);

      expect(days).toBe(14);
    });

    it('should return negative for past races', () => {
      const race = createMockRace(-7);

      const days = daysUntilRace(race);

      expect(days).toBeLessThan(0);
    });
  });

  // ========== TAPER PLANNING TESTS ==========

  describe('calculateTaperDuration', () => {
    it('should calculate taper duration for 5K', () => {
      const race = createMockRace(30, 'B', '5K');
      const duration = calculateTaperDuration(race);

      expect(duration).toBe(3);
    });

    it('should calculate taper duration for marathon', () => {
      const race = createMockRace(60, 'B', 'MARATHON');
      const duration = calculateTaperDuration(race);

      expect(duration).toBe(14);
    });

    it('should calculate taper duration for Ironman', () => {
      const race = createMockRace(90, 'B', 'IRONMAN');
      const duration = calculateTaperDuration(race);

      expect(duration).toBe(21);
    });

    it('should increase taper duration for A-priority races', () => {
      const raceB = createMockRace(60, 'B', 'MARATHON');
      const raceA = createMockRace(60, 'A', 'MARATHON');

      const durationB = calculateTaperDuration(raceB);
      const durationA = calculateTaperDuration(raceA);

      expect(durationA).toBeGreaterThan(durationB);
    });

    it('should decrease taper duration for C-priority races', () => {
      const raceB = createMockRace(60, 'B', 'MARATHON');
      const raceC = createMockRace(60, 'C', 'MARATHON');

      const durationB = calculateTaperDuration(raceB);
      const durationC = calculateTaperDuration(raceC);

      expect(durationC).toBeLessThan(durationB);
    });
  });

  describe('generateTaperPlan', () => {
    it('should generate complete taper plan', () => {
      const race = createMockRace(30, 'A', 'MARATHON');
      const baselineVolume = 400; // minutes per week

      const plan = generateTaperPlan(race, baselineVolume);

      expect(plan.race).toEqual(race);
      expect(plan.taperDuration).toBeGreaterThan(0);
      expect(plan.taperStart).toBeInstanceOf(Date);
      expect(plan.phases.length).toBe(2);
      expect(plan.weeklyVolumeReductions.length).toBeGreaterThan(0);
      expect(plan.recommendations.length).toBeGreaterThan(0);
    });

    it('should create early and late taper phases', () => {
      const race = createMockRace(30, 'A', 'MARATHON');
      const plan = generateTaperPlan(race, 400);

      expect(plan.phases[0].name).toBe('Early Taper');
      expect(plan.phases[1].name).toBe('Late Taper');
      expect(plan.phases[0].volumeReduction).toBeLessThan(plan.phases[1].volumeReduction);
    });

    it('should progressively reduce weekly volume', () => {
      const race = createMockRace(30, 'A', 'MARATHON');
      const plan = generateTaperPlan(race, 400);

      for (let i = 1; i < plan.weeklyVolumeReductions.length; i++) {
        const current = plan.weeklyVolumeReductions[i];
        const previous = plan.weeklyVolumeReductions[i - 1];

        expect(current.reductionPercent).toBeGreaterThanOrEqual(previous.reductionPercent);
        expect(current.targetVolume).toBeLessThanOrEqual(previous.targetVolume);
      }
    });

    it('should cap volume reduction at 60%', () => {
      const race = createMockRace(30, 'A', 'IRONMAN');
      const plan = generateTaperPlan(race, 600);

      const maxReduction = Math.max(...plan.weeklyVolumeReductions.map((w) => w.reductionPercent));

      expect(maxReduction).toBeLessThanOrEqual(60);
    });

    it('should include A-race specific recommendations', () => {
      const race = createMockRace(30, 'A', 'MARATHON');
      const plan = generateTaperPlan(race, 400);

      const hasARaceRec = plan.recommendations.some((r) => r.toLowerCase().includes('a-priority'));

      expect(hasARaceRec).toBe(true);
    });

    it('should include nutrition recommendations for long races', () => {
      const race = createMockRace(30, 'B', 'IRONMAN');
      const plan = generateTaperPlan(race, 500);

      const hasNutritionRec = plan.recommendations.some((r) => r.toLowerCase().includes('nutrition'));

      expect(hasNutritionRec).toBe(true);
    });
  });

  describe('generateRacePeakPlan', () => {
    it('should generate complete peak plan', () => {
      const race = createMockRace(90, 'A', 'MARATHON');
      const currentVolume = 300;
      const weeksAvailable = 12;

      const plan = generateRacePeakPlan(race, currentVolume, weeksAvailable);

      expect(plan.race).toEqual(race);
      expect(plan.buildPhase).toBeDefined();
      expect(plan.peakPhase).toBeDefined();
      expect(plan.taperPhase).toBeDefined();
      expect(plan.raceWeek).toBeDefined();
    });

    it('should allocate 70% of weeks to build phase', () => {
      const race = createMockRace(70, 'A', 'MARATHON');
      const plan = generateRacePeakPlan(race, 300, 10);

      const taperWeeks = Math.ceil(plan.taperPhase.taperDuration / 7);
      const totalWeeks = 10;
      const nonTaperWeeks = totalWeeks - taperWeeks;
      const expectedBuildWeeks = Math.ceil(nonTaperWeeks * 0.7);

      const actualBuildDays = Math.ceil(
        (plan.buildPhase.end.getTime() - plan.buildPhase.start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const actualBuildWeeks = Math.ceil(actualBuildDays / 7);

      expect(actualBuildWeeks).toBe(expectedBuildWeeks);
    });

    it('should increase volume at peak phase', () => {
      const race = createMockRace(70, 'A', 'MARATHON');
      const currentVolume = 300;
      const plan = generateRacePeakPlan(race, currentVolume, 10);

      expect(plan.peakPhase.weeklyVolume).toBeGreaterThan(plan.buildPhase.weeklyVolume);
    });

    it('should schedule last workout 2 days before race', () => {
      const race = createMockRace(14, 'A', 'MARATHON');
      const plan = generateRacePeakPlan(race, 300, 8);

      const daysBefore = Math.round(
        (race.date.getTime() - plan.raceWeek.lastWorkout.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysBefore).toBe(2);
    });

    it('should schedule last hard effort 5 days before race', () => {
      const race = createMockRace(14, 'A', 'MARATHON');
      const plan = generateRacePeakPlan(race, 300, 8);

      const daysBefore = Math.round(
        (race.date.getTime() - plan.raceWeek.lastHardEffort.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysBefore).toBe(5);
    });

    it('should include race week recommendations', () => {
      const race = createMockRace(14, 'A', 'MARATHON');
      const plan = generateRacePeakPlan(race, 300, 8);

      expect(plan.raceWeek.recommendations.length).toBeGreaterThan(0);
      expect(plan.raceWeek.recommendations.some((r) => r.toLowerCase().includes('last workout'))).toBe(true);
    });
  });

  // ========== RACE-SPECIFIC RECOMMENDATIONS TESTS ==========

  describe('getRaceTrainingFocus', () => {
    it('should return focus areas for 5K/10K', () => {
      const race = createMockRace(30, 'B', '5K');
      const focus = getRaceTrainingFocus(race);

      expect(focus).toContain('VO2max intervals');
      expect(focus).toContain('Lactate threshold work');
    });

    it('should return focus areas for marathon', () => {
      const race = createMockRace(90, 'A', 'MARATHON');
      const focus = getRaceTrainingFocus(race);

      expect(focus).toContain('Long endurance runs');
      expect(focus).toContain('Race-pace practice');
      expect(focus).toContain('Nutrition and fueling strategy');
    });

    it('should return focus areas for Ironman', () => {
      const race = createMockRace(120, 'A', 'IRONMAN');
      const focus = getRaceTrainingFocus(race);

      expect(focus).toContain('Long endurance sessions');
      expect(focus).toContain('Brick workouts');
      expect(focus).toContain('Mental preparation');
    });

    it('should include triathlon-specific focus', () => {
      const race = { ...createMockRace(60, 'A', 'OLYMPIC'), sport: 'TRIATHLON' as Sport };
      const focus = getRaceTrainingFocus(race);

      expect(focus).toContain('Transition practice');
      expect(focus).toContain('Multi-sport endurance');
    });
  });

  describe('calculateRacePacing', () => {
    it('should return pacing strategy for all race distances', () => {
      const distances: RaceDistance[] = ['5K', '10K', 'HALF_MARATHON', 'MARATHON', 'IRONMAN'];

      distances.forEach((distance) => {
        const race = createMockRace(30, 'B', distance);
        const pacing = calculateRacePacing(race);

        expect(pacing.strategy).toBeTruthy();
        expect(typeof pacing.strategy).toBe('string');
      });
    });

    it('should generate splits for marathon with goal time', () => {
      const race = createMockRace(90, 'A', 'MARATHON');
      race.goalTime = '3:30:00';

      const pacing = calculateRacePacing(race, race.goalTime);

      expect(pacing.splits.length).toBeGreaterThan(0);
      expect(pacing.splits[0]).toHaveProperty('segment');
      expect(pacing.splits[0]).toHaveProperty('pace');
      expect(pacing.splits[0]).toHaveProperty('effort');
    });

    it('should recommend negative split for marathon', () => {
      const race = createMockRace(90, 'A', 'MARATHON');
      const pacing = calculateRacePacing(race);

      expect(pacing.strategy.toLowerCase()).toContain('negative split');
    });

    it('should recommend conservative start for ultra', () => {
      const race = createMockRace(120, 'A', 'ULTRA');
      const pacing = calculateRacePacing(race);

      expect(pacing.strategy.toLowerCase()).toContain('conservative');
    });
  });

  // ========== INTEGRATION TESTS ==========

  describe('isInTaperPeriod', () => {
    it('should return true for dates within taper period', () => {
      const race = createMockRace(10, 'B', 'MARATHON');
      const dateInTaper = addDays(race.date, -7);

      const result = isInTaperPeriod(dateInTaper, race);

      expect(result).toBe(true);
    });

    it('should return false for dates before taper starts', () => {
      const race = createMockRace(30, 'B', 'MARATHON');
      const dateBeforeTaper = addDays(race.date, -20);

      const result = isInTaperPeriod(dateBeforeTaper, race);

      expect(result).toBe(false);
    });

    it('should return false for dates after race', () => {
      const race = createMockRace(10, 'B', 'MARATHON');
      const dateAfterRace = addDays(race.date, 1);

      const result = isInTaperPeriod(dateAfterRace, race);

      expect(result).toBe(false);
    });

    it('should return true on race day', () => {
      const race = createMockRace(7, 'B', '10K');

      const result = isInTaperPeriod(race.date, race);

      expect(result).toBe(true);
    });
  });

  describe('getVolumeAdjustmentFactor', () => {
    it('should return 1.0 when no races are tapering', () => {
      const races = [createMockRace(60, 'A', 'MARATHON')];
      const date = new Date();

      const factor = getVolumeAdjustmentFactor(date, races);

      expect(factor).toBe(1.0);
    });

    it('should return reduced factor during taper period', () => {
      const race = createMockRace(7, 'B', 'MARATHON');
      const dateInTaper = addDays(race.date, -5);

      const factor = getVolumeAdjustmentFactor(dateInTaper, [race]);

      expect(factor).toBeLessThan(1.0);
      expect(factor).toBeGreaterThan(0.4); // Min 40% of baseline
    });

    it('should progressively reduce volume as race approaches', () => {
      const race = createMockRace(14, 'B', 'MARATHON');
      const earlyTaper = addDays(race.date, -12);
      const lateTaper = addDays(race.date, -3);

      const earlyFactor = getVolumeAdjustmentFactor(earlyTaper, [race]);
      const lateFactor = getVolumeAdjustmentFactor(lateTaper, [race]);

      expect(lateFactor).toBeLessThan(earlyFactor);
    });

    it('should use most restrictive taper when multiple races overlap', () => {
      const nearRace = createMockRace(5, 'A', '10K');
      const farRace = createMockRace(30, 'B', 'MARATHON');
      const date = addDays(nearRace.date, -3);

      const factor = getVolumeAdjustmentFactor(date, [nearRace, farRace]);

      expect(factor).toBeLessThan(0.8); // Significant reduction for near race
    });

    it('should not reduce volume before taper starts', () => {
      const race = createMockRace(30, 'B', 'MARATHON');
      const dateBeforeTaper = addDays(race.date, -20);

      const factor = getVolumeAdjustmentFactor(dateBeforeTaper, [race]);

      expect(factor).toBe(1.0);
    });
  });
});
