import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete OAuth token
    const deleted = await prisma.oAuthToken.deleteMany({
      where: {
        userId: session.user.id,
        provider: 'GARMIN',
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Garmin account not connected' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Garmin account disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Garmin:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Garmin account' },
      { status: 500 }
    );
  }
}
