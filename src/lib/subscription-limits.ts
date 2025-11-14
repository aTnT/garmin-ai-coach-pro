/**
 * Subscription Feature Gating
 *
 * This module provides utilities to check and enforce subscription limits
 * across the application.
 */

import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { getTierConfig, hasReachedSyncLimit } from './stripe';

export interface SubscriptionCheck {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  currentLimit?: number;
  usage?: number;
}

/**
 * Check if user can access AI chat
 */
export function canAccessAIChat(tier: SubscriptionTier): SubscriptionCheck {
  const config = getTierConfig(tier);

  if (config.limits.aiChatEnabled) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'AI Chat is available on Premium and Team plans',
    upgradeRequired: true,
  };
}

/**
 * Check if user can perform Garmin sync
 */
export function canSyncGarmin(
  tier: SubscriptionTier,
  syncsThisMonth: number
): SubscriptionCheck {
  const config = getTierConfig(tier);
  const limit = config.limits.garminSyncsPerMonth;

  if (limit === Infinity) {
    return { allowed: true };
  }

  if (hasReachedSyncLimit(tier, syncsThisMonth)) {
    return {
      allowed: false,
      reason: `You've reached your monthly sync limit (${limit} syncs)`,
      upgradeRequired: true,
      currentLimit: limit,
      usage: syncsThisMonth,
    };
  }

  return {
    allowed: true,
    currentLimit: limit,
    usage: syncsThisMonth,
  };
}

/**
 * Check if user can create a new training plan
 */
export function canCreatePlan(
  tier: SubscriptionTier,
  currentActivePlans: number
): SubscriptionCheck {
  const config = getTierConfig(tier);
  const limit = config.limits.maxActivePlans;

  if (limit === Infinity) {
    return { allowed: true };
  }

  if (currentActivePlans >= limit) {
    return {
      allowed: false,
      reason: `You've reached your plan limit (${limit} active plan${
        limit > 1 ? 's' : ''
      })`,
      upgradeRequired: true,
      currentLimit: limit,
      usage: currentActivePlans,
    };
  }

  return {
    allowed: true,
    currentLimit: limit,
    usage: currentActivePlans,
  };
}

/**
 * Get analysis days limit for the tier
 */
export function getAnalysisDaysLimit(tier: SubscriptionTier): number {
  const config = getTierConfig(tier);
  return config.limits.analysisDays;
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === 'ACTIVE' || status === 'TRIALING';
}

/**
 * Get feature availability summary for a tier
 */
export function getFeatureAvailability(tier: SubscriptionTier) {
  const config = getTierConfig(tier);

  return {
    tier,
    tierName: config.name,
    price: config.price,
    features: config.features,
    limits: {
      analysisDays: config.limits.analysisDays,
      garminSyncsPerMonth:
        config.limits.garminSyncsPerMonth === Infinity
          ? 'Unlimited'
          : config.limits.garminSyncsPerMonth,
      maxActivePlans:
        config.limits.maxActivePlans === Infinity
          ? 'Unlimited'
          : config.limits.maxActivePlans,
      aiChatEnabled: config.limits.aiChatEnabled,
    },
  };
}

/**
 * Check if user needs to upgrade for a feature
 */
export function getUpgradeRecommendation(
  currentTier: SubscriptionTier,
  desiredFeature: 'aiChat' | 'unlimitedSyncs' | 'unlimitedPlans' | 'teamManagement'
): {
  needsUpgrade: boolean;
  recommendedTier?: 'PREMIUM' | 'TEAM';
  reason?: string;
} {
  const tierLimits = {
    FREE: { aiChat: false, unlimitedSyncs: false, unlimitedPlans: false, teamManagement: false },
    PREMIUM: { aiChat: true, unlimitedSyncs: true, unlimitedPlans: true, teamManagement: false },
    TEAM: { aiChat: true, unlimitedSyncs: true, unlimitedPlans: true, teamManagement: true },
  };

  const currentLimits = tierLimits[currentTier];

  if (currentLimits[desiredFeature]) {
    return { needsUpgrade: false };
  }

  if (desiredFeature === 'teamManagement') {
    return {
      needsUpgrade: true,
      recommendedTier: 'TEAM',
      reason: 'Team management is only available on the Team plan',
    };
  }

  return {
    needsUpgrade: true,
    recommendedTier: 'PREMIUM',
    reason: `${desiredFeature} is available on Premium and Team plans`,
  };
}

/**
 * Format usage message for display
 */
export function formatUsageMessage(
  tier: SubscriptionTier,
  syncsThisMonth: number
): string {
  const config = getTierConfig(tier);
  const limit = config.limits.garminSyncsPerMonth;

  if (limit === Infinity) {
    return 'Unlimited syncs';
  }

  const remaining = Math.max(0, limit - syncsThisMonth);

  return `${syncsThisMonth} of ${limit} syncs used this month (${remaining} remaining)`;
}
