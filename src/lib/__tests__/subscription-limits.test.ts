/**
 * Tests for Subscription Limits Module
 * Tests subscription feature gating and limits
 */

// Mock the stripe module
jest.mock('../stripe', () => ({
  getTierConfig: jest.fn((tier) => {
    const configs = {
      FREE: {
        name: 'Free',
        price: '$0',
        features: ['Basic metrics', '7-day analysis'],
        limits: {
          garminSyncsPerMonth: 5,
          maxActivePlans: 1,
          analysisDays: 7,
          aiChatEnabled: false,
        },
      },
      PREMIUM: {
        name: 'Premium',
        price: '$19.99',
        features: ['Unlimited syncs', 'AI coaching', 'Unlimited plans'],
        limits: {
          garminSyncsPerMonth: Infinity,
          maxActivePlans: Infinity,
          analysisDays: 90,
          aiChatEnabled: true,
        },
      },
      TEAM: {
        name: 'Team',
        price: '$49.99',
        features: ['All Premium features', 'Team management', 'Multi-user'],
        limits: {
          garminSyncsPerMonth: Infinity,
          maxActivePlans: Infinity,
          analysisDays: 365,
          aiChatEnabled: true,
        },
      },
    };
    return configs[tier];
  }),
  hasReachedSyncLimit: jest.fn((tier, syncs) => {
    if (tier === 'FREE') return syncs >= 5;
    return false;
  }),
}));

import {
  canAccessAIChat,
  canSyncGarmin,
  canCreatePlan,
  getAnalysisDaysLimit,
  isSubscriptionActive,
  getFeatureAvailability,
  getUpgradeRecommendation,
  formatUsageMessage,
} from '../subscription-limits';

