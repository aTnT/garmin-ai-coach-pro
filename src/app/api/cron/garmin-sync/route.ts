/**
 * Automated Garmin Sync Cron Job
 *
 * This endpoint can be called by:
 * - Vercel Cron (vercel.json configuration)
 * - External cron services (cron-job.org, EasyCron, etc.)
 * - GitHub Actions scheduled workflows
 *
 * Security: Requires CRON_SECRET in request header or query param
 *
 * Usage:
 * 1. Set CRON_SECRET in environment variables
 * 2. Configure cron to call: POST /api/cron/garmin-sync?secret=YOUR_SECRET
 * 3. Recommended: Daily at 6 AM UTC (after most workouts are completed)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  fetchGarminActivities,
  fetchGarminHealthMetrics,
  convertGarminActivityToWorkout,
  convertGarminHealthMetrics,
  GarminTokens,
} from '@/lib/garmin-oauth';
import { subDays, format, startOfMonth } from 'date-fns';
import { canSyncGarmin } from '@/lib/subscription-limits';
import { logGarminSync } from '@/lib/audit-log';

/**
 * Verify cron job authentication
 */
function verifyCronAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not set - cron endpoint is unprotected!');
    return false;
  }

  // Check header (preferred for Vercel Cron)
  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret === cronSecret) {
    return true;
  }

  // Check query param (for external services)
  const url = new URL(req.url);
  const querySecret = url.searchParams.get('secret');
  if (querySecret === cronSecret) {
    return true;
  }

  // Check authorization header (for Vercel Cron)
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return false;
}

/**
 * Sync Garmin data for a single user
 */
async function syncUserGarminData(userId: string, days: number = 7): Promise<{
  success: boolean;
  activitiesImported: number;
  metricsImported: number;
  error?: string;
}> {
  try {
    // Get OAuth token
    const oauthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'GARMIN',
        },
      },
    });

    if (!oauthToken) {
      return {
        success: false,
        activitiesImported: 0,
        metricsImported: 0,
        error: 'No Garmin connection',
      };
    }

    const tokens: GarminTokens = {
      accessToken: oauthToken.accessToken,
      accessTokenSecret: oauthToken.refreshToken || '',
    };

    let activitiesImported = 0;
    let metricsImported = 0;

    // Fetch and import activities
    const activities = await fetchGarminActivities(tokens, days);

    for (const activity of activities) {
      try {
        const workout = convertGarminActivityToWorkout(activity);

        await prisma.workout.upsert({
          where: {
            id: `garmin-${activity.activityId}-${userId}`,
          },
          create: {
            id: `garmin-${activity.activityId}-${userId}`,
            userId,
            ...workout,
          },
          update: {
            ...workout,
          },
        });

        activitiesImported++;
      } catch (error) {
        console.error(`Error importing activity ${activity.activityId}:`, error);
      }
    }

    // Fetch and import health metrics
    const endDate = new Date();
    const startDate = subDays(endDate, days);

    const healthMetrics = await fetchGarminHealthMetrics(
      tokens,
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    );

    for (const dayData of healthMetrics) {
      try {
        const metrics = convertGarminHealthMetrics(dayData);

        for (const metric of metrics) {
          await prisma.metric.create({
            data: {
              userId,
              ...metric,
            },
          });
          metricsImported++;
        }
      } catch (error) {
        console.error(`Error importing metrics for ${dayData.calendarDate}:`, error);
      }
    }

    // Update last sync time
    await prisma.oAuthToken.update({
      where: {
        userId_provider: {
          userId,
          provider: 'GARMIN',
        },
      },
      data: {
        updatedAt: new Date(),
      },
    });

    // Increment sync counter
    await prisma.subscription.update({
      where: { userId },
      data: {
        garminSyncsThisMonth: {
          increment: 1,
        },
      },
    });

    // Audit log
    await logGarminSync({
      userId,
      action: 'GARMIN_SYNC',
      activitiesCount: activitiesImported,
      metricsCount: metricsImported,
    });

    return {
      success: true,
      activitiesImported,
      metricsImported,
    };
  } catch (error: any) {
    console.error(`Error syncing Garmin data for user ${userId}:`, error);

    // Delete invalid tokens
    if (error.message?.includes('Unauthorized') || error.message?.includes('token')) {
      await prisma.oAuthToken.delete({
        where: {
          userId_provider: {
            userId,
            provider: 'GARMIN',
          },
        },
      });
    }

    return {
      success: false,
      activitiesImported: 0,
      metricsImported: 0,
      error: error.message,
    };
  }
}

/**
 * POST /api/cron/garmin-sync
 *
 * Sync Garmin data for all connected users
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

    // Get all users with Garmin connected
    const garminUsers = await prisma.oAuthToken.findMany({
      where: {
        provider: 'GARMIN',
      },
      select: {
        userId: true,
      },
    });

    console.log(`[CRON] Starting automated sync for ${garminUsers.length} users with Garmin connected`);

    // Get sync days from query param (default 7 days)
    const url = new URL(req.url);
    const syncDays = parseInt(url.searchParams.get('days') || '7', 10);

    const results = {
      totalUsers: garminUsers.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalActivities: 0,
      totalMetrics: 0,
      errors: [] as string[],
    };

    // Sync each user
    for (const { userId } of garminUsers) {
      try {
        // Check subscription limits
        let subscription = await prisma.subscription.findUnique({
          where: { userId },
        });

        if (!subscription) {
          subscription = await prisma.subscription.create({
            data: {
              userId,
              tier: 'FREE',
              status: 'ACTIVE',
            },
          });
        }

        // Reset monthly sync count if new month
        const now = new Date();
        const monthStart = startOfMonth(now);
        if (subscription.lastSyncReset < monthStart) {
          subscription = await prisma.subscription.update({
            where: { userId },
            data: {
              garminSyncsThisMonth: 0,
              lastSyncReset: now,
            },
          });
        }

        // Check if user can sync (respects subscription limits)
        const syncCheck = canSyncGarmin(
          subscription.tier,
          subscription.garminSyncsThisMonth
        );

        if (!syncCheck.allowed) {
          console.log(`[CRON] Skipping user ${userId} - sync limit reached`);
          results.skipped++;
          continue;
        }

        // Perform sync
        const syncResult = await syncUserGarminData(userId, syncDays);

        if (syncResult.success) {
          results.successful++;
          results.totalActivities += syncResult.activitiesImported;
          results.totalMetrics += syncResult.metricsImported;
          console.log(`[CRON] Synced user ${userId}: ${syncResult.activitiesImported} activities, ${syncResult.metricsImported} metrics`);
        } else {
          results.failed++;
          results.errors.push(`User ${userId}: ${syncResult.error}`);
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`User ${userId}: ${error.message}`);
        console.error(`[CRON] Error processing user ${userId}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[CRON] Sync completed in ${duration}ms - ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`);

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
 * GET /api/cron/garmin-sync
 *
 * Health check / status endpoint
 */
export async function GET(req: Request) {
  // Verify authentication for status check too
  if (!verifyCronAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid CRON_SECRET' },
      { status: 401 }
    );
  }

  const connectedUsers = await prisma.oAuthToken.count({
    where: { provider: 'GARMIN' },
  });

  const lastSync = await prisma.oAuthToken.findFirst({
    where: { provider: 'GARMIN' },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });

  return NextResponse.json({
    status: 'ready',
    connectedUsers,
    lastSyncTimestamp: lastSync?.updatedAt || null,
    cronSecretConfigured: !!process.env.CRON_SECRET,
  });
}
