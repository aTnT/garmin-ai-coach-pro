'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Plus, Trash2, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  description: string;
  sport: string;
  goal: string;
  startDate: string;
  endDate: string;
  weeks: number;
  status: string;
  createdAt: string;
  _count: {
    workouts: number;
  };
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const response = await fetch(`/api/plans/${planId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPlans(plans.filter((p) => p.id !== planId));
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete plan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Loading training plans...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Training Plans
          </h1>
          <p className="text-gray-600">
            Manage your periodized training plans
          </p>
        </div>
        <Link
          href="/dashboard/plans/new"
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span>Create Plan</span>
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <Calendar className="w-16 h-16 mx-auto text-yellow-600 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Training Plans Yet</h2>
          <p className="text-gray-700 mb-4">
            Create your first periodized training plan to reach your goals
          </p>
          <Link
            href="/dashboard/plans/new"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Create Your First Plan
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-lg shadow border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {plan.name}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        plan.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : plan.status === 'COMPLETED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4">{plan.description}</p>

                  <div className="grid md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-blue-700">Sport</div>
                      <div className="font-semibold text-blue-900">
                        {plan.sport}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs text-green-700">Duration</div>
                      <div className="font-semibold text-green-900">
                        {plan.weeks} weeks
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-xs text-purple-700">Workouts</div>
                      <div className="font-semibold text-purple-900">
                        {plan._count.workouts}
                      </div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <div className="text-xs text-orange-700">Race Date</div>
                      <div className="font-semibold text-orange-900 text-sm">
                        {formatDate(plan.endDate)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <Link
                    href={`/dashboard/plans/${plan.id}`}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg font-semibold transition text-sm"
                  >
                    View Plan
                  </Link>
                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