describe('Subscription Limits', () => {
  describe('canAccessAIChat', () => {
    it('should allow AI chat for PREMIUM tier', () => {
      const result = canAccessAIChat('PREMIUM');

      expect(result.allowed).toBe(true);
    });

    it('should allow AI chat for TEAM tier', () => {
      const result = canAccessAIChat('TEAM');

      expect(result.allowed).toBe(true);
    });

    it('should deny AI chat for FREE tier', () => {
      const result = canAccessAIChat('FREE');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.upgradeRequired).toBe(true);
    });
  });

  describe('canSyncGarmin', () => {
    it('should allow sync for FREE tier within limits', () => {
      const result = canSyncGarmin('FREE', 3);

      expect(result.allowed).toBe(true);
      expect(result.currentLimit).toBe(5);
      expect(result.usage).toBe(3);
    });

    it('should deny sync for FREE tier at limit', () => {
      const result = canSyncGarmin('FREE', 5);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('monthly sync limit');
      expect(result.upgradeRequired).toBe(true);
    });

    it('should allow unlimited syncs for PREMIUM tier', () => {
      const result = canSyncGarmin('PREMIUM', 100);

      expect(result.allowed).toBe(true);
    });

    it('should allow unlimited syncs for TEAM tier', () => {
      const result = canSyncGarmin('TEAM', 200);

      expect(result.allowed).toBe(true);
    });
  });

  describe('canCreatePlan', () => {
    it('should allow plan creation within FREE tier limit', () => {
      const result = canCreatePlan('FREE', 0);

      expect(result.allowed).toBe(true);
      expect(result.currentLimit).toBe(1);
    });

    it('should deny plan creation at FREE tier limit', () => {
      const result = canCreatePlan('FREE', 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('plan limit');
      expect(result.upgradeRequired).toBe(true);
    });

    it('should allow unlimited plans for PREMIUM tier', () => {
      const result = canCreatePlan('PREMIUM', 10);

      expect(result.allowed).toBe(true);
    });

    it('should allow unlimited plans for TEAM tier', () => {
      const result = canCreatePlan('TEAM', 50);

      expect(result.allowed).toBe(true);
    });
  });

  describe('getAnalysisDaysLimit', () => {
    it('should return 7 days for FREE tier', () => {
      const limit = getAnalysisDaysLimit('FREE');

      expect(limit).toBe(7);
    });

    it('should return 90 days for PREMIUM tier', () => {
      const limit = getAnalysisDaysLimit('PREMIUM');

      expect(limit).toBe(90);
    });

    it('should return 365 days for TEAM tier', () => {
      const limit = getAnalysisDaysLimit('TEAM');

      expect(limit).toBe(365);
    });
  });

  describe('isSubscriptionActive', () => {
    it('should return true for ACTIVE status', () => {
      const active = isSubscriptionActive('ACTIVE');

      expect(active).toBe(true);
    });

    it('should return true for TRIALING status', () => {
      const active = isSubscriptionActive('TRIALING');

      expect(active).toBe(true);
    });

    it('should return false for CANCELED status', () => {
      const active = isSubscriptionActive('CANCELED');

      expect(active).toBe(false);
    });

    it('should return false for PAST_DUE status', () => {
      const active = isSubscriptionActive('PAST_DUE');

      expect(active).toBe(false);
    });
  });

  describe('getFeatureAvailability', () => {
    it('should return correct features for FREE tier', () => {
      const features = getFeatureAvailability('FREE');

      expect(features.tier).toBe('FREE');
      expect(features.tierName).toBe('Free');
      expect(features.limits.garminSyncsPerMonth).toBe(5);
      expect(features.limits.maxActivePlans).toBe(1);
      expect(features.limits.aiChatEnabled).toBe(false);
    });

    it('should return correct features for PREMIUM tier', () => {
      const features = getFeatureAvailability('PREMIUM');

      expect(features.tier).toBe('PREMIUM');
      expect(features.limits.garminSyncsPerMonth).toBe('Unlimited');
      expect(features.limits.maxActivePlans).toBe('Unlimited');
      expect(features.limits.aiChatEnabled).toBe(true);
    });

    it('should return correct features for TEAM tier', () => {
      const features = getFeatureAvailability('TEAM');

      expect(features.tier).toBe('TEAM');
      expect(features.limits.garminSyncsPerMonth).toBe('Unlimited');
      expect(features.limits.aiChatEnabled).toBe(true);
    });
  });

  describe('getUpgradeRecommendation', () => {
    it('should recommend no upgrade if feature already available', () => {
      const result = getUpgradeRecommendation('PREMIUM', 'aiChat');

      expect(result.needsUpgrade).toBe(false);
    });

    it('should recommend PREMIUM for AI chat from FREE', () => {
      const result = getUpgradeRecommendation('FREE', 'aiChat');

      expect(result.needsUpgrade).toBe(true);
      expect(result.recommendedTier).toBe('PREMIUM');
      expect(result.reason).toBeDefined();
    });

    it('should recommend TEAM for team management', () => {
      const result = getUpgradeRecommendation('PREMIUM', 'teamManagement');

      expect(result.needsUpgrade).toBe(true);
      expect(result.recommendedTier).toBe('TEAM');
      expect(result.reason).toContain('Team management');
    });

    it('should recommend PREMIUM for unlimited syncs from FREE', () => {
      const result = getUpgradeRecommendation('FREE', 'unlimitedSyncs');

      expect(result.needsUpgrade).toBe(true);
      expect(result.recommendedTier).toBe('PREMIUM');
    });
  });

  describe('formatUsageMessage', () => {
    it('should format usage message for FREE tier', () => {
      const message = formatUsageMessage('FREE', 3);

      expect(message).toContain('3 of 5');
      expect(message).toContain('2 remaining');
    });

    it('should show 0 remaining when at limit', () => {
      const message = formatUsageMessage('FREE', 5);

      expect(message).toContain('5 of 5');
      expect(message).toContain('0 remaining');
    });

    it('should show unlimited for PREMIUM tier', () => {
      const message = formatUsageMessage('PREMIUM', 100);

      expect(message).toBe('Unlimited syncs');
    });

    it('should show unlimited for TEAM tier', () => {
      const message = formatUsageMessage('TEAM', 500);

      expect(message).toBe('Unlimited syncs');
    });
  });
});
