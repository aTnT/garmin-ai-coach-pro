import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { acceptInvite, declineInvite } from '@/lib/team';

/**
 * Get pending invites for current user
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get invites for this user's email
    const invites = await prisma.teamInvite.findMany({
      where: {
        athleteEmail: session.user.email.toLowerCase(),
        status: 'PENDING',
        expiresAt: {
          gte: new Date(), // Only non-expired invites
        },
      },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      invites: invites.map((invite) => ({
        id: invite.id,
        coach: invite.coach,
        message: invite.message,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching invites:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch invites',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
