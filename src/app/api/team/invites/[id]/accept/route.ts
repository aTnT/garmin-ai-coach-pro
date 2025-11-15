import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { acceptInvite } from '@/lib/team';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Verify invite is for this user
    const invite = await prisma.teamInvite.findUnique({
      where: { id },
      include: {
        coach: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.athleteEmail !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invite is not for you' },
        { status: 403 }
      );
    }

    try {
      const membership = await acceptInvite(id, session.user.id);

      return NextResponse.json({
        success: true,
        message: `You've joined ${invite.coach.name}'s team`,
        membership: {
          id: membership.id,
          coachId: membership.coachId,
          joinedAt: membership.joinedAt,
        },
      });
    } catch (error: any) {
      return NextResponse.json(
        {
          error: error.message || 'Failed to accept invite',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error accepting invite:', error);
    return NextResponse.json(
      {
        error: 'Failed to accept invite',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
