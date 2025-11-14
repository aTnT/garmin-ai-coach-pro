import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateWorkout } from '@/lib/calculations/workouts';
import { Sport, WorkoutType } from '@prisma/client';

const generateWorkoutSchema = z.object({
  sport: z.enum(['RUNNING', 'CYCLING', 'SWIMMING', 'TRIATHLON', 'OTHER']),
  type: z.enum(['EASY', 'TEMPO', 'INTERVAL', 'LONG', 'RECOVERY', 'RACE', 'STRENGTH']),
  duration: z.number().min(10).max(600),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sport, type, duration } = generateWorkoutSchema.parse(body);

    // Generate workout structure
    const workoutStructure = generateWorkout({
      sport: sport as Sport,
      type: type as WorkoutType,
      duration,
    });

    // Save to database
    const workout = await prisma.workout.create({
      data: {
        userId: session.user.id,
        date: new Date(),
        sport: sport as Sport,
        type: type as WorkoutType,
        name: workoutStructure.name,
        duration: workoutStructure.totalDuration,
        distance: workoutStructure.estimatedDistance,
        structure: workoutStructure as any,
        completed: false,
      },
    });

    return NextResponse.json({
      workout,
      structure: workoutStructure,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error generating workout:', error);
    return NextResponse.json(
      { error: 'Failed to generate workout' },
      { status: 500 }
    );
  }
}
