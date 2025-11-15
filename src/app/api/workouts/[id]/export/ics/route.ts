import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  exportWorkoutToICS,
  generateICSFilename,
} from '@/lib/export/calendar';

/**
 * GET /api/workouts/:id/export/ics
 *
 * Export single workout to iCalendar (.ics) format
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

    // Generate ICS content
    const icsContent = exportWorkoutToICS({
      id: workout.id,
      date: workout.date,
      type: workout.type,
      name: workout.name,
      duration: workout.duration || 60,
      description:
        workout.notes || `${workout.type} workout - ${workout.duration} minutes`,
      structure: workout.structure as any,
    });

    if (icsContent instanceof Error) {
      return NextResponse.json(
        { error: icsContent.message },
        { status: 500 }
      );
    }

    // Generate filename
    const filename = generateICSFilename(workout.name);

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error exporting workout to ICS:', error);
    return NextResponse.json(
      { error: 'Failed to export workout' },
      { status: 500 }
    );
  }
}
