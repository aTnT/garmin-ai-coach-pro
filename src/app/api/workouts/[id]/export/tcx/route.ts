import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  convertWorkoutToTCX,
  exportWorkoutToTCX,
  generateTCXFilename,
} from '@/lib/export/tcx';

/**
 * GET /api/workouts/:id/export/tcx
 *
 * Export workout to TCX (Training Center XML) format
 * Compatible with Garmin Connect, Strava, TrainingPeaks
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workoutId } = params;

    // Get the workout
    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
    });

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    // Check ownership
    if (workout.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Convert to TCX format
    const tcxWorkout = convertWorkoutToTCX({
      id: workout.id,
      name: workout.name,
      sport: workout.sport,
      type: workout.type,
      date: workout.date,
      duration: workout.duration || 60,
      distance: workout.distance || undefined,
      structure: workout.structure as any,
      notes: workout.notes || undefined,
    });

    // Generate TCX XML
    const tcxContent = exportWorkoutToTCX(tcxWorkout);

    // Generate filename
    const filename = generateTCXFilename(workout.name);

    // Return TCX file
    return new NextResponse(tcxContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.garmin.tcx+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error exporting workout to TCX:', error);
    return NextResponse.json(
      { error: 'Failed to export workout' },
      { status: 500 }
    );
  }
}
