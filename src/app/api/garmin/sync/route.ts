import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  fetchGarminActivities,
  fetchGarminHealthMetrics,
  convertGarminActivityToWorkout,
  convertGarminHealthMetrics,
  GarminTokens,
} from '@/lib/garmin-oauth';
import { subDays, format } from 'date-fns';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { days = 30 } = body; // Number of days to sync

    // Get Garmin OAuth token
    const oauthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: 'GARMIN',
        },
      },
    });

    if (!oauthToken) {
      return NextResponse.json(
        { error: 'Garmin account not connected' },
        { status: 400 }
      );
    }

    const tokens: GarminTokens = {
      accessToken: oauthToken.accessToken,
      accessTokenSecret: oauthToken.refreshToken || '', // Using refreshToken field for token secret
    };

    let activitiesImported = 0;
    let metricsImported = 0;

    try {
      // Fetch recent activities
      const activities = await fetchGarminActivities(tokens, days);

      // Convert and import activities
      for (const activity of activities) {
        try {
          const workout = convertGarminActivityToWorkout(activity);

          await prisma.workout.upsert({
            where: {
              // Use a composite identifier based on Garmin activity ID
              // Store in notes or create a separate field
              id: `garmin-${activity.activityId}-${session.user.id}`,
            },
            create: {
              id: `garmin-${activity.activityId}-${session.user.id}`,
              userId: session.user.id,
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

      // Fetch health metrics
      const endDate = new Date();
      const startDate = subDays(endDate, days);

      const healthMetrics = await fetchGarminHealthMetrics(
        tokens,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );

      // Convert and import health metrics
      for (const dayData of healthMetrics) {
        try {
          const metrics = convertGarminHealthMetrics(dayData);

          for (const metric of metrics) {
            await prisma.metric.create({
              data: {
                userId: session.user.id,
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
            userId: session.user.id,
            provider: 'GARMIN',
          },
        },
        data: {
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        activitiesImported,
        metricsImported,
        message: `Successfully synced ${activitiesImported} activities and ${metricsImported} metrics from Garmin`,
      });
    } catch (apiError: any) {
      console.error('Garmin API error:', apiError);

      // If token is invalid, delete it
      if (apiError.message?.includes('Unauthorized') || apiError.message?.includes('token')) {
        await prisma.oAuthToken.delete({
          where: {
            userId_provider: {
              userId: session.user.id,
              provider: 'GARMIN',
            },
          },
        });

        return NextResponse.json(
          {
            error: 'Garmin token invalid',
            message: 'Please reconnect your Garmin account',
          },
          { status: 401 }
        );
      }

      throw apiError;
    }
  } catch (error: any) {
    console.error('Error syncing Garmin data:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync Garmin data',
        message: error.message || 'Please try again later',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const oauthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: 'GARMIN',
        },
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!oauthToken) {
      return NextResponse.json({
        connected: false,
        lastSync: null,
      });
    }

    return NextResponse.json({
      connected: true,
      connectedAt: oauthToken.createdAt,
      lastSync: oauthToken.updatedAt,
    });
  } catch (error) {
    console.error('Error checking Garmin sync status:', error);
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    );
  }
}
