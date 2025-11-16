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
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    workout: {
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
import { GET } from '../plans/route';
import { GET as GET_ID, PUT, DELETE } from '../plans/[id]/route';
import { NextRequest } from 'next/server';

describe('Training Plans API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/plans', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const response = await GET();
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

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.plans).toHaveLength(2);
      expect(data.plans[0].name).toBe('Marathon Training - 16 Weeks');
    });

    it('should include workout count for each plan', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockPlans = [
        {
          id: 'plan-1',
          userId: 'user-123',
          name: 'Marathon Training',
          _count: {
            workouts: 48,
          },
        },
      ];

      (prisma.trainingPlan.findMany as jest.Mock).mockResolvedValue(mockPlans);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.plans[0]._count.workouts).toBe(48);
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

      (prisma.trainingPlan.findFirst as jest.Mock).mockResolvedValue(mockPlan);

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

      (prisma.trainingPlan.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-999');
      const response = await GET_ID(request, { params: { id: 'plan-999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeTruthy();
    });

    it('should only return plan owned by current user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      // findFirst with userId check will return null for different user
      (prisma.trainingPlan.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/plans/plan-123');
      const response = await GET_ID(request, { params: { id: 'plan-123' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeTruthy();
    });
  });

  describe('PUT /api/plans/[id]', () => {
    it('should update plan', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const request = new NextRequest('http://localhost:3000/api/plans/plan-123', {
        method: 'PUT',
        body: { status: 'ACTIVE' },
      } as any);

      const response = await PUT(request, { params: { id: 'plan-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 if plan not found', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/plans/plan-999', {
        method: 'PUT',
        body: { status: 'ACTIVE' },
      } as any);

      const response = await PUT(request, { params: { id: 'plan-999' } });
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

      (prisma.trainingPlan.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const request = new NextRequest('http://localhost:3000/api/plans/plan-123', {
        method: 'DELETE',
      } as any);

      const response = await DELETE(request, { params: { id: 'plan-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 if plan not found', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.trainingPlan.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/plans/plan-999', {
        method: 'DELETE',
      } as any);

      const response = await DELETE(request, { params: { id: 'plan-999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeTruthy();
    });
  });
});
