import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  loadSession,
  getWorkflowResult,
  saveSession,
  deleteSession,
} from '@/lib/ai/hitl-manager';

/**
 * GET /api/hitl/[sessionId]
 *
 * Get current status of a HITL session
 */
export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;

    // Load HITL session
    const hitlSession = loadSession(sessionId);

    if (!hitlSession) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (hitlSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get workflow result
    const result = getWorkflowResult(hitlSession);

    return NextResponse.json({
      sessionId: hitlSession.id,
      workflowType: hitlSession.workflowType,
      status: hitlSession.status,
      needsInput: result.needsInput,
      nextQuestion: result.nextQuestion,
      canProceed: result.canProceed,
      allQuestionsAnswered: result.allQuestionsAnswered,
      progress: {
        answered: hitlSession.responses.length,
        total: hitlSession.questions.length,
      },
      gatheredContext: result.gatheredContext,
      createdAt: hitlSession.createdAt,
      expiresAt: hitlSession.expiresAt,
    });
  } catch (error) {
    console.error('Error fetching HITL session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hitl/[sessionId]
 *
 * Complete or abandon a HITL session
 */
export async function DELETE(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;

    // Load HITL session
    const hitlSession = loadSession(sessionId);

    if (!hitlSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (hitlSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete session
    deleteSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session deleted',
    });
  } catch (error) {
    console.error('Error deleting HITL session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hitl/[sessionId]
 *
 * Mark session as completed
 */
export async function PATCH(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;

    // Load HITL session
    const hitlSession = loadSession(sessionId);

    if (!hitlSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (hitlSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mark as completed
    hitlSession.status = 'completed';
    hitlSession.completedAt = new Date();

    saveSession(hitlSession);

    // Get final result
    const result = getWorkflowResult(hitlSession);

    return NextResponse.json({
      success: true,
      sessionId: hitlSession.id,
      status: 'completed',
      gatheredContext: result.gatheredContext,
      completedAt: hitlSession.completedAt,
    });
  } catch (error) {
    console.error('Error completing HITL session:', error);
    return NextResponse.json(
      { error: 'Failed to complete session' },
      { status: 500 }
    );
  }
}
