import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { subDays } from 'date-fns';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = subDays(new Date(), days);

    const metrics = await prisma.metric.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Group metrics by type for charts
    const hrvData = metrics
      .filter((m) => m.type === 'HRV')
      .map((m) => ({
        date: m.date.toISOString(),
        value: m.value,
      }));

    const trainingLoadData = metrics
      .filter((m) => m.type === 'TRAINING_LOAD')
      .map((m) => ({
        date: m.date.toISOString(),
        value: m.value,
      }));

    const readinessData = metrics
      .filter((m) => m.type === 'READINESS_SCORE')
      .map((m) => ({
        date: m.date.toISOString(),
        score: m.value,
      }));

    // Calculate HRV average
    const hrvAverage =
      hrvData.length > 0
        ? hrvData.reduce((sum, d) => sum + d.value, 0) / hrvData.length
        : undefined;

    return NextResponse.json({
      hrv: {
        data: hrvData,
        average: hrvAverage,
      },
      trainingLoad: {
        data: trainingLoadData,
      },
      readiness: {
        data: readinessData,
      },
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}
