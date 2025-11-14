import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const updateWorkoutSchema = z.object({
  completed: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workout = await prisma.workout.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    return NextResponse.json({ workout });
  } catch (error) {
    console.error('Error fetching workout:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workout' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const updates = updateWorkoutSchema.parse(body);

    const data: any = {
      ...updates,
    };

    // If marking as completed, set completedAt timestamp
    if (updates.completed === true) {
      data.completedAt = new Date();
    } else if (updates.completed === false) {
      data.completedAt = null;
    }

    const workout = await prisma.workout.updateMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data,
    });

    if (workout.count === 0) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating workout:', error);
    return NextResponse.json(
      { error: 'Failed to update workout' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workout = await prisma.workout.deleteMany({
      where: {
        id: params.id,
        userId: session.user.id,
        planId: null, // Only allow deleting standalone workouts, not plan workouts
      },
    });

    if (workout.count === 0) {
      return NextResponse.json(
        { error: 'Workout not found or cannot be deleted (part of a plan)' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workout:', error);
    return NextResponse.json(
      { error: 'Failed to delete workout' },
      { status: 500 }
    );
  }
}
