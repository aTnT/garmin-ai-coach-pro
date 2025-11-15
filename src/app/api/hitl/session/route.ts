import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import {
  createHITLSession,
  saveSession,
  getWorkflowResult,
} from '@/lib/ai/hitl-manager';

const createSessionSchema = z.object({
  workflowType: z.enum([
    'plan_generation',
    'plan_refinement',
    'adaptation_approval',
    'goal_setting',
    'constraint_gathering',
  ]),
  initialContext: z.record(z.any()).optional(),
});

/**
 * POST /api/hitl/session
 *
 * Start a new HITL session for interactive workflows
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { workflowType, initialContext } = createSessionSchema.parse(body);

    // Create HITL session
    const hitlSession = await createHITLSession(
      workflowType,
      session.user.id,
      initialContext || {}
    );

    // Save session
    await saveSession(hitlSession);

    // Get initial workflow result
    const result = getWorkflowResult(hitlSession);

    return NextResponse.json({
      sessionId: hitlSession.id,
      workflowType: hitlSession.workflowType,
      status: hitlSession.status,
      needsInput: result.needsInput,
      nextQuestion: result.nextQuestion,
      canProceed: result.canProceed,
      expiresAt: hitlSession.expiresAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating HITL session:', error);
    return NextResponse.json(
      { error: 'Failed to create HITL session' },
      { status: 500 }
    );
  }
}
