import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCoachAthletes, canManageTeam } from '@/lib/team';

/**
 * Get coach's athletes list with stats
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can manage teams
    const canManage = await canManageTeam(session.user.id);

    if (!canManage) {
      return NextResponse.json(
        {
          error: 'TEAM subscription required',
          message: 'Upgrade to TEAM plan to manage athletes',
        },
        { status: 403 }
      );
    }

    const athletes = await getCoachAthletes(session.user.id);

    return NextResponse.json({
      athletes,
      count: athletes.length,
      maxAthletes: 10,
    });
  } catch (error: any) {
    console.error('Error fetching athletes:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch athletes',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
