import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MetricType, Sport, WorkoutType } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { metrics, workouts } = body;

    let metricsCount = 0;
    let workoutsCount = 0;

    // Process metrics if provided
    if (metrics && Array.isArray(metrics) && metrics.length > 0) {
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
      metricsCount = createdMetrics.count;
    }

    // Process workouts if provided
    if (workouts && Array.isArray(workouts) && workouts.length > 0) {
      const createdWorkouts = await prisma.workout.createMany({
        data: workouts.map((w: any) => ({
          userId: session.user.id,
          date: new Date(w.date),
          sport: w.sport as Sport,
          type: w.type as WorkoutType,
          name: w.name,
          duration: parseInt(w.duration),
          distance: w.distance ? parseFloat(w.distance) : null,
          structure: {
            name: w.name,
            description: w.description || '',
            totalDuration: parseInt(w.duration),
            segments: [],
          },
          completed: false,
          notes: w.description || null,
        })),
        skipDuplicates: true,
      });
      workoutsCount = createdWorkouts.count;
    }

    if (metricsCount === 0 && workoutsCount === 0) {
      return NextResponse.json(
        { error: 'No valid data to import' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      metricsCount,
      workoutsCount,
      message: `Successfully imported ${metricsCount} metrics and ${workoutsCount} workouts`,
    });
  } catch (error) {
    console.error('Error uploading data:', error);
    return NextResponse.json(
      { error: 'Failed to upload data' },
      { status: 500 }
    );
  }
}
