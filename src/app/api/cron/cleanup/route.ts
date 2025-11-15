/**
 * Automated Cleanup Cron Job
 *
 * Performs periodic maintenance tasks:
 * - Clean up expired HITL sessions
 * - Clean up old audit logs (90-day retention)
 * - Detect adaptations for active plans
 *
 * Security: Requires CRON_SECRET in request header or query param
 *
 * Usage:
 * 1. Set CRON_SECRET in environment variables
 * 2. Configure cron to call: POST /api/cron/cleanup?secret=YOUR_SECRET
 * 3. Recommended: Daily at 2 AM UTC
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanupExpiredSessions } from '@/lib/ai/hitl-manager';
import { cleanupOldAuditLogs } from '@/lib/audit-log';
import { analyzeAndAdapt } from '@/lib/engines/adaptation-engine';
import { calculateReadinessScore } from '@/lib/calculations/readiness';
import { subDays } from 'date-fns';

/**
 * Verify cron job authentication
 */
function verifyCronAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not set - cron endpoint is unprotected!');
    return false;
  }

  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret === cronSecret) return true;

  const url = new URL(req.url);
  const querySecret = url.searchParams.get('secret');
  if (querySecret === cronSecret) return true;

  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}

/**
 * Analyze a plan and create adaptation recommendations
 */
async function analyzePlanForAdaptations(planId: string, userId: string): Promise<boolean> {
  try {
    const plan = await prisma.trainingPlan.findUnique({
      where: { id: planId },
      include: {
        workouts: {
          where: { date: { gte: subDays(new Date(), 14) } },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!plan) return false;

    // Get readiness data
    const recentMetrics = await prisma.metric.findMany({
      where: {
        userId,
        date: { gte: subDays(new Date(), 30) },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    const currentReadiness = calculateReadinessScore(recentMetrics);

    // Get readiness history
    const readinessHistory = [];
    for (let i = 0; i < 14; i++) {
      const date = subDays(new Date(), i);
      const dayMetrics = recentMetrics.filter(
        (m) =>
          m.date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
      );
      const dayReadiness = calculateReadinessScore(dayMetrics);
      readinessHistory.push({
        date,
        score: dayReadiness.score,
        level: dayReadiness.level,
      });
    }

    // Map workouts
    const recentWorkouts = plan.workouts.map((w) => ({
      date: w.date,
      plannedType: w.type,
      plannedDuration: w.duration || 0,
      actualType: w.completed ? w.type : undefined,
      actualDuration: w.completed ? w.duration || 0 : undefined,
      completed: w.completed,
      quality: undefined,
    }));

    // Build simple context
    const context = {
      planId: plan.id,
      userId,
      sport: plan.sport,
      goal: plan.goal || 'General fitness',
      raceDate: plan.endDate,
      weeksRemaining: plan.endDate
        ? Math.ceil((plan.endDate.getTime() - new Date().getTime()) / (7 * 24 * 60 * 60 * 1000))
        : undefined,
      currentReadiness,
      readinessHistory,
      recentWorkouts,
      upcomingWeeks: [],
      constraints: {},
    };

    // Run adaptation analysis
    const recommendation = await analyzeAndAdapt(context);

    // If adaptations recommended, save them
    if (recommendation.modifications.length > 0) {
      await prisma.planAdaptation.create({
        data: {
          planId: plan.id,
          userId,
          triggerType: recommendation.triggers.map((t) => t.type).join(',') || 'AUTO_DETECT',
          severity: recommendation.urgency,
          detected: new Date(),
          confidence: recommendation.confidence,
          urgency: recommendation.urgency,
          reasoning: recommendation.reasoning,
          modifications: recommendation.modifications as any,
          alternatives: recommendation.alternatives as any,
          status: 'PENDING',
        },
      });

      return true; // Adaptations created
    }

    return false; // No adaptations needed
  } catch (error: any) {
    console.error(`Error analyzing plan ${planId}:`, error);
    return false;
  }
}

/**
 * POST /api/cron/cleanup
 *
 * Run all automated cleanup and maintenance tasks
 */
export async function POST(req: Request) {
  try {
    // Verify authentication
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    const results = {
      hitlSessions: 0,
      auditLogs: 0,
      plansAnalyzed: 0,
      adaptationsCreated: 0,
      errors: [] as string[],
    };

    // 1. Cleanup expired HITL sessions
    try {
      results.hitlSessions = await cleanupExpiredSessions();
      console.log(`[CRON] Cleaned up ${results.hitlSessions} expired HITL sessions`);
    } catch (error: any) {
      results.errors.push(`HITL cleanup: ${error.message}`);
      console.error('[CRON] Error cleaning HITL sessions:', error);
    }

    // 2. Cleanup old audit logs (90-day retention)
    try {
      results.auditLogs = await cleanupOldAuditLogs(90);
      console.log(`[CRON] Cleaned up ${results.auditLogs} old audit logs`);
    } catch (error: any) {
      results.errors.push(`Audit cleanup: ${error.message}`);
      console.error('[CRON] Error cleaning audit logs:', error);
    }

    // 3. Analyze active plans for adaptations (PREMIUM/TEAM only)
    try {
      // Get active plans for PREMIUM/TEAM users
      const activePlans = await prisma.trainingPlan.findMany({
        where: {
          status: 'ACTIVE',
          endDate: { gte: new Date() }, // Not yet completed
          user: {
            subscription: {
              tier: { in: ['PREMIUM', 'TEAM'] },
              status: 'ACTIVE',
            },
          },
        },
        select: {
          id: true,
          userId: true,
          updatedAt: true,
        },
        take: 100, // Limit to prevent timeouts
      });

      console.log(`[CRON] Analyzing ${activePlans.length} active plans for adaptations`);

      for (const plan of activePlans) {
        try {
          // Only analyze if plan hasn't been analyzed in last 24 hours
          const recentAnalysis = await prisma.planAdaptation.findFirst({
            where: {
              planId: plan.id,
              createdAt: { gte: subDays(new Date(), 1) },
            },
          });

          if (recentAnalysis) {
            continue; // Skip - already analyzed recently
          }

          results.plansAnalyzed++;
          const created = await analyzePlanForAdaptations(plan.id, plan.userId);
          if (created) {
            results.adaptationsCreated++;
          }
        } catch (error: any) {
          results.errors.push(`Plan ${plan.id}: ${error.message}`);
        }
      }

      console.log(`[CRON] Created ${results.adaptationsCreated} adaptation recommendations`);
    } catch (error: any) {
      results.errors.push(`Plan analysis: ${error.message}`);
      console.error('[CRON] Error analyzing plans:', error);
    }

    const duration = Date.now() - startTime;

    console.log(`[CRON] Cleanup completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      results,
    });
  } catch (error: any) {
    console.error('[CRON] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/cleanup
 *
 * Health check / status endpoint
 */
export async function GET(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid CRON_SECRET' },
      { status: 401 }
    );
  }

  const expiredSessions = await prisma.hITLSession.count({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { status: { in: ['completed', 'abandoned'] } },
      ],
    },
  });

  const oldAuditLogs = await prisma.auditLog.count({
    where: {
      createdAt: { lt: subDays(new Date(), 90) },
    },
  });

  const activePlans = await prisma.trainingPlan.count({
    where: {
      status: 'ACTIVE',
      endDate: { gte: new Date() },
    },
  });

  return NextResponse.json({
    status: 'ready',
    pendingCleanup: {
      expiredSessions,
      oldAuditLogs,
      activePlansToAnalyze: activePlans,
    },
    cronSecretConfigured: !!process.env.CRON_SECRET,
  });
}
