import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessAthleteData, removeAthlete, getPermissions } from '@/lib/team';
import { subDays } from 'date-fns';
import { logTeamOperation, logDataAccess } from '@/lib/audit-log';

/**
 * Get athlete overview data
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const athleteId = params.id;

    // Check if coach has access to this athlete
    const hasAccess = await canAccessAthleteData(session.user.id, athleteId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this athlete' },
        { status: 403 }
      );
    }

    // Get athlete profile
    const athlete = await prisma.user.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        name: true,
        email: true,
        age: true,
        gender: true,
        weight: true,
        createdAt: true,
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Get permissions
    const permissions = await getPermissions(session.user.id, athleteId);

    // Get stats
    const [workouts, metrics, activePlans, latestReadiness] = await Promise.all([
      prisma.workout.findMany({
        where: {
          userId: athleteId,
          date: {
            gte: subDays(new Date(), 30),
          },
        },
        orderBy: { date: 'desc' },
        take: 10,
        select: {
          id: true,
          date: true,
          sport: true,
          type: true,
          name: true,
          duration: true,
          distance: true,
          completed: true,
        },
      }),
      prisma.metric.findMany({
        where: {
          userId: athleteId,
          date: {
            gte: subDays(new Date(), 30),
          },
        },
        orderBy: { date: 'desc' },
        take: 50,
      }),
      prisma.trainingPlan.findMany({
        where: {
          userId: athleteId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          sport: true,
          goal: true,
        },
      }),
      prisma.metric.findFirst({
        where: {
          userId: athleteId,
          type: 'READINESS_SCORE',
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    // Audit log: Track athlete data access (GDPR compliance)
    await logTeamOperation({
      action: 'TEAM_ATHLETE_VIEW',
      userId: session.user.id,
      targetUserId: athleteId,
      req,
    });

    // Also log specific data access
    await logDataAccess({
      userId: athleteId,
      accessorId: session.user.id,
      dataType: 'athlete_profile',
      dataId: athleteId,
      req,
    });

    return NextResponse.json({
      athlete,
      permissions,
      stats: {
        workouts: permissions.canViewWorkouts ? workouts : [],
        metrics: permissions.canViewMetrics ? metrics : [],
        activePlans: permissions.canViewPlans ? activePlans : [],
        latestReadiness: latestReadiness?.value || null,
        totalWorkouts: workouts.filter((w) => w.completed).length,
        recentWorkoutCount: workouts.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching athlete data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch athlete data',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Remove athlete from team
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const athleteId = params.id;

    // Check if athlete is in team
    const hasAccess = await canAccessAthleteData(session.user.id, athleteId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Athlete not found in your team' },
        { status: 404 }
      );
    }

    await removeAthlete(session.user.id, athleteId);

    // Audit log: Track athlete removal
    await logTeamOperation({
      action: 'TEAM_ATHLETE_REMOVE',
      userId: session.user.id,
      targetUserId: athleteId,
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Athlete removed from team',
    });
  } catch (error: any) {
    console.error('Error removing athlete:', error);
    return NextResponse.json(
      {
        error: 'Failed to remove athlete',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
