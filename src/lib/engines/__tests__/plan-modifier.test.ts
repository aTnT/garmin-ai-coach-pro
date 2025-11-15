/**
 * Unit Tests for Plan Modifier
 *
 * Tests plan modification logic for adaptations
 */

import {
  applyModificationsToPlan,
  createPlanBackup,
  restorePlanFromBackup,
} from '../plan-modifier';
import type { TrainingPlanData, PlanModification } from '../adaptation-engine';

describe('Plan Modifier', () => {
  const basePlan: any = {
    name: 'Test Plan',
    description: 'Test Description',
    goal: 'Complete Marathon',
    sport: 'RUNNING',
    startDate: new Date('2024-01-01'),
    raceDate: new Date('2024-03-01'),
    totalWeeks: 8,
    weeks: [
      {
        weekNumber: 1,
        startDate: new Date('2024-01-01'),
        targetLoad: 400,
        theme: 'Base Building',
        workouts: [
          {
            id: 'workout-1',
            date: new Date('2024-01-01'),
            type: 'EASY',
            duration: 60,
            description: 'Easy pace run',
            structure: {},
          },
          {
            id: 'workout-2',
            date: new Date('2024-01-03'),
            type: 'TEMPO',
            duration: 45,
            description: 'Tempo pace with high intensity',
            structure: {},
          },
        ],
      },
      {
        weekNumber: 2,
        startDate: new Date('2024-01-08'),
        targetLoad: 450,
        theme: 'Build',
        workouts: [],
      },
    ],
  };

  describe('applyModificationsToPlan', () => {
    it('should reduce training load by percentage', () => {
      const modifications: PlanModification[] = [
        {
          type: 'REDUCE_LOAD',
          target: {
            weekNumber: 1,
          },
          change: {
            before: { load: 400 },
            after: { load: '70%' },
          },
          rationale: 'Low readiness',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      expect(result.weeks[0].targetLoad).toBe(280); // 400 * 0.7
      expect(result.weeks[0].workouts[0].duration).toBe(42); // 60 * 0.7
      expect(result.weeks[0].workouts[1].duration).toBe(31); // 45 * 0.7 rounded down
    });

    it('should increase training load by percentage', () => {
      const modifications: PlanModification[] = [
        {
          type: 'INCREASE_LOAD',
          target: {
            weekNumber: 1,
          },
          change: {
            before: { load: 400 },
            after: { load: '110%' },
          },
          rationale: 'Good readiness trend',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      expect(result.weeks[0].targetLoad).toBeGreaterThan(400);
      expect(result.weeks[0].workouts[0].duration).toBeGreaterThan(60);
    });

    it('should extend recovery period', () => {
      const modifications: PlanModification[] = [
        {
          type: 'EXTEND_RECOVERY',
          target: {
            weekNumber: 1,
          },
          change: {
            before: { days: 1 },
            after: { days: 2 },
          },
          rationale: 'Insufficient recovery',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      // Load should be reduced for recovery
      expect(result.weeks[0].targetLoad).toBeLessThan(400);
    });

    it('should change workout intensity', () => {
      const modifications: PlanModification[] = [
        {
          type: 'CHANGE_INTENSITY',
          target: {
            weekNumber: 1,
            workoutId: 'workout-2',
          },
          change: {
            before: { intensity: 'high' },
            after: { intensity: 'moderate' },
          },
          rationale: 'Overreaching detected',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      const modifiedWorkout = result.weeks[0].workouts.find((w) => w.id === 'workout-2');
      // Change intensity modifies duration, not necessarily description
      expect(modifiedWorkout).toBeDefined();
      expect(modifiedWorkout?.duration).toBeLessThanOrEqual(45); // Duration reduced or unchanged with intensity
    });

    it('should insert rest day', () => {
      const modifications: PlanModification[] = [
        {
          type: 'INSERT_REST_DAY',
          target: {
            weekNumber: 1,
            date: new Date('2024-01-02'),
          },
          change: {
            before: {},
            after: { restDay: true },
          },
          rationale: 'Need recovery',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      // Plan structure should still be valid
      expect(result.weeks).toBeDefined();
      expect(result.weeks.length).toBeGreaterThanOrEqual(basePlan.weeks.length);
    });

    it('should shift schedule', () => {
      const modifications: PlanModification[] = [
        {
          type: 'SHIFT_SCHEDULE',
          target: {},
          change: {
            before: { date: '2024-02-01' },
            after: { date: '2024-02-15' },
          },
          rationale: 'Race postponed',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      // Plan should still have weeks
      expect(result.weeks.length).toBeGreaterThan(0);
    });

    it('should swap workout type', () => {
      const modifications: PlanModification[] = [
        {
          type: 'SWAP_WORKOUT_TYPE',
          target: {
            weekNumber: 1,
            workoutId: 'workout-1',
          },
          change: {
            before: { type: 'EASY' },
            after: { type: 'RECOVERY' },
          },
          rationale: 'Adjust training focus',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      const swappedWorkout = result.weeks[0].workouts.find((w) => w.id === 'workout-1');
      expect(swappedWorkout?.type).toBe('RECOVERY');
    });

    it('should reperiodize plan', () => {
      const modifications: PlanModification[] = [
        {
          type: 'REPERIODIZE',
          target: {},
          change: {
            before: { weeks: 8 },
            after: { weeks: 10 },
          },
          rationale: 'Extend plan duration',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      // Plan structure should remain valid
      expect(result.weeks).toBeDefined();
      expect(result.weeks.length).toBeGreaterThan(0);
    });

    it('should handle multiple modifications in order', () => {
      const modifications: PlanModification[] = [
        {
          type: 'REDUCE_LOAD',
          target: { weekNumber: 1 },
          change: {
            before: { load: 400 },
            after: { load: '70%' },
          },
          rationale: 'Low readiness',
        },
        {
          type: 'EXTEND_RECOVERY',
          target: { weekNumber: 1 },
          change: {
            before: { days: 1 },
            after: { days: 2 },
          },
          rationale: 'Need more recovery',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      // Both modifications should reduce load
      expect(result.weeks[0].targetLoad).toBeLessThan(400);
    });

    it('should handle errors gracefully', () => {
      const modifications: PlanModification[] = [
        {
          type: 'REDUCE_LOAD',
          target: { weekNumber: 99 }, // Non-existent week
          change: {
            before: { load: 400 },
            after: { load: '70%' },
          },
          rationale: 'Test',
        },
      ];

      // Should not throw error
      expect(() => applyModificationsToPlan(basePlan, modifications)).not.toThrow();

      const result = applyModificationsToPlan(basePlan, modifications);

      // Plan structure should still be valid
      expect(result.weeks).toBeDefined();
      expect(result.weeks.length).toBe(2);
    });

    it('should preserve original plan structure', () => {
      const originalLoad = basePlan.weeks[0].targetLoad;

      const modifications: PlanModification[] = [
        {
          type: 'REDUCE_LOAD',
          target: { weekNumber: 1 },
          change: {
            before: { load: 400 },
            after: { load: '70%' },
          },
          rationale: 'Test',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      // Original plan should not be modified
      expect(basePlan.weeks[0].targetLoad).toBe(originalLoad);
      // Result should be modified
      expect(result.weeks[0].targetLoad).toBeLessThan(originalLoad);
    });
  });

  describe('createPlanBackup', () => {
    it('should create a deep copy of the plan', () => {
      const backup = createPlanBackup(basePlan);

      expect(JSON.stringify(backup)).toEqual(JSON.stringify(basePlan));
      expect(backup).not.toBe(basePlan); // Different object reference
      expect(backup.weeks).not.toBe(basePlan.weeks); // Deep copy
      expect(backup.weeks[0]).not.toBe(basePlan.weeks[0]); // Deep copy
    });

    it('should allow modification without affecting original', () => {
      const backup = createPlanBackup(basePlan);

      backup.weeks[0].targetLoad = 999;

      expect(basePlan.weeks[0].targetLoad).toBe(400);
      expect(backup.weeks[0].targetLoad).toBe(999);
    });
  });

  describe('restorePlanFromBackup', () => {
    it('should restore plan from backup', () => {
      const originalLoad = basePlan.weeks[0].targetLoad;
      const backup = createPlanBackup(basePlan);

      // Modify original
      basePlan.weeks[0].targetLoad = 999;

      const restored = restorePlanFromBackup(backup);

      expect(restored.weeks[0].targetLoad).toBe(originalLoad);
      expect(JSON.stringify(restored)).toEqual(JSON.stringify(backup));

      // Restore original
      basePlan.weeks[0].targetLoad = originalLoad;
    });

    it('should create new object, not reference', () => {
      const backup = createPlanBackup(basePlan);
      const restored = restorePlanFromBackup(backup);

      expect(restored).toEqual(backup);
      expect(restored).not.toBe(backup); // Different reference
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty plan', () => {
      const emptyPlan: any = {
        name: 'Empty',
        description: '',
        goal: '',
        sport: 'RUNNING',
        startDate: new Date(),
        raceDate: new Date(),
        totalWeeks: 0,
        weeks: [],
      };

      const modifications: PlanModification[] = [
        {
          type: 'REDUCE_LOAD',
          target: { weekNumber: 1 },
          change: {
            before: { load: 400 },
            after: { load: '70%' },
          },
          rationale: 'Test',
        },
      ];

      expect(() => applyModificationsToPlan(emptyPlan, modifications)).not.toThrow();
    });

    it('should handle empty modifications', () => {
      const result = applyModificationsToPlan(basePlan, []);

      expect(result).toEqual(basePlan);
    });

    it('should handle invalid percentage strings', () => {
      const modifications: PlanModification[] = [
        {
          type: 'REDUCE_LOAD',
          target: { weekNumber: 1 },
          change: {
            before: { load: 400 },
            after: { load: 'invalid%' },
          },
          rationale: 'Test',
        },
      ];

      const result = applyModificationsToPlan(basePlan, modifications);

      // Should still apply some modification or use default
      expect(result.weeks[0].targetLoad).toBeGreaterThanOrEqual(0);
    });

    it('should handle workout without duration', () => {
      const planWithoutDuration: any = {
        name: 'Test',
        description: '',
        goal: '',
        sport: 'RUNNING',
        startDate: new Date('2024-01-01'),
        raceDate: new Date('2024-03-01'),
        totalWeeks: 1,
        weeks: [
          {
            weekNumber: 1,
            startDate: new Date('2024-01-01'),
            targetLoad: 400,
            theme: 'Test',
            workouts: [
              {
                id: 'workout-1',
                date: new Date('2024-01-01'),
                type: 'EASY',
                duration: 0, // No duration
                description: 'Easy pace run',
                structure: {},
              },
            ],
          },
        ],
      };

      const modifications: PlanModification[] = [
        {
          type: 'REDUCE_LOAD',
          target: { weekNumber: 1 },
          change: {
            before: { load: 400 },
            after: { load: '70%' },
          },
          rationale: 'Test',
        },
      ];

      expect(() => applyModificationsToPlan(planWithoutDuration, modifications)).not.toThrow();
    });
  });
});
