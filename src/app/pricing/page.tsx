'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Zap, Users, ArrowRight } from 'lucide-react';

const tiers = [
  {
    name: 'Free',
    tier: 'FREE',
    price: 0,
    description: 'Perfect for getting started with AI-powered training',
    features: [
      '7-day training data analysis',
      '5 Garmin syncs per month',
      '1 active training plan',
      'Basic readiness scoring',
      'CSV data upload',
      'Limited chart analytics',
    ],
    limitations: [
      'No AI coaching chat',
      'Limited historical data',
    ],
    cta: 'Current Plan',
    highlighted: false,
  },
  {
    name: 'Premium',
    tier: 'PREMIUM',
    price: 19,
    description: 'Unlock unlimited features and AI coaching',
    features: [
      'Everything in Free',
      '30-day training data analysis',
      'Unlimited Garmin syncs',
      'Unlimited training plans',
      'Unlimited AI coaching chat',
      'Advanced analytics & charts',
      'Priority support',
    ],
    cta: 'Upgrade to Premium',
    highlighted: true,
    icon: Zap,
  },
  {
    name: 'Team',
    tier: 'TEAM',
    price: 49,
    description: 'For coaches managing multiple athletes',
    features: [
      'Everything in Premium',
      'Team management (coach/athlete)',
      'Up to 10 athletes per coach',
      'Shared training plans',
      'Team analytics dashboard',
      'Bulk data export',
      'Dedicated support',
    ],
    cta: 'Upgrade to Team',
    highlighted: false,
    icon: Users,
  },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>('FREE');

  const canceled = searchParams.get('canceled');

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCurrentTier();
    }
  }, [status]);

  const fetchCurrentTier = async () => {
    try {
      const response = await fetch('/api/subscription');
      if (response.ok) {
        const data = await response.json();
        setCurrentTier(data.subscription.tier);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (!session) {
      router.push('/auth/login?callbackUrl=/pricing');
      return;
    }

    if (tier === 'FREE') {
      return;
    }

    setLoading(tier);

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      alert(error.message || 'Failed to initiate checkout');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Training Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get personalized AI-powered coaching and insights to take your endurance training to the next level
          </p>
          {canceled && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-800 text-sm">
                Checkout canceled. Feel free to try again when you're ready!
              </p>
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tierData) => {
            const Icon = tierData.icon;
            const isCurrentTier = currentTier === tierData.tier;

            return (
              <div
                key={tierData.tier}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-transform hover:scale-105 ${
                  tierData.highlighted
                    ? 'border-2 border-blue-600 ring-4 ring-blue-100'
                    : 'border border-gray-200'
                }`}
              >
                {tierData.highlighted && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                    Most Popular
                  </div>
                )}

                <div className="p-8">
                  {/* Tier Header */}
                  <div className="flex items-center space-x-2 mb-4">
                    {Icon && <Icon className="w-6 h-6 text-blue-600" />}
                    <h3 className="text-2xl font-bold text-gray-900">
                      {tierData.name}
                    </h3>
                  </div>

                  <p className="text-gray-600 text-sm mb-6">
                    {tierData.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className="text-5xl font-bold text-gray-900">
                        ${tierData.price}
                      </span>
                      {tierData.price > 0 && (
                        <span className="text-gray-600 ml-2">/month</span>
                      )}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleUpgrade(tierData.tier)}
                    disabled={
                      loading !== null ||
                      isCurrentTier ||
                      tierData.tier === 'FREE'
                    }
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition flex items-center justify-center space-x-2 ${
                      tierData.highlighted
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : isCurrentTier
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : tierData.tier === 'FREE'
                        ? 'bg-gray-100 text-gray-700 cursor-not-allowed'
                        : 'bg-gray-800 text-white hover:bg-gray-900'
                    } disabled:opacity-50`}
                  >
                    {loading === tierData.tier ? (
                      <span>Loading...</span>
                    ) : isCurrentTier ? (
                      <span>Current Plan</span>
                    ) : (
                      <>
                        <span>{tierData.cta}</span>
                        {tierData.tier !== 'FREE' && (
                          <ArrowRight className="w-4 h-4" />
                        )}
                      </>
                    )}
                  </button>

                  {/* Features List */}
                  <ul className="mt-8 space-y-4">
                    {tierData.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                    {tierData.limitations?.map((limitation) => (
                      <li
                        key={limitation}
                        className="flex items-start text-gray-400"
                      >
                        <span className="mr-3 mt-0.5">×</span>
                        <span className="text-sm line-through">{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I cancel my subscription anytime?
              </h3>
              <p className="text-gray-600">
                Yes! You can cancel your subscription at any time. Your access will continue until the end of your current billing period.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards through our secure Stripe payment processor.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I upgrade or downgrade my plan?
              </h3>
              <p className="text-gray-600">
                Yes! You can change your plan at any time from your account settings. Changes are prorated automatically.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600">
                We offer a 14-day money-back guarantee for all paid subscriptions. Contact support if you're not satisfied.
              </p>
            </div>
          </div>
        </div>

        {/* Back to Dashboard */}
        {session && (
          <div className="mt-16 text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              ← Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
