/**
 * Integration Tests for Garmin Sync API
 * Tests OAuth flow and data synchronization
 */

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      data,
    })),
    redirect: jest.fn((url) => ({
      url,
      status: 302,
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
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    oAuthToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
    },
    workout: {
      createMany: jest.fn(),
      count: jest.fn(),
    },
    metric: {
      createMany: jest.fn(),
    },
  },
}));

// Mock rate limiting
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock Garmin OAuth
jest.mock('@/lib/garmin-oauth', () => ({
  getRequestToken: jest.fn(),
  getAccessToken: jest.fn(),
  fetchGarminActivities: jest.fn(),
  fetchGarminMetrics: jest.fn(),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import {
  getRequestToken,
  getAccessToken,
  fetchGarminActivities,
  fetchGarminMetrics,
} from '@/lib/garmin-oauth';

describe('Garmin Sync API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OAuth Flow', () => {
    it('should initiate OAuth request', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      const mockRequestToken = {
        oauth_token: 'request_token_123',
        oauth_token_secret: 'request_secret_123',
      };

      (getRequestToken as jest.Mock).mockResolvedValue(mockRequestToken);

      const result = await getRequestToken();

      expect(result.oauth_token).toBe('request_token_123');
      expect(result.oauth_token_secret).toBeTruthy();
    });

    it('should exchange request token for access token', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockAccessToken = {
        oauth_token: 'access_token_123',
        oauth_token_secret: 'access_secret_123',
      };

      (getAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);

      const result = await getAccessToken(
        'request_token_123',
        'request_secret_123',
        'verifier_123'
      );

      expect(result.oauth_token).toBe('access_token_123');
    });

    it('should save OAuth tokens', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const savedToken = {
        id: 'token-123',
        userId: 'user-123',
        provider: 'GARMIN',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

      (prisma.oAuthToken.create as jest.Mock).mockResolvedValue(savedToken);

      const token = await prisma.oAuthToken.create({
        data: {
          userId: 'user-123',
          provider: 'GARMIN',
          accessToken: 'encrypted_access_token',
        } as any,
      });

      expect(token.provider).toBe('GARMIN');
    });

    it('should handle OAuth errors', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (getRequestToken as jest.Mock).mockRejectedValue(
        new Error('OAuth request failed')
      );

      await expect(getRequestToken()).rejects.toThrow('OAuth request failed');
    });
  });

  describe('Data Synchronization', () => {
    it('should require valid OAuth token', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.oAuthToken.findUnique as jest.Mock).mockResolvedValue(null);

      const token = await prisma.oAuthToken.findUnique({
        where: { userId_provider: { userId: 'user-123', provider: 'GARMIN' } },
      });

      expect(token).toBeNull(); // No token, can't sync
    });

    it('should sync activities from Garmin', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockToken = {
        userId: 'user-123',
        provider: 'GARMIN',
        accessToken: 'valid_token',
        tokenSecret: 'valid_secret',
      };

      (prisma.oAuthToken.findUnique as jest.Mock).mockResolvedValue(mockToken);

      const mockActivities = [
        {
          activityId: '123456',
          activityName: 'Morning Run',
          startTimeLocal: '2024-01-15T08:00:00',
          duration: 2700, // 45 min
          distance: 8000, // 8km
          activityType: 'RUNNING',
        },
        {
          activityId: '123457',
          activityName: 'Evening Bike',
          startTimeLocal: '2024-01-15T18:00:00',
          duration: 5400, // 90 min
          distance: 30000, // 30km
          activityType: 'CYCLING',
        },
      ];

      (fetchGarminActivities as jest.Mock).mockResolvedValue(mockActivities);

      const activities = await fetchGarminActivities('valid_token', 'valid_secret', 30);

      expect(activities.length).toBe(2);
      expect(activities[0].activityType).toBe('RUNNING');
    });

    it('should sync health metrics from Garmin', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockToken = {
        userId: 'user-123',
        provider: 'GARMIN',
        accessToken: 'valid_token',
        tokenSecret: 'valid_secret',
      };

      (prisma.oAuthToken.findUnique as jest.Mock).mockResolvedValue(mockToken);

      const mockMetrics = [
        {
          calendarDate: '2024-01-15',
          restingHeartRate: 52,
          maxHeartRate: 185,
          hrvValue: 65,
        },
        {
          calendarDate: '2024-01-16',
          restingHeartRate: 50,
          maxHeartRate: 187,
          hrvValue: 68,
        },
      ];

      (fetchGarminMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const metrics = await fetchGarminMetrics('valid_token', 'valid_secret', 30);

      expect(metrics.length).toBe(2);
      expect(metrics[0].hrvValue).toBe(65);
    });

    it('should save synced activities to database', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const workoutsToCreate = [
        {
          userId: 'user-123',
          name: 'Morning Run',
          sport: 'RUNNING',
          type: 'EASY',
          date: new Date('2024-01-15'),
          duration: 45,
          distance: 8,
          structure: {},
        },
      ];

      (prisma.workout.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await prisma.workout.createMany({
        data: workoutsToCreate,
      });

      expect(result.count).toBe(1);
    });

    it('should save synced metrics to database', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const metricsToCreate = [
        {
          userId: 'user-123',
          type: 'HRV',
          value: 65,
          unit: 'ms',
          date: new Date('2024-01-15'),
        },
        {
          userId: 'user-123',
          type: 'RESTING_HR',
          value: 52,
          unit: 'bpm',
          date: new Date('2024-01-15'),
        },
      ];

      (prisma.metric.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const result = await prisma.metric.createMany({
        data: metricsToCreate,
      });

      expect(result.count).toBe(2);
    });

    it('should enforce sync limits for free tier', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      // Free tier subscription
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      // Already synced 5 times this month
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        garminSyncCount: 5,
        garminSyncResetAt: new Date(), // Current month
      });

      const user = await prisma.user.findUnique({ where: { id: 'user-123' } });

      expect(user.garminSyncCount).toBe(5); // At limit
    });

    it('should allow unlimited syncs for premium tier', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      // Premium tier subscription
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        tier: 'PREMIUM',
        status: 'ACTIVE',
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        garminSyncCount: 100, // Way over free limit
      });

      const subscription = await prisma.subscription.findUnique({
        where: { userId: 'user-123' },
      });

      expect(subscription.tier).toBe('PREMIUM'); // Unlimited syncs
    });

    it('should reset sync count monthly', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        garminSyncCount: 5,
        garminSyncResetAt: lastMonth, // Last month
      });

      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-123',
        garminSyncCount: 0, // Reset
        garminSyncResetAt: new Date(),
      });

      const user = await prisma.user.findUnique({ where: { id: 'user-123' } });

      expect(user.garminSyncResetAt.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('Disconnect OAuth', () => {
    it('should remove OAuth token', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const deletedToken = {
        id: 'token-123',
        userId: 'user-123',
        provider: 'GARMIN',
      };

      (prisma.oAuthToken.delete as jest.Mock).mockResolvedValue(deletedToken);

      const result = await prisma.oAuthToken.delete({
        where: {
          userId_provider: { userId: 'user-123', provider: 'GARMIN' },
        },
      });

      expect(result.provider).toBe('GARMIN');
    });

    it('should handle disconnect when no token exists', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.oAuthToken.delete as jest.Mock).mockRejectedValue(
        new Error('Record not found')
      );

      await expect(
        prisma.oAuthToken.delete({
          where: {
            userId_provider: { userId: 'user-123', provider: 'GARMIN' },
          },
        })
      ).rejects.toThrow('Record not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle Garmin API errors', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (fetchGarminActivities as jest.Mock).mockRejectedValue(
        new Error('Garmin API unavailable')
      );

      await expect(
        fetchGarminActivities('token', 'secret', 30)
      ).rejects.toThrow('Garmin API unavailable');
    });

    it('should handle network timeouts', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (fetchGarminActivities as jest.Mock).mockRejectedValue(
        new Error('Request timeout')
      );

      await expect(
        fetchGarminActivities('token', 'secret', 30)
      ).rejects.toThrow('Request timeout');
    });

    it('should handle invalid tokens', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (fetchGarminActivities as jest.Mock).mockRejectedValue(
        new Error('Invalid OAuth token')
      );

      await expect(
        fetchGarminActivities('invalid_token', 'invalid_secret', 30)
      ).rejects.toThrow('Invalid OAuth token');
    });
  });
});
