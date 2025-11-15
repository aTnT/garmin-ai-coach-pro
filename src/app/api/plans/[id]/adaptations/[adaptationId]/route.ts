import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const applySchema = z.object({
  action: z.enum(['apply', 'reject']),
  reason: z.string().optional(),
});

/**
 * POST /api/plans/:id/adaptations/:adaptationId
 *
 * Apply or reject an adaptation recommendation
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
    const body = await req.json();
    const { action, reason } = applySchema.parse(body);

    // Get the adaptation
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

    // Verify plan match and ownership
    if (adaptation.planId !== planId) {
      return NextResponse.json(
        { error: 'Adaptation does not belong to this plan' },
        { status: 400 }
      );
    }

    if (adaptation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if already processed
    if (adaptation.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Adaptation already ${adaptation.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (action === 'apply') {
      // Apply the adaptation
      // In a real system, this would actually modify the plan data
      // For now, we'll just mark it as applied

      const modifications = adaptation.modifications as any;

      // TODO: Actually modify the plan.planData JSON based on modifications
      // This would involve parsing the modifications and updating the plan structure
      // Example: Reducing load, rescheduling workouts, changing intensities, etc.

      await prisma.planAdaptation.update({
        where: { id: adaptationId },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
          appliedBy: session.user.id,
        },
      });

      // Update plan's updatedAt timestamp
      await prisma.trainingPlan.update({
        where: { id: planId },
        data: {
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Adaptation applied successfully',
        adaptation: {
          id: adaptation.id,
          status: 'APPLIED',
          appliedAt: new Date(),
        },
      });
    } else {
      // Reject the adaptation
      await prisma.planAdaptation.update({
        where: { id: adaptationId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedReason: reason || 'User declined',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Adaptation rejected',
        adaptation: {
          id: adaptation.id,
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedReason: reason || 'User declined',
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error processing adaptation:', error);
    return NextResponse.json(
      { error: 'Failed to process adaptation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/plans/:id/adaptations/:adaptationId
 *
 * Get details of a specific adaptation
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string; adaptationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: planId, adaptationId } = params;

    // Get the adaptation
    const adaptation = await prisma.planAdaptation.findUnique({
      where: { id: adaptationId },
    });

    if (!adaptation) {
      return NextResponse.json(
        { error: 'Adaptation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (adaptation.planId !== planId || adaptation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      adaptation: {
        id: adaptation.id,
        triggerType: adaptation.triggerType,
        severity: adaptation.severity,
        detected: adaptation.detected,
        confidence: adaptation.confidence,
        urgency: adaptation.urgency,
        reasoning: adaptation.reasoning,
        modifications: adaptation.modifications,
        alternatives: adaptation.alternatives,
        status: adaptation.status,
        appliedAt: adaptation.appliedAt,
        appliedBy: adaptation.appliedBy,
        rejectedAt: adaptation.rejectedAt,
        rejectedReason: adaptation.rejectedReason,
        createdAt: adaptation.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching adaptation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch adaptation' },
      { status: 500 }
    );
  }
}
