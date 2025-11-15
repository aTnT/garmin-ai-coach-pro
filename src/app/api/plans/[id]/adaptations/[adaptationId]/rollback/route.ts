import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { restorePlanFromBackup } from '@/lib/engines/plan-modifier';

/**
 * POST /api/plans/:id/adaptations/:adaptationId/rollback
 *
 * Rollback an applied adaptation to restore previous plan state
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string; adaptationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: planId, adaptationId } = params;

    // Get the adaptation with plan
    const adaptation = await prisma.planAdaptation.findUnique({
      where: { id: adaptationId },
      include: {
        plan: true,
      },
    });

    if (!adaptation) {
      return NextResponse.json(
        { error: 'Adaptation not found' },
        { status: 404 }
      );
    }

    // Verify ownership and plan match
    if (adaptation.planId !== planId) {
      return NextResponse.json(
        { error: 'Adaptation does not belong to this plan' },
        { status: 400 }
      );
    }

    if (adaptation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if adaptation was applied
    if (adaptation.status !== 'APPLIED') {
      return NextResponse.json(
        { error: 'Can only rollback applied adaptations' },
        { status: 400 }
      );
    }

    // Check if backup exists
    if (!adaptation.previousPlanData) {
      return NextResponse.json(
        { error: 'No backup available for rollback' },
        { status: 400 }
      );
    }

    // Check if already rolled back
    if (adaptation.rollbackAt) {
      return NextResponse.json(
        { error: 'Adaptation already rolled back' },
        { status: 400 }
      );
    }

    // Restore plan from backup
    const restoredPlanData = restorePlanFromBackup(adaptation.previousPlanData);

    // Update database with restored plan and rollback timestamp
    await prisma.$transaction([
      // Mark adaptation as rolled back
      prisma.planAdaptation.update({
        where: { id: adaptationId },
        data: {
          rollbackAt: new Date(),
        },
      }),

      // Restore plan data
      prisma.trainingPlan.update({
        where: { id: planId },
        data: {
          planData: restoredPlanData as any,
          updatedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Adaptation rolled back successfully',
      adaptation: {
        id: adaptation.id,
        rolledBack: true,
        rollbackAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error rolling back adaptation:', error);
    return NextResponse.json(
      { error: 'Failed to rollback adaptation' },
      { status: 500 }
    );
  }
}
