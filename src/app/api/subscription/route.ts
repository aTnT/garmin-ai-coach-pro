import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFeatureAvailability, formatUsageMessage } from '@/lib/subscription-limits';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create subscription
    let subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    // If no subscription exists, create a FREE tier subscription
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId: session.user.id,
          tier: 'FREE',
          status: 'ACTIVE',
        },
      });
    }

    // Get feature availability for the tier
    const features = getFeatureAvailability(subscription.tier);

    // Format usage message for Garmin syncs
    const syncUsage = formatUsageMessage(
      subscription.tier,
      subscription.garminSyncsThisMonth
    );

    // Get active plans count
    const activePlansCount = await prisma.trainingPlan.count({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      features,
      usage: {
        garminSyncs: {
          count: subscription.garminSyncsThisMonth,
          message: syncUsage,
        },
        activePlans: {
          count: activePlansCount,
          limit: features.limits.maxActivePlans,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch subscription',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
