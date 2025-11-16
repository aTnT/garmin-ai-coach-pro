/**
 * Tests for Metrics API
 * Tests /api/metrics endpoints
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
    healthMetric: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
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
import { GET, POST } from '../metrics/route';
import { NextRequest } from 'next/server';

describe('Metrics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/metrics', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return user metrics', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      const mockMetrics = [
        {
          id: 'metric-1',
          userId: 'user-123',
          type: 'HRV',
          value: 60,
          unit: 'ms',
          date: new Date('2024-01-15'),
          createdAt: new Date(),
        },
        {
          id: 'metric-2',
          userId: 'user-123',
          type: 'RESTING_HR',
          value: 52,
          unit: 'bpm',
          date: new Date('2024-01-15'),
          createdAt: new Date(),
        },
      ];

      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toHaveLength(2);
      expect(data.metrics[0].type).toBe('HRV');
    });

    it('should filter metrics by date range', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics?startDate=2024-01-01&endDate=2024-01-31', {
        query: { startDate: '2024-01-01', endDate: '2024-01-31' },
      } as any);

      const response = await GET(request);

      expect(prisma.healthMetric.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          date: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
        orderBy: { date: 'desc' },
      });
    });

    it('should filter metrics by type', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.healthMetric.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics?type=HRV', {
        query: { type: 'HRV' },
      } as any);

      const response = await GET(request);

      expect(prisma.healthMetric.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          type: 'HRV',
        }),
        orderBy: { date: 'desc' },
      });
    });

    it('should handle database errors gracefully', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.healthMetric.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeTruthy();
    });
  });

  describe('POST /api/metrics', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        body: JSON.stringify({ type: 'HRV', value: 60 }),
      } as any);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should create a new metric', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const newMetric = {
        id: 'metric-new',
        userId: 'user-123',
        type: 'HRV',
        value: 65,
        unit: 'ms',
        date: new Date(),
        createdAt: new Date(),
      };

      (prisma.healthMetric.create as jest.Mock).mockResolvedValue(newMetric);

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        body: { type: 'HRV', value: 65, unit: 'ms', date: new Date().toISOString() },
      } as any);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.metric.type).toBe('HRV');
      expect(data.metric.value).toBe(65);
    });

    it('should validate required fields', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        body: { value: 60 }, // Missing 'type'
      } as any);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
    });

    it('should handle bulk metric creation', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const metrics = [
        { id: '1', type: 'HRV', value: 60, date: new Date() },
        { id: '2', type: 'RESTING_HR', value: 52, date: new Date() },
      ];

      (prisma.healthMetric.create as jest.Mock)
        .mockResolvedValueOnce(metrics[0])
        .mockResolvedValueOnce(metrics[1]);

      const request = new NextRequest('http://localhost:3000/api/metrics', {
        method: 'POST',
        body: {
          metrics: [
            { type: 'HRV', value: 60 },
            { type: 'RESTING_HR', value: 52 },
          ],
        },
      } as any);

      const response = await POST(request);

      // Should handle bulk creation
      expect(response.status).toBeLessThan(500);
    });
  });
});
