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
    metric: {
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
import { GET } from '../metrics/route';
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

      (prisma.metric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.all).toHaveLength(2);
      expect(data.latest.HRV).toBeDefined();
    });

    it('should filter metrics by days parameter', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.metric.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics?days=7');

      const response = await GET(request);

      expect(prisma.metric.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          date: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
        orderBy: { date: 'desc' },
      });
    });

    it('should return latest metrics grouped by type', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockMetrics = [
        {
          id: 'metric-1',
          userId: 'user-123',
          type: 'HRV',
          value: 60,
          unit: 'ms',
          date: new Date('2024-01-15'),
        },
        {
          id: 'metric-2',
          userId: 'user-123',
          type: 'HRV',
          value: 65,
          unit: 'ms',
          date: new Date('2024-01-14'),
        },
      ];

      (prisma.metric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.latest.HRV.value).toBe(60); // Latest by order
    });

    it('should handle database errors gracefully', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.metric.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeTruthy();
    });
  });
});
