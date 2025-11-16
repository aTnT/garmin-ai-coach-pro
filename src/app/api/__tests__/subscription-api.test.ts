/**
 * Integration Tests for Subscription API
 * Tests subscription tier checks and feature gating
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
  },
}));

// Mock authentication
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock subscription limits
jest.mock('@/lib/subscription-limits', () => ({
  getFeatureAvailability: jest.fn().mockReturnValue({
    canSync: true,
    canUseAI: true,
    maxPlans: 10,
  }),
  formatUsageMessage: jest.fn().mockReturnValue(''),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from '../subscription/route';

describe('Subscription API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/subscription', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = {} as any;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return free tier for user without subscription', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock create for auto-creation
      (prisma.subscription.create as jest.Mock).mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: 'FREE',
        status: 'ACTIVE',
        createdAt: new Date(),
      });

      const request = {} as any;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscription.tier).toBe('FREE');
    });

    it('should return premium subscription', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockSubscription = {
        id: 'sub-123',
        userId: 'user-123',
        tier: 'PREMIUM',
        status: 'ACTIVE',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const request = {} as any;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscription.tier).toBe('PREMIUM');
      expect(data.subscription.status).toBe('ACTIVE');
    });

    it('should return team subscription with limits', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockSubscription = {
        id: 'sub-123',
        userId: 'user-123',
        tier: 'TEAM',
        status: 'ACTIVE',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const request = {} as any;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscription.tier).toBe('TEAM');
      expect(data.limits).toBeDefined();
    });

    it('should handle canceled subscription', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockSubscription = {
        id: 'sub-123',
        userId: 'user-123',
        tier: 'PREMIUM',
        status: 'CANCELED',
        stripeCustomerId: 'cus_123',
        cancelAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const request = {} as any;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscription.status).toBe('CANCELED');
    });

    it('should handle database errors', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.subscription.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = {} as any;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeTruthy();
    });
  });
});
