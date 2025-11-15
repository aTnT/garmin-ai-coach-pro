/**
 * GDPR Compliance: User Data Management
 *
 * - GET: Export all user data (GDPR Article 20: Right to data portability)
 * - DELETE: Delete all user data (GDPR Article 17: Right to be forgotten)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';

/**
 * GET /api/user/data
 *
 * Export all user data in JSON format (GDPR compliance)
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all user data
    const [
      user,
      metrics,
      workouts,
      plans,
      conversations,
      oauthTokens,
      subscription,
      teamMemberships,
      sentInvites,
      auditLogs,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          age: true,
          gender: true,
          weight: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.metric.findMany({ where: { userId } }),
      prisma.workout.findMany({ where: { userId } }),
      prisma.trainingPlan.findMany({ where: { userId } }),
      prisma.conversation.findMany({
        where: { userId },
        include: { messages: true },
      }),
      prisma.oAuthToken.findMany({
        where: { userId },
        select: {
          provider: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true,
          // Don't include tokens for security
        },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: {
          tier: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          garminSyncsThisMonth: true,
          createdAt: true,
        },
      }),
      prisma.teamMembership.findMany({
        where: {
          OR: [{ coachId: userId }, { athleteId: userId }],
        },
      }),
      prisma.teamInvite.findMany({
        where: { coachId: userId },
      }),
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100, // Last 100 audit logs
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      metrics: {
        count: metrics.length,
        data: metrics,
      },
      workouts: {
        count: workouts.length,
        data: workouts,
      },
      trainingPlans: {
        count: plans.length,
        data: plans,
      },
      conversations: {
        count: conversations.length,
        data: conversations,
      },
      connectedAccounts: oauthTokens,
      subscription,
      team: {
        memberships: teamMemberships,
        invitesSent: sentInvites,
      },
      auditLogs: {
        count: auditLogs.length,
        recentLogs: auditLogs,
      },
    };

    // Audit log
    await createAuditLog({
      action: AUDIT_ACTIONS.DATA_EXPORT,
      userId,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json(exportData);
  } catch (error: any) {
    console.error('Error exporting user data:', error);
    return NextResponse.json(
      {
        error: 'Failed to export data',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/data
 *
 * Delete all user data (GDPR "right to be forgotten")
 *
 * IMPORTANT: This is irreversible and will:
 * - Delete all training data (metrics, workouts, plans)
 * - Delete all conversations and AI chat history
 * - Disconnect all OAuth accounts (Garmin, etc.)
 * - Cancel active subscriptions
 * - Remove from all teams
 * - Delete the user account
 */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Require explicit confirmation
    const body = await req.json();
    if (body.confirmEmail !== session.user.email) {
      return NextResponse.json(
        {
          error: 'Email confirmation required',
          message: 'Please confirm your email address to delete your account',
        },
        { status: 400 }
      );
    }

    // Audit log BEFORE deletion
    await createAuditLog({
      action: AUDIT_ACTIONS.DATA_DELETE,
      userId,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      metadata: {
        email: session.user.email,
        reason: body.reason || 'User requested deletion',
      },
    });

    // Cancel Stripe subscription if exists
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription?.stripeSubscriptionId) {
      try {
        const stripe = await import('stripe');
        const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2025-10-29.clover',
        });
        await stripeClient.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (stripeError) {
        console.error('Error canceling Stripe subscription:', stripeError);
        // Continue with deletion even if Stripe fails
      }
    }

    // Delete all user data using Prisma cascade
    // The schema has onDelete: Cascade for all relations
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: 'All user data has been permanently deleted',
      deletedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error deleting user data:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete data',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
