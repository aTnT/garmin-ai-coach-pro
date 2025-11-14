import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createPortalSession } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Create Stripe customer portal session
    const portalSession = await createPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${process.env.NEXTAUTH_URL}/dashboard/settings`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      {
        error: 'Failed to create portal session',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
