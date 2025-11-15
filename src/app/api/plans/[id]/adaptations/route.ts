import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/plans/:id/adaptations
 *
 * Lists all adaptation recommendations for a plan
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

    // Verify ownership
    const plan = await prisma.trainingPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (plan.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get adaptations
    const adaptations = await prisma.planAdaptation.findMany({
      where: { planId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      adaptations: adaptations.map((a) => ({
        id: a.id,
        triggerType: a.triggerType,
        severity: a.severity,
        detected: a.detected,
        confidence: a.confidence,
        urgency: a.urgency,
        reasoning: a.reasoning,
        modifications: a.modifications,
        alternatives: a.alternatives,
        status: a.status,
        appliedAt: a.appliedAt,
        rejectedAt: a.rejectedAt,
        rejectedReason: a.rejectedReason,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching adaptations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch adaptations' },
      { status: 500 }
    );
  }
}
