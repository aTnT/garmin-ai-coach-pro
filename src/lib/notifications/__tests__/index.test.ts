/**
 * Unit Tests for Notification System
 *
 * Tests notification creation, retrieval, and management
 */

import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  createNotification,
  getUnreadNotifications,
  markNotificationRead,
  cleanupExpiredNotifications,
  getNotificationCounts,
  notifyAdaptationRecommended,
  notifyCriticalReadiness,
  notifyReadinessImproved,
  notifyTeamInvite,
  notifyWorkoutReminder,
  notifyPlanCompleted,
  notifySubscriptionUpdated,
} from '../index';

describe('Notification System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification with all fields', async () => {
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'READINESS_CRITICAL',
        priority: 'URGENT',
        title: 'Low Readiness Alert',
        message: 'Your readiness is 25/100',
        actionUrl: '/dashboard',
        actionLabel: 'View Readiness',
        metadata: { score: 25 },
        read: false,
        readAt: null,
        createdAt: new Date(),
        expiresAt: null,
      };

      (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await createNotification({
        userId: 'user-123',
        type: 'READINESS_CRITICAL',
        priority: 'URGENT',
        title: 'Low Readiness Alert',
        message: 'Your readiness is 25/100',
        actionUrl: '/dashboard',
        actionLabel: 'View Readiness',
        metadata: { score: 25 },
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: 'READINESS_CRITICAL',
          priority: 'URGENT',
          title: 'Low Readiness Alert',
          message: 'Your readiness is 25/100',
          actionUrl: '/dashboard',
          actionLabel: 'View Readiness',
          metadata: { score: 25 },
          expiresAt: undefined,
        },
      });

      expect(result).toEqual(mockNotification);
    });

    it('should create notification with expiration', async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'TEAM_INVITE',
        priority: 'MEDIUM',
        title: 'Team Invitation',
        message: 'Coach invited you',
        actionUrl: '/dashboard/team',
        actionLabel: 'View',
        metadata: null,
        read: false,
        readAt: null,
        createdAt: new Date(),
        expiresAt,
      };

      (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await createNotification({
        userId: 'user-123',
        type: 'TEAM_INVITE',
        priority: 'MEDIUM',
        title: 'Team Invitation',
        message: 'Coach invited you',
        actionUrl: '/dashboard/team',
        actionLabel: 'View',
        expiresAt,
      });

      expect(result.expiresAt).toEqual(expiresAt);
    });
  });

  describe('getUnreadNotifications', () => {
    it('should retrieve unread notifications for user', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          userId: 'user-123',
          type: 'READINESS_CRITICAL',
          priority: 'URGENT',
          title: 'Alert 1',
          message: 'Message 1',
          actionUrl: '/dashboard',
          actionLabel: 'View',
          metadata: null,
          read: false,
          readAt: null,
          createdAt: new Date(),
          expiresAt: null,
        },
        {
          id: 'notif-2',
          userId: 'user-123',
          type: 'ADAPTATION_RECOMMENDED',
          priority: 'HIGH',
          title: 'Alert 2',
          message: 'Message 2',
          actionUrl: '/dashboard/plans/123',
          actionLabel: 'Review',
          metadata: null,
          read: false,
          readAt: null,
          createdAt: new Date(),
          expiresAt: null,
        },
      ];

      (prisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await getUnreadNotifications('user-123');

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          read: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      });

      expect(result).toEqual(mockNotifications);
      expect(result).toHaveLength(2);
    });

    it('should filter out expired notifications', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await getUnreadNotifications('user-123');

      const callArgs = (prisma.notification.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.OR[0]).toEqual({ expiresAt: null });
      expect(callArgs.where.OR[1]).toEqual({ expiresAt: { gt: expect.any(Date) } });
    });

    it('should order by priority then date', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await getUnreadNotifications('user-123');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        })
      );
    });

    it('should limit results to 50', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      await getUnreadNotifications('user-123');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe('markNotificationRead', () => {
    it('should mark notification as read with timestamp', async () => {
      await markNotificationRead('notif-123');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-123' },
        data: {
          read: true,
          readAt: expect.any(Date),
        },
      });
    });
  });

  describe('cleanupExpiredNotifications', () => {
    it('should delete expired notifications', async () => {
      (prisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await cleanupExpiredNotifications();

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });

      expect(result).toBe(5);
    });

    it('should return 0 when no notifications deleted', async () => {
      (prisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await cleanupExpiredNotifications();

      expect(result).toBe(0);
    });
  });

  describe('getNotificationCounts', () => {
    it('should count notifications by priority', async () => {
      const mockNotifications = [
        { priority: 'URGENT' },
        { priority: 'URGENT' },
        { priority: 'HIGH' },
        { priority: 'MEDIUM' },
        { priority: 'MEDIUM' },
        { priority: 'LOW' },
      ];

      (prisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await getNotificationCounts('user-123');

      expect(result).toEqual({
        total: 6,
        urgent: 2,
        high: 1,
        medium: 2,
        low: 1,
      });
    });

    it('should handle empty notifications', async () => {
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getNotificationCounts('user-123');

      expect(result).toEqual({
        total: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      });
    });
  });

  describe('Notification Helper Functions', () => {
    describe('notifyAdaptationRecommended', () => {
      it('should create high priority notification for critical urgency', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue({
          id: 'notif-123',
        });

        await notifyAdaptationRecommended({
          userId: 'user-123',
          planId: 'plan-123',
          planName: 'Marathon Training',
          adaptationId: 'adapt-123',
          urgency: 'critical',
          reasoning: 'Readiness is very low',
        });

        expect(prisma.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: 'ADAPTATION_RECOMMENDED',
            priority: 'HIGH',
            title: expect.stringContaining('Training Plan Adaptation'),
          }),
        });
      });

      it('should create medium priority notification for medium urgency', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue({
          id: 'notif-123',
        });

        await notifyAdaptationRecommended({
          userId: 'user-123',
          planId: 'plan-123',
          planName: 'Marathon Training',
          adaptationId: 'adapt-123',
          urgency: 'medium',
          reasoning: 'Slight adjustment needed',
        });

        expect(prisma.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            priority: 'MEDIUM',
          }),
        });
      });
    });

    describe('notifyCriticalReadiness', () => {
      it('should create urgent notification', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue({
          id: 'notif-123',
        });

        await notifyCriticalReadiness({
          userId: 'user-123',
          readinessScore: 25,
          factors: ['hrv', 'sleep'],
        });

        expect(prisma.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: 'READINESS_CRITICAL',
            priority: 'URGENT',
            title: 'Low Readiness Alert',
            message: expect.stringContaining('25/100'),
          }),
        });
      });
    });

    describe('notifyReadinessImproved', () => {
      it('should create low priority notification', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue({
          id: 'notif-123',
        });

        await notifyReadinessImproved({
          userId: 'user-123',
          readinessScore: 80,
          previousScore: 50,
        });

        expect(prisma.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: 'READINESS_IMPROVED',
            priority: 'LOW',
            message: expect.stringContaining('50'),
            message: expect.stringContaining('80'),
          }),
        });
      });
    });

    describe('notifyTeamInvite', () => {
      it('should create team invite notification', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue({
          id: 'notif-123',
        });

        await notifyTeamInvite({
          userId: 'user-123',
          coachName: 'Coach Smith',
          inviteId: 'invite-123',
        });

        expect(prisma.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: 'TEAM_INVITE',
            priority: 'MEDIUM',
            message: expect.stringContaining('Coach Smith'),
          }),
        });
      });
    });

    describe('notifyWorkoutReminder', () => {
      it('should create workout reminder notification', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue({
          id: 'notif-123',
        });

        const workoutTime = new Date('2024-01-15T06:00:00Z');

        await notifyWorkoutReminder({
          userId: 'user-123',
          workoutId: 'workout-123',
          workoutName: 'Long Run',
          workoutTime,
        });

        expect(prisma.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: 'WORKOUT_REMINDER',
            priority: 'LOW',
            title: 'Upcoming Workout',
          }),
        });
      });
    });

    describe('notifyPlanCompleted', () => {
      it('should create plan completion notification', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue({
          id: 'notif-123',
        });

        await notifyPlanCompleted({
          userId: 'user-123',
          planId: 'plan-123',
          planName: 'Marathon Training',
          stats: {
            totalWorkouts: 100,
            completedWorkouts: 90,
            completionRate: 0.9,
          },
        });

        expect(prisma.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: 'PLAN_COMPLETED',
            priority: 'MEDIUM',
            message: expect.stringContaining('90/100'),
            message: expect.stringContaining('90%'),
          }),
        });
      });
    });

    describe('notifySubscriptionUpdated', () => {
      it('should create subscription update notification', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue({
          id: 'notif-123',
        });

        await notifySubscriptionUpdated({
          userId: 'user-123',
          tier: 'PREMIUM',
          status: 'ACTIVE',
          message: 'Upgraded to Premium',
        });

        expect(prisma.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: 'SUBSCRIPTION_UPDATED',
            priority: 'MEDIUM',
            message: 'Upgraded to Premium',
          }),
        });
      });
    });
  });
});
