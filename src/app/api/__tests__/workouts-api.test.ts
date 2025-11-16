/**
 * Tests for Workouts API
 * Tests /api/workouts endpoints
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
    workout: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
import { GET, POST } from '../workouts/route';
import { GET as GET_ID, PATCH, DELETE } from '../workouts/[id]/route';
import { NextRequest } from 'next/server';

describe('Workouts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/workouts', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/workouts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return user workouts', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockWorkouts = [
        {
          id: 'workout-1',
          userId: 'user-123',
          name: 'Morning Run',
          sport: 'RUNNING',
          duration: 45,
          distance: 8,
          date: new Date('2024-01-15'),
          completed: true,
        },
        {
          id: 'workout-2',
          userId: 'user-123',
          name: 'Evening Bike',
          sport: 'CYCLING',
          duration: 90,
          distance: 30,
          date: new Date('2024-01-16'),
          completed: false,
        },
      ];

      (prisma.workout.findMany as jest.Mock).mockResolvedValue(mockWorkouts);

      const request = new NextRequest('http://localhost:3000/api/workouts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.workouts).toHaveLength(2);
      expect(data.workouts[0].sport).toBe('RUNNING');
    });

    it('should filter workouts by completed status', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.workout.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/workouts?completed=true', {
        query: { completed: 'true' },
      } as any);

      const response = await GET(request);

      expect(prisma.workout.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          completed: true,
        }),
        orderBy: { date: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter workouts by sport', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.workout.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/workouts?sport=CYCLING', {
        query: { sport: 'CYCLING' },
      } as any);

      const response = await GET(request);

      expect(prisma.workout.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          sport: 'CYCLING',
        }),
        orderBy: { date: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter workouts by date range', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.workout.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/workouts?startDate=2024-01-01&endDate=2024-01-31', {
        query: { startDate: '2024-01-01', endDate: '2024-01-31' },
      } as any);

      const response = await GET(request);

      expect(prisma.workout.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          date: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
        orderBy: { date: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('POST /api/workouts', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify({ name: 'Run', sport: 'RUNNING' }),
      } as any);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should create a new workout', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const newWorkout = {
        id: 'workout-new',
        userId: 'user-123',
        name: 'Morning Run',
        sport: 'RUNNING',
        duration: 45,
        date: new Date(),
        completed: false,
      };

      (prisma.workout.create as jest.Mock).mockResolvedValue(newWorkout);

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: {
          name: 'Morning Run',
          sport: 'RUNNING',
          duration: 45,
          date: new Date().toISOString(),
        },
      } as any);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.workout.name).toBe('Morning Run');
      expect(data.workout.sport).toBe('RUNNING');
    });

    it('should validate required fields', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: { name: 'Run' }, // Missing sport, duration, date
      } as any);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
    });
  });

  describe('GET /api/workouts/[id]', () => {
    it('should return 401 without authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/workouts/workout-123');
      const response = await GET_ID(request, { params: { id: 'workout-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return workout by ID', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockWorkout = {
        id: 'workout-123',
        userId: 'user-123',
        name: 'Morning Run',
        sport: 'RUNNING',
        duration: 45,
        date: new Date(),
      };

      (prisma.workout.findUnique as jest.Mock).mockResolvedValue(mockWorkout);

      const request = new NextRequest('http://localhost:3000/api/workouts/workout-123');
      const response = await GET_ID(request, { params: { id: 'workout-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.workout.id).toBe('workout-123');
    });

    it('should return 404 if workout not found', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.workout.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/workouts/workout-999');
      const response = await GET_ID(request, { params: { id: 'workout-999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeTruthy();
    });

    it('should return 403 if workout belongs to different user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const mockWorkout = {
        id: 'workout-123',
        userId: 'user-456', // Different user
        name: 'Run',
        sport: 'RUNNING',
      };

      (prisma.workout.findUnique as jest.Mock).mockResolvedValue(mockWorkout);

      const request = new NextRequest('http://localhost:3000/api/workouts/workout-123');
      const response = await GET_ID(request, { params: { id: 'workout-123' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBeTruthy();
    });
  });

  describe('PATCH /api/workouts/[id]', () => {
    it('should update workout', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const existingWorkout = {
        id: 'workout-123',
        userId: 'user-123',
        completed: false,
      };

      const updatedWorkout = {
        ...existingWorkout,
        completed: true,
      };

      (prisma.workout.findUnique as jest.Mock).mockResolvedValue(existingWorkout);
      (prisma.workout.update as jest.Mock).mockResolvedValue(updatedWorkout);

      const request = new NextRequest('http://localhost:3000/api/workouts/workout-123', {
        method: 'PATCH',
        body: { completed: true },
      } as any);

      const response = await PATCH(request, { params: { id: 'workout-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.workout.completed).toBe(true);
    });

    it('should return 404 if workout not found', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.workout.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/workouts/workout-999', {
        method: 'PATCH',
        body: { completed: true },
      } as any);

      const response = await PATCH(request, { params: { id: 'workout-999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeTruthy();
    });
  });

  describe('DELETE /api/workouts/[id]', () => {
    it('should delete workout', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      const existingWorkout = {
        id: 'workout-123',
        userId: 'user-123',
      };

      (prisma.workout.findUnique as jest.Mock).mockResolvedValue(existingWorkout);
      (prisma.workout.delete as jest.Mock).mockResolvedValue(existingWorkout);

      const request = new NextRequest('http://localhost:3000/api/workouts/workout-123', {
        method: 'DELETE',
      } as any);

      const response = await DELETE(request, { params: { id: 'workout-123' } });

      expect(response.status).toBe(204);
    });

    it('should return 404 if workout not found', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      (prisma.workout.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/workouts/workout-999', {
        method: 'DELETE',
      } as any);

      const response = await DELETE(request, { params: { id: 'workout-999' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeTruthy();
    });
  });
});
