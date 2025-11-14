import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MetricType } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { metrics } = body;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json(
        { error: 'Invalid metrics data' },
        { status: 400 }
      );
    }

    // Validate and create metrics
    const createdMetrics = await prisma.metric.createMany({
      data: metrics.map((m: any) => ({
        userId: session.user.id,
        date: new Date(m.date),
        type: m.type as MetricType,
        value: parseFloat(m.value),
        unit: m.unit || null,
        metadata: m.metadata || null,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      count: createdMetrics.count,
    });
  } catch (error) {
    console.error('Error uploading metrics:', error);
    return NextResponse.json(
      { error: 'Failed to upload metrics' },
      { status: 500 }
    );
  }
}
