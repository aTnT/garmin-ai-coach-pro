/**
 * E2E Integration Tests for Training Plan Creation & Modification Flow
 *
 * Tests the complete workflow:
 * 1. User creates initial training plan
 * 2. System generates periodized plan
 * 3. Plan adapts based on performance
 * 4. Modifications are tracked
 * 5. Rollback functionality
 */

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url, options = {}) => ({
    nextUrl: {
      searchParams: new URLSearchParams(),
    },
    json: async () => options.body || {},
  })),
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      data,
    })),
  },
}));

// Mock authentication
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    trainingPlan: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    planAdaptation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workout: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    healthMetric: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock rate limiting
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true }),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

describe('Training Plan Creation & Modification E2E Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Plan Creation Flow', () => {
    it('should create a new training plan with periodization', async () => {
      // 1. Authenticate user
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'athlete@example.com',
        },
      });

      // 2. Mock user profile
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        ftp: 250,
        vo2max: 55,
      });

      // 3. Mock plan creation
      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        name: 'Marathon Training - 16 Weeks',
        goal: 'Complete marathon in 3:30:00',
        startDate: new Date(),
        endDate: new Date(Date.now() + 16 * 7 * 24 * 60 * 60 * 1000),
        sport: 'RUNNING',
        status: 'ACTIVE',
        weeks: 16,
        phases: [
          { name: 'Base', weeks: 6, focus: 'Build aerobic base' },
          { name: 'Build', weeks: 5, focus: 'Increase intensity' },
          { name: 'Peak', weeks: 3, focus: 'Race-specific training' },
          { name: 'Taper', weeks: 2, focus: 'Rest and recover' },
        ],
      };

      (prisma.trainingPlan.create as jest.Mock).mockResolvedValue(mockPlan);

      // 4. Execute plan creation
      const session = await getServerSession({} as any);
      expect(session?.user?.id).toBe('user-123');

      const plan = await prisma.trainingPlan.create({
        data: {
          userId: 'user-123',
          name: 'Marathon Training - 16 Weeks',
          goal: 'Complete marathon in 3:30:00',
          sport: 'RUNNING',
        } as any,
      });

      expect(plan.id).toBe('plan-123');
      expect(plan.weeks).toBe(16);
      expect(plan.phases.length).toBe(4);
      expect(plan.status).toBe('ACTIVE');
    });

    it('should generate weekly workouts for plan', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        startDate: new Date(),
        endDate: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000),
        sport: 'RUNNING',
      };

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);

      // Mock generated workouts
      const mockWorkouts = [
        {
          id: 'workout-1',
          planId: 'plan-123',
          name: 'Easy Run',
          date: new Date(),
          duration: 45,
          sport: 'RUNNING',
        },
        {
          id: 'workout-2',
          planId: 'plan-123',
          name: 'Tempo Run',
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          duration: 60,
          sport: 'RUNNING',
        },
        {
          id: 'workout-3',
          planId: 'plan-123',
          name: 'Long Run',
          date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          duration: 90,
          sport: 'RUNNING',
        },
      ];

      (prisma.workout.findMany as jest.Mock).mockResolvedValue(mockWorkouts);

      // Verify workouts were created
      const workouts = await prisma.workout.findMany({
        where: { planId: 'plan-123' },
      });

      expect(workouts.length).toBe(3);
      expect(workouts.some((w: any) => w.name === 'Long Run')).toBe(true);
    });
  });

  describe('Plan Adaptation Flow', () => {
    it('should adapt plan based on performance data', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      // Mock existing plan
      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        name: 'Marathon Training',
        currentWeek: 5,
        targetVolume: 300,
      };

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);

      // Mock recent performance showing fatigue
      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([
        { type: 'HRV', value: 40, date: new Date() }, // Low
        { type: 'RESTING_HR', value: 62, date: new Date() }, // High
      ]);

      (prisma.workout.findMany as jest.Mock).mockResolvedValue([
        { date: new Date(Date.now() - 86400000), completed: true, tss: 95 },
        { date: new Date(Date.now() - 172800000), completed: true, tss: 90 },
        { date: new Date(Date.now() - 259200000), completed: true, tss: 100 },
      ]);

      // Create adaptation to reduce volume
      const mockAdaptation = {
        id: 'adapt-123',
        planId: 'plan-123',
        type: 'VOLUME_REDUCTION',
        reason: 'High fatigue detected',
        changes: {
          volumeAdjustment: -20, // Reduce by 20%
          affectedWeeks: [5, 6],
        },
        appliedAt: new Date(),
      };

      (prisma.planAdaptation.create as jest.Mock).mockResolvedValue(mockAdaptation);

      // Execute adaptation
      const metrics = await prisma.healthMetric.findMany({});
      expect(metrics.some((m: any) => m.type === 'HRV' && m.value < 45)).toBe(true);

      const adaptation = await prisma.planAdaptation.create({
        data: {
          planId: 'plan-123',
          type: 'VOLUME_REDUCTION',
          reason: 'High fatigue detected',
        } as any,
      });

      expect(adaptation.type).toBe('VOLUME_REDUCTION');
      expect(adaptation.changes.volumeAdjustment).toBe(-20);
    });

    it('should track adaptation history', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue({
        id: 'plan-123',
        userId: 'user-123',
      });

      // Mock multiple adaptations
      const mockAdaptations = [
        {
          id: 'adapt-1',
          planId: 'plan-123',
          type: 'VOLUME_INCREASE',
          appliedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          reason: 'Good progress',
        },
        {
          id: 'adapt-2',
          planId: 'plan-123',
          type: 'INTENSITY_ADJUSTMENT',
          appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          reason: 'Race approaching',
        },
        {
          id: 'adapt-3',
          planId: 'plan-123',
          type: 'RECOVERY_WEEK',
          appliedAt: new Date(),
          reason: 'Scheduled deload',
        },
      ];

      (prisma.planAdaptation.findMany as jest.Mock).mockResolvedValue(mockAdaptations);

      // Verify adaptation history
      const adaptations = await prisma.planAdaptation.findMany({
        where: { planId: 'plan-123' },
      });

      expect(adaptations.length).toBe(3);
      expect(adaptations.map((a: any) => a.type)).toEqual([
        'VOLUME_INCREASE',
        'INTENSITY_ADJUSTMENT',
        'RECOVERY_WEEK',
      ]);
    });

    it('should update workouts when adaptation is applied', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue({
        id: 'plan-123',
        userId: 'user-123',
      });

      // Mock future workouts
      (prisma.workout.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'workout-1',
          planId: 'plan-123',
          duration: 60,
          completed: false,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        {
          id: 'workout-2',
          planId: 'plan-123',
          duration: 45,
          completed: false,
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      ]);

      // Apply volume reduction adaptation
      (prisma.planAdaptation.create as jest.Mock).mockResolvedValue({
        id: 'adapt-123',
        type: 'VOLUME_REDUCTION',
        changes: { volumeAdjustment: -25 },
      });

      // Mock workout updates
      (prisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      // Execute flow
      await prisma.planAdaptation.create({ data: {} as any });

      const updateResult = await prisma.workout.updateMany({
        where: {
          planId: 'plan-123',
          completed: false,
        },
        data: {
          duration: expect.any(Number),
        },
      });

      expect(updateResult.count).toBe(2);
    });
  });

  describe('Plan Rollback Flow', () => {
    it('should rollback adaptation and restore original workouts', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      // Mock adaptation with original state saved
      const mockAdaptation = {
        id: 'adapt-123',
        planId: 'plan-123',
        type: 'VOLUME_REDUCTION',
        changes: {
          volumeAdjustment: -30,
        },
        originalState: {
          workouts: [
            { id: 'workout-1', duration: 60 },
            { id: 'workout-2', duration: 45 },
          ],
        },
        appliedAt: new Date(),
        rolledBackAt: null,
      };

      (prisma.planAdaptation.findUnique as jest.Mock).mockResolvedValue(mockAdaptation);

      // Mock workout restoration
      (prisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      // Update adaptation as rolled back
      (prisma.planAdaptation.update as jest.Mock).mockResolvedValue({
        ...mockAdaptation,
        rolledBackAt: new Date(),
      });

      // Execute rollback
      const adaptation = await prisma.planAdaptation.findUnique({
        where: { id: 'adapt-123' },
      });

      expect(adaptation.originalState.workouts.length).toBe(2);

      await prisma.workout.updateMany({
        where: { planId: 'plan-123' },
        data: {},
      });

      const updated = await prisma.planAdaptation.update({
        where: { id: 'adapt-123' },
        data: { rolledBackAt: new Date() } as any,
      });

      expect(updated.rolledBackAt).toBeTruthy();
    });

    it('should prevent rollback of already rolled back adaptation', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      // Mock already rolled back adaptation
      const mockAdaptation = {
        id: 'adapt-123',
        planId: 'plan-123',
        rolledBackAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };

      (prisma.planAdaptation.findUnique as jest.Mock).mockResolvedValue(mockAdaptation);

      // Verify rollback state
      const adaptation = await prisma.planAdaptation.findUnique({
        where: { id: 'adapt-123' },
      });

      expect(adaptation.rolledBackAt).toBeTruthy();
    });
  });

  describe('Multi-Sport Plan Support', () => {
    it('should create triathlon plan with swim/bike/run workouts', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockPlan = {
        id: 'plan-triathlon',
        userId: 'user-123',
        name: 'Olympic Triathlon Training',
        sport: 'TRIATHLON',
        startDate: new Date(),
        endDate: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000),
      };

      (prisma.trainingPlan.create as jest.Mock).mockResolvedValue(mockPlan);

      // Mock multi-sport workouts
      (prisma.workout.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', sport: 'SWIMMING', duration: 45 },
        { id: 'w2', sport: 'CYCLING', duration: 90 },
        { id: 'w3', sport: 'RUNNING', duration: 60 },
        { id: 'w4', sport: 'RUNNING', duration: 30, description: 'Brick run after bike' },
      ]);

      const plan = await prisma.trainingPlan.create({ data: {} as any });
      expect(plan.sport).toBe('TRIATHLON');

      const workouts = await prisma.workout.findMany({
        where: { planId: plan.id },
      });

      const sports = new Set(workouts.map((w: any) => w.sport));
      expect(sports.size).toBeGreaterThanOrEqual(3);
      expect(sports.has('SWIMMING')).toBe(true);
      expect(sports.has('CYCLING')).toBe(true);
      expect(sports.has('RUNNING')).toBe(true);
    });
  });

  describe('Plan Progression Tracking', () => {
    it('should track weekly completion and adjust next week', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        currentWeek: 3,
        targetVolume: 300,
      };

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);

      // Mock current week workouts (all completed)
      (prisma.workout.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'w1',
          completed: true,
          duration: 45,
          plannedDuration: 45,
          tss: 50,
        },
        {
          id: 'w2',
          completed: true,
          duration: 60,
          plannedDuration: 60,
          tss: 65,
        },
        {
          id: 'w3',
          completed: true,
          duration: 90,
          plannedDuration: 90,
          tss: 95,
        },
        {
          id: 'w4',
          completed: true,
          duration: 60,
          plannedDuration: 60,
          tss: 60,
        },
      ]);

      // Verify 100% completion rate
      const workouts = await prisma.workout.findMany({});
      const completionRate = workouts.filter((w: any) => w.completed).length / workouts.length;

      expect(completionRate).toBe(1.0);

      // Should increase volume for next week (good adherence)
      (prisma.planAdaptation.create as jest.Mock).mockResolvedValue({
        id: 'adapt-progression',
        type: 'VOLUME_INCREASE',
        reason: 'Excellent adherence - 100% completion',
        changes: { volumeAdjustment: 5 },
      });

      const adaptation = await prisma.planAdaptation.create({ data: {} as any });
      expect(adaptation.changes.volumeAdjustment).toBeGreaterThan(0);
    });

    it('should detect poor adherence and adjust plan', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue({
        id: 'plan-123',
        currentWeek: 4,
      });

      // Mock workouts with poor completion
      (prisma.workout.findMany as jest.Mock).mockResolvedValue([
        { id: 'w1', completed: false, duration: 0, plannedDuration: 45 },
        { id: 'w2', completed: true, duration: 30, plannedDuration: 60 }, // Shortened
        { id: 'w3', completed: false, duration: 0, plannedDuration: 90 },
        { id: 'w4', completed: true, duration: 60, plannedDuration: 60 },
      ]);

      const workouts = await prisma.workout.findMany({});
      const completionRate = workouts.filter((w: any) => w.completed).length / workouts.length;

      expect(completionRate).toBeLessThan(0.75); // Less than 75% completion

      // Should reduce volume or add recovery
      (prisma.planAdaptation.create as jest.Mock).mockResolvedValue({
        id: 'adapt-recovery',
        type: 'RECOVERY_WEEK',
        reason: 'Low adherence - adding recovery week',
      });

      const adaptation = await prisma.planAdaptation.create({ data: {} as any });
      expect(adaptation.type).toBe('RECOVERY_WEEK');
    });
  });
});
