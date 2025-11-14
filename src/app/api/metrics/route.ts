import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await prisma.metric.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Group metrics by type and get latest values
    const latestMetrics = metrics.reduce((acc, metric) => {
      if (!acc[metric.type]) {
        acc[metric.type] = metric;
      }
      return acc;
    }, {} as Record<string, typeof metrics[0]>);

    return NextResponse.json({
      all: metrics,
      latest: latestMetrics,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
