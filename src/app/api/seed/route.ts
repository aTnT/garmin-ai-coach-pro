import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateSampleMetrics, generateSampleWorkouts } from '@/lib/seed-data';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has data
    const existingMetrics = await prisma.metric.count({
      where: { userId: session.user.id },
    });

    if (existingMetrics > 0) {
      return NextResponse.json(
        {
          error:
            'You already have training data. Delete existing data first if you want to load sample data.',
        },
        { status: 400 }
      );
    }

    // Generate sample data
    const metrics = generateSampleMetrics(session.user.id);
    const workouts = generateSampleWorkouts(session.user.id);

    // Insert into database
    await prisma.metric.createMany({
      data: metrics,
    });

    await prisma.workout.createMany({
      data: workouts,
    });

    return NextResponse.json({
      success: true,
      metricsCreated: metrics.length,
      workoutsCreated: workouts.length,
      message: `Successfully loaded ${metrics.length} metrics and ${workouts.length} workouts!`,
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json(
      { error: 'Failed to load sample data' },
      { status: 500 }
    );
  }
}

// Allow deleting all user data (for testing)
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete all user data
    await prisma.metric.deleteMany({
      where: { userId: session.user.id },
    });

    await prisma.workout.deleteMany({
      where: { userId: session.user.id, planId: null }, // Only delete standalone workouts
    });

    return NextResponse.json({
      success: true,
      message: 'All training data deleted',
    });
  } catch (error) {
    console.error('Error deleting data:', error);
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}
