import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  exportPlanToICS,
  generateICSFilename,
  type TrainingPlanExport,
} from '@/lib/export/calendar';

/**
 * GET /api/plans/:id/export/ics
 *
 * Export training plan to iCalendar (.ics) format
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

    const { id: planId } = params;

    // Get the training plan with workouts
    const plan = await prisma.trainingPlan.findUnique({
      where: { id: planId },
      include: {
        workouts: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Check ownership
    if (plan.userId !== session.user.id) {
      // TODO: Check if user is coach with permission
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Transform plan data for export
    const planData = plan.planData as any;
    const exportData: TrainingPlanExport = {
      name: plan.name,
      description: plan.description || undefined,
      goal: plan.goal || undefined,
      weeks: [],
    };

    // Group workouts by week
    if (planData && Array.isArray(planData.weeks)) {
      exportData.weeks = planData.weeks.map((week: any) => ({
        weekNumber: week.weekNumber,
        startDate: new Date(week.startDate),
        workouts: week.workouts || [],
      }));
    } else {
      // Fallback: Group workouts manually if plan structure unavailable
      const weekMap = new Map<number, any>();

      for (const workout of plan.workouts) {
        const weeksSinceStart = Math.floor(
          (workout.date.getTime() - plan.startDate.getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        );
        const weekNumber = weeksSinceStart + 1;

        if (!weekMap.has(weekNumber)) {
          weekMap.set(weekNumber, {
            weekNumber,
            startDate: new Date(
              plan.startDate.getTime() + weeksSinceStart * 7 * 24 * 60 * 60 * 1000
            ),
            workouts: [],
          });
        }

        weekMap.get(weekNumber).workouts.push({
          id: workout.id,
          date: workout.date,
          type: workout.type,
          name: workout.name,
          duration: workout.duration || 60,
          description:
            workout.notes || `${workout.type} workout - ${workout.duration} minutes`,
          structure: workout.structure,
        });
      }

      exportData.weeks = Array.from(weekMap.values()).sort(
        (a, b) => a.weekNumber - b.weekNumber
      );
    }

    // Generate ICS content
    const icsContent = exportPlanToICS(exportData);

    if (icsContent instanceof Error) {
      return NextResponse.json(
        { error: icsContent.message },
        { status: 500 }
      );
    }

    // Generate filename
    const filename = generateICSFilename(plan.name);

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
    console.error('Error exporting plan to ICS:', error);
    return NextResponse.json(
      { error: 'Failed to export plan' },
      { status: 500 }
    );
  }
}
