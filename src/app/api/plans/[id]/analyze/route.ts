import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { analyzeAndAdapt, AdaptationContext } from '@/lib/engines/adaptation-engine';
import { calculateReadinessScore } from '@/lib/calculations/readiness';
import { subDays, addDays, startOfWeek } from 'date-fns';
import { logAIOperation } from '@/lib/audit-log';

/**
 * GET /api/plans/:id/analyze
 *
 * Analyzes a training plan and generates adaptation recommendations
 * Returns detected triggers and AI-generated modifications
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

    // Get the training plan
    const plan = await prisma.trainingPlan.findUnique({
      where: { id: planId },
      include: {
        workouts: {
          where: {
            date: { gte: subDays(new Date(), 14) },
          },
          orderBy: { date: 'desc' },
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

    // Check subscription tier (PREMIUM/TEAM only)
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    const hasAccess =
      subscription?.tier !== 'FREE' ||
      process.env.ENABLE_AI_ADAPTATIONS_FOR_ALL === 'true';

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Plan adaptation is a Premium feature',
          upgrade: true,
        },
        { status: 403 }
      );
    }

    // Get readiness data
    const recentMetrics = await prisma.metric.findMany({
      where: {
        userId: session.user.id,
        date: { gte: subDays(new Date(), 30) },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    const currentReadiness = calculateReadinessScore(recentMetrics);

    // Get readiness history (last 14 days)
    const readinessHistory = [];
    for (let i = 0; i < 14; i++) {
      const date = subDays(new Date(), i);
      const dayMetrics = recentMetrics.filter(
        (m) =>
          m.date.toISOString().split('T')[0] ===
          date.toISOString().split('T')[0]
      );
      const dayReadiness = calculateReadinessScore(dayMetrics);
      readinessHistory.push({
        date,
        score: dayReadiness.score,
        level: dayReadiness.level,
      });
    }

    // Map recent workouts to expected format
    const recentWorkouts = plan.workouts.map((w) => ({
      date: w.date,
      plannedType: w.type,
      plannedDuration: w.duration || 0,
      actualType: w.completed ? w.type : undefined,
      actualDuration: w.completed ? w.duration || 0 : undefined,
      completed: w.completed,
      quality: undefined, // Could be extracted from metadata if available
    }));

    // Extract upcoming weeks from plan data
    const planData = plan.planData as any;
    const upcomingWeeks = [];

    if (planData && Array.isArray(planData.weeks)) {
      const today = new Date();

      for (const week of planData.weeks) {
        const weekStart = addDays(plan.startDate, (week.weekNumber - 1) * 7);

        if (weekStart >= today) {
          upcomingWeeks.push({
            weekNumber: week.weekNumber,
            startDate: weekStart,
            workouts: week.workouts || [],
            targetLoad: week.targetLoad || 0,
          });
        }

        if (upcomingWeeks.length >= 4) break; // Only next 4 weeks
      }
    }

    // Calculate weeks remaining until race
    const weeksRemaining = plan.endDate
      ? Math.ceil(
          (plan.endDate.getTime() - new Date().getTime()) / (7 * 24 * 60 * 60 * 1000)
        )
      : undefined;

    // Build adaptation context
    const context: AdaptationContext = {
      planId: plan.id,
      userId: session.user.id,
      sport: plan.sport,
      goal: plan.goal || 'General fitness',
      raceDate: plan.endDate,
      weeksRemaining,
      currentReadiness,
      readinessHistory,
      recentWorkouts,
      upcomingWeeks,
      constraints: {
        // Could be pulled from user profile or plan metadata
      },
    };

    // Run adaptation analysis
    const recommendation = await analyzeAndAdapt(context);

    // Save to database if adaptations are recommended
    if (recommendation.modifications.length > 0) {
      await prisma.planAdaptation.create({
        data: {
          planId: plan.id,
          userId: session.user.id,
          triggerType:
            recommendation.triggers.map((t) => t.type).join(',') || 'MANUAL',
          severity: recommendation.urgency,
          detected: new Date(),
          confidence: recommendation.confidence,
          urgency: recommendation.urgency,
          reasoning: recommendation.reasoning,
          modifications: recommendation.modifications as any,
          alternatives: recommendation.alternatives as any,
          status: recommendation.requiresApproval ? 'PENDING' : 'PENDING',
        },
      });
    }

    // Log AI operation
    await logAIOperation({
      userId: session.user.id,
      action: 'PLAN_ANALYZE',
      req,
    });

    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        sport: plan.sport,
        goal: plan.goal,
        weeksRemaining,
      },
      analysis: {
        currentReadiness: {
          score: currentReadiness.score,
          level: currentReadiness.level,
          confidence: currentReadiness.confidence,
        },
        triggers: recommendation.triggers,
        recommendation: {
          confidence: recommendation.confidence,
          urgency: recommendation.urgency,
          reasoning: recommendation.reasoning,
          modifications: recommendation.modifications,
          alternatives: recommendation.alternatives,
          requiresApproval: recommendation.requiresApproval,
        },
      },
    });
  } catch (error) {
    console.error('Error analyzing plan:', error);
    return NextResponse.json(
      { error: 'Failed to analyze plan' },
      { status: 500 }
    );
  }
}
