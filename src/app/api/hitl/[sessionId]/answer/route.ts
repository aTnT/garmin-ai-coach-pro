import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import {
  loadSession,
  submitAnswer,
  saveSession,
  getWorkflowResult,
} from '@/lib/ai/hitl-manager';

const answerSchema = z.object({
  questionId: z.string(),
  answer: z.union([z.string(), z.array(z.string())]),
});

/**
 * POST /api/hitl/[sessionId]/answer
 *
 * Submit an answer to a HITL question
 */
export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    const body = await req.json();
    const { questionId, answer } = answerSchema.parse(body);

    // Load HITL session
    const hitlSession = await loadSession(sessionId);

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

    // Check if session is still active
    if (hitlSession.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is no longer active' },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date() > hitlSession.expiresAt) {
      return NextResponse.json(
        { error: 'Session has expired' },
        { status: 400 }
      );
    }

    // Submit answer
    const updatedSession = submitAnswer(hitlSession, questionId, answer);

    // Save updated session
    await saveSession(updatedSession);

    // Get next workflow state
    const result = getWorkflowResult(updatedSession);

    return NextResponse.json({
      sessionId: updatedSession.id,
      questionAnswered: questionId,
      needsInput: result.needsInput,
      nextQuestion: result.nextQuestion,
      canProceed: result.canProceed,
      allQuestionsAnswered: result.allQuestionsAnswered,
      progress: {
        answered: updatedSession.responses.length,
        total: updatedSession.questions.length,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    // Handle validation errors from submitAnswer
    if (error.message?.includes('not found') || error.message?.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error submitting answer:', error);
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    );
  }
}
