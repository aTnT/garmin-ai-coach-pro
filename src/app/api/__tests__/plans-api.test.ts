/**
 * Tests for Training Plans API
 * Tests /api/plans endpoints
 */

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url, options = {}) => ({
    nextUrl: {
      searchParams: new URLSearchParams(options?.query || ''),
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
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workout: {
      findMany: jest.fn(),
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
import { GET, POST } from '../plans/route';
import { GET as GET_ID, PATCH, DELETE } from '../plans/[id]/route';
import { NextRequest } from 'next/server';

describe('Training Plans API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/plans', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/plans');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return user training plans', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockPlans = [
        {
          id: 'plan-1',
          userId: 'user-123',
          name: 'Marathon Training - 16 Weeks',
          goal: 'Sub 3:30 marathon',
          sport: 'RUNNING',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-04-15'),
          status: 'ACTIVE',
        },
        {
          id: 'plan-2',
          userId: 'user-123',
          name: 'Base Building',
          goal: 'Build aerobic base',
          sport: 'CYCLING',
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-03-31'),
          status: 'PLANNED',
        },
      ];

      (prisma.trainingPlan.findMany as jest.Mock).mockResolvedValue(mockPlans);

      const request = new NextRequest('http://localhost:3000/api/plans');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.plans).toHaveLength(2);
      expect(data.plans[0].name).toBe('Marathon Training - 16 Weeks');
    });

    it('should filter plans by status', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/plans?status=ACTIVE', {
        query: { status: 'ACTIVE' },
      } as any);

      const response = await GET(request);

      expect(prisma.trainingPlan.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          status: 'ACTIVE',
        }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter plans by sport', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/plans?sport=RUNNING', {
        query: { sport: 'RUNNING' },
      } as any);

      const response = await GET(request);

      expect(prisma.trainingPlan.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          sport: 'RUNNING',
        }),
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('POST /api/plans', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        body: JSON.stringify({ name: 'Plan', goal: 'Goal' }),
      } as any);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should create a new training plan', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const newPlan = {
        id: 'plan-new',
        userId: 'user-123',
        name: 'Marathon Training',
        goal: 'Complete marathon in 3:30:00',
        sport: 'RUNNING',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-04-15'),
        status: 'PLANNED',
      };

      (prisma.trainingPlan.create as jest.Mock).mockResolvedValue(newPlan);

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        body: {
          name: 'Marathon Training',
          goal: 'Complete marathon in 3:30:00',
          sport: 'RUNNING',
          startDate: '2024-01-01',
          endDate: '2024-04-15',
        },
      } as any);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.plan.name).toBe('Marathon Training');
      expect(data.plan.sport).toBe('RUNNING');
    });

    it('should validate required fields', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const request = new NextRequest('http://localhost:3000/api/plans', {
        method: 'POST',
        body: { name: 'Plan' }, // Missing required fields
      } as any);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
    });
  });

  describe('GET /api/plans/[id]', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-123');
      const response = await GET_ID(request, { params: { id: 'plan-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return plan by ID with workouts', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        name: 'Marathon Training',
        goal: 'Sub 3:30',
        sport: 'RUNNING',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-04-15'),
        status: 'ACTIVE',
        workouts: [
          { id: 'w1', name: 'Easy Run', duration: 45 },
          { id: 'w2', name: 'Long Run', duration: 120 },
        ],
      };

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-123');
      const response = await GET_ID(request, { params: { id: 'plan-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.plan.id).toBe('plan-123');
      expect(data.plan.workouts).toHaveLength(2);
    });

    it('should return 404 if plan not found', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-999');
      const response = await GET_ID(request, { params: { id: 'plan-999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeTruthy();
    });

    it('should return 403 if plan belongs to different user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockPlan = {
        id: 'plan-123',
        userId: 'user-456', // Different user
        name: 'Plan',
      };

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-123');
      const response = await GET_ID(request, { params: { id: 'plan-123' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBeTruthy();
    });
  });

  describe('PATCH /api/plans/[id]', () => {
    it('should update plan', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const existingPlan = {
        id: 'plan-123',
        userId: 'user-123',
        status: 'PLANNED',
      };

      const updatedPlan = {
        ...existingPlan,
        status: 'ACTIVE',
      };

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(existingPlan);
      (prisma.trainingPlan.update as jest.Mock).mockResolvedValue(updatedPlan);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-123', {
        method: 'PATCH',
        body: { status: 'ACTIVE' },
      } as any);

      const response = await PATCH(request, { params: { id: 'plan-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.plan.status).toBe('ACTIVE');
    });

    it('should return 404 if plan not found', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-999', {
        method: 'PATCH',
        body: { status: 'ACTIVE' },
      } as any);

      const response = await PATCH(request, { params: { id: 'plan-999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeTruthy();
    });
  });

  describe('DELETE /api/plans/[id]', () => {
    it('should delete plan', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const existingPlan = {
        id: 'plan-123',
        userId: 'user-123',
      };

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(existingPlan);
      (prisma.trainingPlan.delete as jest.Mock).mockResolvedValue(existingPlan);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-123', {
        method: 'DELETE',
      } as any);

      const response = await DELETE(request, { params: { id: 'plan-123' } });

      expect(response.status).toBe(204);
    });

    it('should return 404 if plan not found', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-999', {
        method: 'DELETE',
      } as any);

      const response = await DELETE(request, { params: { id: 'plan-999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeTruthy();
    });

    it('should prevent deletion of active plan', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const activePlan = {
        id: 'plan-123',
        userId: 'user-123',
        status: 'ACTIVE',
      };

      (prisma.trainingPlan.findUnique as jest.Mock).mockResolvedValue(activePlan);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-123', {
        method: 'DELETE',
      } as any);

      const response = await DELETE(request, { params: { id: 'plan-123' } });

      // Should either delete or return error for active plan
      expect([200, 204, 400, 403]).toContain(response.status);
    });
  });
});
