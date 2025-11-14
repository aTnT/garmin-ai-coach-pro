import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyWebhookSignature, mapStripeStatus, getTierFromPriceId } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

/**
 * Stripe Webhook Handler
 *
 * This endpoint handles Stripe webhook events for subscription lifecycle:
 * - checkout.session.completed: New subscription created
 * - customer.subscription.updated: Subscription changed
 * - customer.subscription.deleted: Subscription canceled
 * - invoice.payment_succeeded: Payment successful
 * - invoice.payment_failed: Payment failed
 */

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const event = verifyWebhookSignature(body, signature);

    console.log('Received Stripe webhook event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      {
        error: 'Webhook handler failed',
        message: error.message,
      },
      { status: 400 }
    );
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  // Subscription will be created/updated via subscription.created event
  // Just ensure we have the customer ID
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      tier: 'FREE', // Will be updated by subscription.created event
      status: 'ACTIVE',
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    },
  });
}

/**
 * Handle subscription created or updated
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const userId = subscription.metadata.userId;

  if (!userId) {
    // Try to find user by customer ID
    const existingSubscription = await prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!existingSubscription) {
      console.error('Cannot find user for subscription:', subscription.id);
      return;
    }
  }

  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId);
  const status = mapStripeStatus(subscription.status);

  // Find subscription by customer ID or user ID
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        { userId: userId || '' },
      ],
    },
  });

  if (existingSubscription) {
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        tier,
        status: status as SubscriptionStatus,
        stripePriceId: priceId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      },
    });
  }
}

/**
 * Handle subscription deleted (canceled)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (existingSubscription) {
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        tier: 'FREE',
        status: 'CANCELED',
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    return;
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (existingSubscription) {
    // Update status to ACTIVE on successful payment
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: 'ACTIVE',
      },
    });
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    return;
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (existingSubscription) {
    // Update status to PAST_DUE on failed payment
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: 'PAST_DUE',
      },
    });
  }
}
