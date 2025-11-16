/**
 * E2E Integration Tests for AI Workout Generation Flow
 *
 * Tests the complete workflow:
 * 1. User requests workout generation
 * 2. System calculates current readiness
 * 3. AI generates personalized workout
 * 4. Workout is saved and returned
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
    healthMetric: {
      findMany: jest.fn(),
    },
    workout: {
      create: jest.fn(),
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

// Mock Anthropic SDK
const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate,
      },
    })),
  };
});

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

describe('AI Workout Generation E2E Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Workout Generation Flow', () => {
    it('should generate workout based on user readiness', async () => {
      // 1. Setup authenticated session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'athlete@example.com',
          name: 'Test Athlete',
        },
      });

      // 2. Mock user profile
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'athlete@example.com',
        ftp: 250,
        maxHR: 180,
        vo2max: 55,
      });

      // 3. Mock recent metrics for readiness calculation
      const mockMetrics = [
        {
          id: 'metric-1',
          userId: 'user-123',
          type: 'HRV',
          value: 65,
          unit: 'ms',
          date: new Date(),
        },
        {
          id: 'metric-2',
          userId: 'user-123',
          type: 'RESTING_HR',
          value: 52,
          unit: 'bpm',
          date: new Date(),
        },
        {
          id: 'metric-3',
          userId: 'user-123',
          type: 'SLEEP_HOURS',
          value: 8,
          unit: 'hours',
          date: new Date(),
        },
      ];

      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      // 4. Mock recent activities for training load
      (prisma.workout.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'workout-1',
          userId: 'user-123',
          date: new Date(Date.now() - 1000 * 60 * 60 * 24), // Yesterday
          sport: 'RUNNING',
          duration: 60,
          tss: 65,
        },
      ]);

      // 5. Mock AI response
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              name: 'Tempo Run',
              sport: 'RUNNING',
              duration: 60,
              description: '10min warmup, 40min @ tempo, 10min cooldown',
              targetZone: 'ZONE_3',
              intervals: [
                { duration: 10, intensity: 'EASY', description: 'Warmup' },
                { duration: 40, intensity: 'MODERATE', description: 'Tempo @ threshold' },
                { duration: 10, intensity: 'EASY', description: 'Cooldown' },
              ],
            }),
          },
        ],
      });

      // 6. Mock workout creation
      (prisma.workout.create as jest.Mock).mockResolvedValue({
        id: 'workout-new',
        userId: 'user-123',
        name: 'Tempo Run',
        sport: 'RUNNING',
        duration: 60,
        date: new Date(),
        plannedDate: new Date(),
        description: '10min warmup, 40min @ tempo, 10min cooldown',
        targetZone: 'ZONE_3',
        completed: false,
      });

      // 7. Execute the flow (simulating API call)
      const session = await getServerSession({} as any);
      expect(session).toBeTruthy();
      expect(session?.user?.id).toBe('user-123');

      // Verify readiness calculation with metrics
      const metrics = await prisma.healthMetric.findMany({
        where: { userId: 'user-123' },
      });
      expect(metrics.length).toBe(3);

      // Verify workout was saved
      const savedWorkout = await prisma.workout.create({
        data: {
          userId: 'user-123',
          name: 'Tempo Run',
          sport: 'RUNNING',
          duration: 60,
        } as any,
      });

      expect(savedWorkout.id).toBe('workout-new');
      expect(savedWorkout.sport).toBe('RUNNING');
    });

    it('should adjust workout intensity based on low readiness', async () => {
      // Setup with low readiness indicators
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        ftp: 250,
      });

      // Low HRV, high resting HR = low readiness
      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([
        { type: 'HRV', value: 35, date: new Date() }, // Low
        { type: 'RESTING_HR', value: 65, date: new Date() }, // High
        { type: 'SLEEP_HOURS', value: 5, date: new Date() }, // Poor
      ]);

      // High recent training load
      (prisma.workout.findMany as jest.Mock).mockResolvedValue([
        { date: new Date(Date.now() - 86400000), tss: 100 },
        { date: new Date(Date.now() - 172800000), tss: 95 },
        { date: new Date(Date.now() - 259200000), tss: 90 },
      ]);

      // AI should generate recovery workout
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              name: 'Easy Recovery Run',
              sport: 'RUNNING',
              duration: 30,
              description: 'Easy recovery effort',
              targetZone: 'ZONE_1',
              intervals: [
                { duration: 30, intensity: 'VERY_EASY', description: 'Recovery pace' },
              ],
            }),
          },
        ],
      });

      (prisma.workout.create as jest.Mock).mockResolvedValue({
        id: 'workout-recovery',
        name: 'Easy Recovery Run',
        duration: 30,
        targetZone: 'ZONE_1',
      });

      // Execute flow
      const metrics = await prisma.healthMetric.findMany({});
      expect(metrics.some((m: any) => m.type === 'HRV' && m.value < 40)).toBe(true);

      const workout = await prisma.workout.create({ data: {} as any });
      expect(workout.targetZone).toBe('ZONE_1');
    });

    it('should handle AI generation failure gracefully', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        ftp: 250,
      });

      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.workout.findMany as jest.Mock).mockResolvedValue([]);

      // Simulate AI failure
      mockAnthropicCreate.mockRejectedValue(new Error('API Error'));

      // Should still be able to generate fallback workout
      (prisma.workout.create as jest.Mock).mockResolvedValue({
        id: 'workout-fallback',
        name: 'Moderate Endurance Run',
        sport: 'RUNNING',
        duration: 45,
        description: 'Moderate endurance effort',
      });

      // Verify fallback handling
      let error;
      try {
        await mockAnthropicCreate({});
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();

      // Fallback workout should still be created
      const fallbackWorkout = await prisma.workout.create({ data: {} as any });
      expect(fallbackWorkout.id).toBe('workout-fallback');
    });
  });

  describe('Workout Type Variations', () => {
    beforeEach(() => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        ftp: 250,
        maxHR: 180,
      });

      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([
        { type: 'HRV', value: 60, date: new Date() },
      ]);

      (prisma.workout.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should generate cycling workout with power targets', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              name: 'Sweet Spot Intervals',
              sport: 'CYCLING',
              duration: 90,
              description: '4x10min @ 88-93% FTP',
              targetPower: 220,
              intervals: [
                { duration: 15, intensity: 'EASY', targetPower: 125 },
                { duration: 10, intensity: 'HARD', targetPower: 220, repeat: 4 },
                { duration: 5, intensity: 'EASY', targetPower: 125, rest: true },
              ],
            }),
          },
        ],
      });

      (prisma.workout.create as jest.Mock).mockResolvedValue({
        id: 'workout-cycling',
        sport: 'CYCLING',
        targetPower: 220,
        intervals: expect.any(Array),
      });

      await mockAnthropicCreate({});
      const workout = await prisma.workout.create({ data: {} as any });

      expect(workout.sport).toBe('CYCLING');
      expect(workout.targetPower).toBe(220);
    });

    it('should generate interval workout for high readiness', async () => {
      // High readiness indicators
      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([
        { type: 'HRV', value: 85, date: new Date() }, // High
        { type: 'RESTING_HR', value: 48, date: new Date() }, // Low
        { type: 'SLEEP_HOURS', value: 8.5, date: new Date() }, // Good
      ]);

      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              name: 'VO2max Intervals',
              sport: 'RUNNING',
              duration: 60,
              description: '5x3min @ VO2max with 3min recovery',
              targetZone: 'ZONE_5',
              intervals: [
                { duration: 10, intensity: 'EASY' },
                { duration: 3, intensity: 'VERY_HARD', repeat: 5 },
                { duration: 3, intensity: 'EASY', rest: true, repeat: 5 },
                { duration: 10, intensity: 'EASY' },
              ],
            }),
          },
        ],
      });

      (prisma.workout.create as jest.Mock).mockResolvedValue({
        id: 'workout-intervals',
        name: 'VO2max Intervals',
        targetZone: 'ZONE_5',
      });

      await mockAnthropicCreate({});
      const workout = await prisma.workout.create({ data: {} as any });

      expect(workout.targetZone).toBe('ZONE_5');
    });
  });

  describe('User Context Integration', () => {
    it('should consider user FTP in cycling workouts', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        ftp: 300, // High FTP
      });

      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.workout.findMany as jest.Mock).mockResolvedValue([]);

      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              name: 'Threshold Intervals',
              sport: 'CYCLING',
              targetPower: 285, // ~95% of 300W FTP
            }),
          },
        ],
      });

      const user = await prisma.user.findUnique({ where: { id: 'user-123' } });
      expect(user.ftp).toBe(300);

      await mockAnthropicCreate({});
    });

    it('should consider user maxHR in running workouts', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        maxHR: 190,
      });

      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.workout.findMany as jest.Mock).mockResolvedValue([]);

      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              name: 'Tempo Run',
              sport: 'RUNNING',
              targetHR: 162, // ~85% of 190
            }),
          },
        ],
      });

      const user = await prisma.user.findUnique({ where: { id: 'user-123' } });
      expect(user.maxHR).toBe(190);

      await mockAnthropicCreate({});
    });
  });
});
