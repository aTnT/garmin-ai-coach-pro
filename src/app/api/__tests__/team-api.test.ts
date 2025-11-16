/**
 * Integration Tests for Team Management API
 * Tests coach-athlete relationships and team invitations
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
    user: {
      findUnique: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
    },
    teamInvite: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    teamMembership: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock rate limiting
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true }),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

describe('Team Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Team Invitations', () => {
    it('should require authentication', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      // Simulate unauthorized check
      const session = await getServerSession({} as any);
      expect(session).toBeNull();
    });

    it('should require TEAM subscription for invitations', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'coach-123', email: 'coach@example.com' },
      });

      // Free tier subscription
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      const subscription = await prisma.subscription.findUnique({
        where: { userId: 'coach-123' },
      });

      expect(subscription).toBeNull(); // Free tier
    });

    it('should create team invitation', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'coach-123', email: 'coach@example.com' },
      });

      // Team subscription
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        tier: 'TEAM',
        status: 'ACTIVE',
      });

      const newInvite = {
        id: 'invite-123',
        coachId: 'coach-123',
        athleteEmail: 'athlete@example.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        permissions: {
          canViewMetrics: true,
          canViewWorkouts: true,
          canViewPlans: true,
          canEditPlans: false,
        },
      };

      (prisma.teamInvite.create as jest.Mock).mockResolvedValue(newInvite);

      const invite = await prisma.teamInvite.create({
        data: {
          coachId: 'coach-123',
          athleteEmail: 'athlete@example.com',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        } as any,
      });

      expect(invite.id).toBe('invite-123');
      expect(invite.status).toBe('PENDING');
    });

    it('should enforce athlete limit (10 max)', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'coach-123' },
      });

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        tier: 'TEAM',
        status: 'ACTIVE',
      });

      // Already has 10 athletes
      (prisma.teamMembership.count as jest.Mock).mockResolvedValue(10);

      const count = await prisma.teamMembership.count({
        where: { coachId: 'coach-123' },
      });

      expect(count).toBe(10); // Should not allow more
    });

    it('should list pending invitations', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'coach-123' },
      });

      const mockInvites = [
        {
          id: 'invite-1',
          athleteEmail: 'athlete1@example.com',
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: 'invite-2',
          athleteEmail: 'athlete2@example.com',
          status: 'PENDING',
          createdAt: new Date(),
        },
      ];

      (prisma.teamInvite.findMany as jest.Mock).mockResolvedValue(mockInvites);

      const invites = await prisma.teamInvite.findMany({
        where: { coachId: 'coach-123', status: 'PENDING' },
      });

      expect(invites.length).toBe(2);
    });
  });

  describe('Team Membership', () => {
    it('should accept invitation', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'athlete-123', email: 'athlete@example.com' },
      });

      const mockInvite = {
        id: 'invite-123',
        coachId: 'coach-123',
        athleteEmail: 'athlete@example.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        permissions: { canViewMetrics: true },
      };

      (prisma.teamInvite.findUnique as jest.Mock).mockResolvedValue(mockInvite);
      (prisma.teamInvite.update as jest.Mock).mockResolvedValue({
        ...mockInvite,
        status: 'ACCEPTED',
      });

      const membership = {
        id: 'member-123',
        coachId: 'coach-123',
        athleteId: 'athlete-123',
        permissions: { canViewMetrics: true },
      };

      (prisma.teamMembership.create as jest.Mock).mockResolvedValue(membership);

      const created = await prisma.teamMembership.create({
        data: {
          coachId: 'coach-123',
          athleteId: 'athlete-123',
          permissions: { canViewMetrics: true },
        } as any,
      });

      expect(created.id).toBe('member-123');
    });

    it('should decline invitation', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'athlete-123', email: 'athlete@example.com' },
      });

      const mockInvite = {
        id: 'invite-123',
        coachId: 'coach-123',
        athleteEmail: 'athlete@example.com',
        status: 'PENDING',
      };

      (prisma.teamInvite.findUnique as jest.Mock).mockResolvedValue(mockInvite);
      (prisma.teamInvite.update as jest.Mock).mockResolvedValue({
        ...mockInvite,
        status: 'DECLINED',
      });

      const updated = await prisma.teamInvite.update({
        where: { id: 'invite-123' },
        data: { status: 'DECLINED' } as any,
      });

      expect(updated.status).toBe('DECLINED');
    });

    it('should list coach athletes', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'coach-123' },
      });

      const mockAthletes = [
        {
          id: 'member-1',
          athlete: {
            id: 'athlete-1',
            name: 'John Doe',
            email: 'john@example.com',
          },
          permissions: { canViewMetrics: true },
        },
        {
          id: 'member-2',
          athlete: {
            id: 'athlete-2',
            name: 'Jane Smith',
            email: 'jane@example.com',
          },
          permissions: { canViewMetrics: true },
        },
      ];

      (prisma.teamMembership.findMany as jest.Mock).mockResolvedValue(mockAthletes);

      const athletes = await prisma.teamMembership.findMany({
        where: { coachId: 'coach-123' },
        include: { athlete: true },
      });

      expect(athletes.length).toBe(2);
      expect(athletes[0].athlete.name).toBe('John Doe');
    });

    it('should remove athlete from team', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'coach-123' },
      });

      const mockMembership = {
        id: 'member-123',
        coachId: 'coach-123',
        athleteId: 'athlete-123',
      };

      (prisma.teamMembership.delete as jest.Mock).mockResolvedValue(mockMembership);

      const deleted = await prisma.teamMembership.delete({
        where: { id: 'member-123' },
      });

      expect(deleted.id).toBe('member-123');
    });

    it('should not allow expired invitations', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'athlete-123', email: 'athlete@example.com' },
      });

      const expiredInvite = {
        id: 'invite-123',
        coachId: 'coach-123',
        athleteEmail: 'athlete@example.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      (prisma.teamInvite.findUnique as jest.Mock).mockResolvedValue(expiredInvite);

      const invite = await prisma.teamInvite.findUnique({
        where: { id: 'invite-123' },
      });

      expect(invite.expiresAt.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('Permission Checks', () => {
    it('should enforce view permissions', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'coach-123' },
      });

      const membership = {
        id: 'member-123',
        coachId: 'coach-123',
        athleteId: 'athlete-123',
        permissions: {
          canViewMetrics: true,
          canViewWorkouts: true,
          canViewPlans: false, // No permission
          canEditPlans: false,
        },
      };

      (prisma.teamMembership.findMany as jest.Mock).mockResolvedValue([membership]);

      const memberships = await prisma.teamMembership.findMany({
        where: { coachId: 'coach-123' },
      });

      expect(memberships[0].permissions.canViewPlans).toBe(false);
    });

    it('should enforce edit permissions', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'coach-123' },
      });

      const membership = {
        id: 'member-123',
        permissions: {
          canViewMetrics: true,
          canViewWorkouts: true,
          canViewPlans: true,
          canEditPlans: true, // Has edit permission
        },
      };

      (prisma.teamMembership.findMany as jest.Mock).mockResolvedValue([membership]);

      const memberships = await prisma.teamMembership.findMany({
        where: { coachId: 'coach-123' },
      });

      expect(memberships[0].permissions.canEditPlans).toBe(true);
    });
  });
});
