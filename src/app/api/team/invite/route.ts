import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createInvite } from '@/lib/team';

/**
 * Send team invitation to athlete
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { athleteEmail, message } = body;

    if (!athleteEmail) {
      return NextResponse.json(
        { error: 'Athlete email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(athleteEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    try {
      const invite = await createInvite({
        coachId: session.user.id,
        athleteEmail,
        message,
      });

      return NextResponse.json({
        success: true,
        invite: {
          id: invite.id,
          athleteEmail: invite.athleteEmail,
          message: invite.message,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        },
        message: 'Invitation sent successfully',
      });
    } catch (error: any) {
      return NextResponse.json(
        {
          error: error.message || 'Failed to create invite',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error sending invite:', error);
    return NextResponse.json(
      {
        error: 'Failed to send invite',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
