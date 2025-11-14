import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateReadinessScore } from '@/lib/calculations/readiness';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's metrics from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const metrics = await prisma.metric.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    const readiness = calculateReadinessScore(metrics);

    return NextResponse.json(readiness);
  } catch (error) {
    console.error('Error calculating readiness:', error);
    return NextResponse.json(
      { error: 'Failed to calculate readiness score' },
      { status: 500 }
    );
  }
}
