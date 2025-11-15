/**
 * Team Management Utilities
 *
 * Helper functions for coach-athlete team management
 */

import { prisma } from './prisma';
import { UserRole, InviteStatus } from '@prisma/client';

/**
 * Check if user is a coach
 */
export async function isCoach(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role === 'COACH';
}

/**
 * Check if user can manage teams (TEAM subscription tier)
 */
export async function canManageTeam(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { tier: true, status: true },
  });

  return (
    subscription?.tier === 'TEAM' &&
    (subscription?.status === 'ACTIVE' || subscription?.status === 'TRIALING')
  );
}

/**
 * Get maximum number of athletes for user's subscription
 */
export function getMaxAthletes(subscriptionTier: string): number {
  if (subscriptionTier === 'TEAM') {
    return 10;
  }
  return 0; // FREE and PREMIUM cannot manage teams
}

/**
 * Check if coach has reached athlete limit
 */
export async function hasReachedAthleteLimit(coachId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: coachId },
    select: { tier: true },
  });

  const maxAthletes = getMaxAthletes(subscription?.tier || 'FREE');

  if (maxAthletes === 0) {
    return true; // No team management allowed
  }

  const currentAthletes = await prisma.teamMembership.count({
    where: { coachId },
  });

  return currentAthletes >= maxAthletes;
}

/**
 * Check if athlete is already part of coach's team
 */
export async function isAthleteInTeam(
  coachId: string,
  athleteId: string
): Promise<boolean> {
  const membership = await prisma.teamMembership.findUnique({
    where: {
      coachId_athleteId: {
        coachId,
        athleteId,
      },
    },
  });

  return !!membership;
}

/**
 * Check if user has access to athlete's data
 */
export async function canAccessAthleteData(
  coachId: string,
  athleteId: string
): Promise<boolean> {
  const membership = await prisma.teamMembership.findUnique({
    where: {
      coachId_athleteId: {
        coachId,
        athleteId,
      },
    },
  });

  return !!membership;
}

/**
 * Check specific permissions for coach-athlete relationship
 */
export async function getPermissions(coachId: string, athleteId: string) {
  const membership = await prisma.teamMembership.findUnique({
    where: {
      coachId_athleteId: {
        coachId,
        athleteId,
      },
    },
    select: {
      canViewMetrics: true,
      canViewWorkouts: true,
      canViewPlans: true,
      canEditPlans: true,
    },
  });

  return membership || {
    canViewMetrics: false,
    canViewWorkouts: false,
    canViewPlans: false,
    canEditPlans: false,
  };
}

/**
 * Create team invitation
 */
export async function createInvite(params: {
  coachId: string;
  athleteEmail: string;
  message?: string;
}) {
  // Check if coach can manage teams
  const canManage = await canManageTeam(params.coachId);
  if (!canManage) {
    throw new Error('TEAM subscription required for team management');
  }

  // Check athlete limit
  const limitReached = await hasReachedAthleteLimit(params.coachId);
  if (limitReached) {
    throw new Error('Maximum athlete limit reached (10 athletes)');
  }

  // Check if invite already exists
  const existingInvite = await prisma.teamInvite.findFirst({
    where: {
      coachId: params.coachId,
      athleteEmail: params.athleteEmail.toLowerCase(),
      status: 'PENDING',
    },
  });

  if (existingInvite) {
    throw new Error('An invite is already pending for this athlete');
  }

  // Check if athlete is already in team
  const athlete = await prisma.user.findUnique({
    where: { email: params.athleteEmail.toLowerCase() },
  });

  if (athlete) {
    const alreadyInTeam = await isAthleteInTeam(params.coachId, athlete.id);
    if (alreadyInTeam) {
      throw new Error('This athlete is already in your team');
    }
  }

  // Create invite (expires in 7 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.teamInvite.create({
    data: {
      coachId: params.coachId,
      athleteEmail: params.athleteEmail.toLowerCase(),
      message: params.message,
      expiresAt,
    },
    include: {
      coach: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return invite;
}

/**
 * Accept team invitation
 */
export async function acceptInvite(inviteId: string, athleteId: string) {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    include: {
      coach: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invite) {
    throw new Error('Invite not found');
  }

  if (invite.status !== 'PENDING') {
    throw new Error('Invite has already been responded to');
  }

  if (new Date() > invite.expiresAt) {
    // Update invite status to expired
    await prisma.teamInvite.update({
      where: { id: inviteId },
      data: {
        status: 'EXPIRED',
        respondedAt: new Date(),
      },
    });
    throw new Error('Invite has expired');
  }

  // Check if coach still has capacity
  const limitReached = await hasReachedAthleteLimit(invite.coachId);
  if (limitReached) {
    throw new Error('Coach has reached maximum athlete limit');
  }

  // Create team membership
  const membership = await prisma.teamMembership.create({
    data: {
      coachId: invite.coachId,
      athleteId,
    },
  });

  // Update invite status
  await prisma.teamInvite.update({
    where: { id: inviteId },
    data: {
      status: 'ACCEPTED',
      respondedAt: new Date(),
    },
  });

  return membership;
}

/**
 * Decline team invitation
 */
export async function declineInvite(inviteId: string) {
  await prisma.teamInvite.update({
    where: { id: inviteId },
    data: {
      status: 'DECLINED',
      respondedAt: new Date(),
    },
  });
}

/**
 * Remove athlete from team
 */
export async function removeAthlete(coachId: string, athleteId: string) {
  await prisma.teamMembership.delete({
    where: {
      coachId_athleteId: {
        coachId,
        athleteId,
      },
    },
  });
}

/**
 * Get coach's athletes with stats
 */
export async function getCoachAthletes(coachId: string) {
  const memberships = await prisma.teamMembership.findMany({
    where: { coachId },
    include: {
      athlete: {
        select: {
          id: true,
          name: true,
          email: true,
          age: true,
          gender: true,
          weight: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  // Get stats for each athlete
  const athletesWithStats = await Promise.all(
    memberships.map(async (membership) => {
      const [workoutCount, activePlansCount, latestMetric] = await Promise.all([
        prisma.workout.count({
          where: {
            userId: membership.athleteId,
            completed: true,
          },
        }),
        prisma.trainingPlan.count({
          where: {
            userId: membership.athleteId,
            status: 'ACTIVE',
          },
        }),
        prisma.metric.findFirst({
          where: {
            userId: membership.athleteId,
            type: 'READINESS_SCORE',
          },
          orderBy: { date: 'desc' },
          select: {
            value: true,
            date: true,
          },
        }),
      ]);

      return {
        membership: {
          id: membership.id,
          joinedAt: membership.joinedAt,
          permissions: {
            canViewMetrics: membership.canViewMetrics,
            canViewWorkouts: membership.canViewWorkouts,
            canViewPlans: membership.canViewPlans,
            canEditPlans: membership.canEditPlans,
          },
        },
        athlete: membership.athlete,
        stats: {
          totalWorkouts: workoutCount,
          activePlans: activePlansCount,
          latestReadiness: latestMetric?.value || null,
          latestReadinessDate: latestMetric?.date || null,
        },
      };
    })
  );

  return athletesWithStats;
}
