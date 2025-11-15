/**
 * Stripe Integration for SaaS Monetization
 *
 * This module handles Stripe subscription management for tiered pricing:
 * - FREE: Limited features, 5 Garmin syncs/month
 * - PREMIUM: Unlimited features, $19/month
 * - TEAM: Premium + team management, $49/month
 *
 * Setup Required:
 * 1. Create Stripe account at: https://stripe.com
 * 2. Get API keys from: https://dashboard.stripe.com/apikeys
 * 3. Create products and prices in Stripe dashboard
 * 4. Set up webhook endpoint for subscription events
 * 5. Add to .env:
 *    STRIPE_SECRET_KEY="sk_test_..."
 *    STRIPE_PUBLISHABLE_KEY="pk_test_..."
 *    STRIPE_WEBHOOK_SECRET="whsec_..."
 *    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
 */

import Stripe from 'stripe';
import { SubscriptionTier } from '@prisma/client';

// Initialize Stripe only if key is provided (optional for build without Stripe)
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    })
  : null;

/**
 * Subscription Tier Configuration
 */
export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    price: 0,
    priceId: null, // No Stripe price ID for free tier
    features: [
      '7-day training data analysis',
      '5 Garmin syncs per month',
      '1 active training plan',
      'Basic readiness scoring',
      'CSV data upload',
      'Limited chart analytics',
    ],
    limits: {
      analysisDays: 7,
      garminSyncsPerMonth: 5,
      maxActivePlans: 1,
      aiChatEnabled: false,
      unlimitedSyncs: false,
    },
  },
  PREMIUM: {
    name: 'Premium',
    price: 19, // USD per month
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID, // Set in .env after creating in Stripe
    features: [
      'Everything in Free',
      '30-day training data analysis',
      'Unlimited Garmin syncs',
      'Unlimited training plans',
      'Unlimited AI coaching chat',
      'Advanced analytics & charts',
      'Priority support',
    ],
    limits: {
      analysisDays: 30,
      garminSyncsPerMonth: Infinity,
      maxActivePlans: Infinity,
      aiChatEnabled: true,
      unlimitedSyncs: true,
    },
  },
  TEAM: {
    name: 'Team',
    price: 49, // USD per month
    priceId: process.env.STRIPE_TEAM_PRICE_ID, // Set in .env after creating in Stripe
    features: [
      'Everything in Premium',
      'Team management (coach/athlete)',
      'Up to 10 athletes per coach',
      'Shared training plans',
      'Team analytics dashboard',
      'Bulk data export',
      'Dedicated support',
    ],
    limits: {
      analysisDays: 90,
      garminSyncsPerMonth: Infinity,
      maxActivePlans: Infinity,
      aiChatEnabled: true,
      unlimitedSyncs: true,
      maxAthletes: 10,
      teamManagement: true,
    },
  },
} as const;

/**
 * Get tier configuration
 */
export function getTierConfig(tier: SubscriptionTier) {
  return SUBSCRIPTION_TIERS[tier];
}

/**
 * Check if user can perform an action based on their subscription tier
 */
export function canPerformAction(
  tier: SubscriptionTier,
  action: keyof typeof SUBSCRIPTION_TIERS.FREE.limits
): boolean {
  const config = getTierConfig(tier);
  const limit = config.limits[action];

  if (typeof limit === 'boolean') {
    return limit;
  }

  if (limit === Infinity) {
    return true;
  }

  return false;
}

/**
 * Check if user has reached their Garmin sync limit
 */
export function hasReachedSyncLimit(
  tier: SubscriptionTier,
  syncsThisMonth: number
): boolean {
  const config = getTierConfig(tier);
  const limit = config.limits.garminSyncsPerMonth;

  if (limit === Infinity) {
    return false;
  }

  return syncsThisMonth >= limit;
}

/**
 * Create Stripe checkout session for subscription
 */
export async function createCheckoutSession(params: {
  userId: string;
  tier: 'PREMIUM' | 'TEAM';
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  const config = getTierConfig(params.tier);

  if (!config.priceId) {
    throw new Error(`Price ID not configured for tier: ${params.tier}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: config.priceId,
        quantity: 1,
      },
    ],
    customer_email: params.customerEmail,
    client_reference_id: params.userId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      trial_period_days: 14, // 14-day free trial for all paid subscriptions
      metadata: {
        userId: params.userId,
        tier: params.tier,
      },
    },
  });

  return session;
}

/**
 * Create Stripe customer portal session for subscription management
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session;
}

/**
 * Get subscription details from Stripe
 */
export async function getSubscriptionDetails(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscription;
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  return subscription;
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
  return subscription;
}

/**
 * Map Stripe subscription status to our SubscriptionStatus enum
 */
export function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'ACTIVE',
    canceled: 'CANCELED',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    past_due: 'PAST_DUE',
    trialing: 'TRIALING',
    unpaid: 'UNPAID',
    paused: 'CANCELED', // Treat paused as canceled
  };

  return statusMap[stripeStatus] || 'CANCELED';
}

/**
 * Determine subscription tier from Stripe price ID
 */
export function getTierFromPriceId(priceId: string): SubscriptionTier {
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) {
    return 'PREMIUM';
  }
  if (priceId === process.env.STRIPE_TEAM_PRICE_ID) {
    return 'TEAM';
  }
  return 'FREE';
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
    return event;
  } catch (error: any) {
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}
