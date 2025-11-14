'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Download, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Workout {
  id: string;
  date: string;
  type: string;
  name: string;
  duration: number;
  distance?: number;
  completed: boolean;
  structure: any;
}

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
  planData: any;
  workouts: Workout[];
}

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'calendar' | 'weekly'>('weekly');

  useEffect(() => {
    if (params.id) {
      fetchPlan(params.id as string);
    }
  }, [params.id]);

  const fetchPlan = async (planId: string) => {
    try {
      const response = await fetch(`/api/plans/${planId}`);
      if (response.ok) {
        const data = await response.json();
        setPlan(data.plan);
      } else {
        router.push('/dashboard/plans');
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!plan) return;

    const csv = [
      'Date,Type,Name,Duration (min),Distance (km),Completed',
      ...plan.workouts.map((w) =>
        [
          format(new Date(w.date), 'yyyy-MM-dd'),
          w.type,
          `"${w.name}"`,
          w.duration,
          w.distance?.toFixed(1) || '',
          w.completed ? 'Yes' : 'No',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-plan-${plan.name.replace(/\s+/g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const groupWorkoutsByWeek = () => {
    if (!plan?.planData?.weeks) return [];
    return plan.planData.weeks;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Loading plan...</div>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  const weeks = groupWorkoutsByWeek();
  const completedWorkouts = plan.workouts.filter((w) => w.completed).length;
  const progressPercentage = Math.round(
    (completedWorkouts / plan.workouts.length) * 100
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <Link
          href="/dashboard/plans"
          className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Plans</span>
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {plan.name}
            </h1>
            <p className="text-gray-600">{plan.description}</p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Plan Summary */}
      <div className="grid md:grid-cols-5 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-sm text-blue-700">Sport</div>
          <div className="text-2xl font-bold text-blue-900">{plan.sport}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-sm text-green-700">Duration</div>
          <div className="text-2xl font-bold text-green-900">
            {plan.weeks} weeks
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-sm text-purple-700">Workouts</div>
          <div className="text-2xl font-bold text-purple-900">
            {plan.workouts.length}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-sm text-orange-700">Progress</div>
          <div className="text-2xl font-bold text-orange-900">
            {progressPercentage}%
          </div>
        </div>
        <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
          <div className="text-sm text-pink-700">Race Date</div>
          <div className="text-lg font-bold text-pink-900">
            {format(new Date(plan.endDate), 'MMM d, yyyy')}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Plan Progress</h3>
          <span className="text-sm text-gray-600">
            {completedWorkouts} of {plan.workouts.length} workouts completed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-green-600 h-4 rounded-full transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2">
        <button
          onClick={() => setSelectedView('weekly')}
          className={`px-4 py-2 rounded-lg font-semibold transition ${
            selectedView === 'weekly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Weekly View
        </button>
        <button
          onClick={() => setSelectedView('calendar')}
          className={`px-4 py-2 rounded-lg font-semibold transition ${
            selectedView === 'calendar'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Calendar View
        </button>
      </div>

      {/* Weekly View */}
      {selectedView === 'weekly' && (
        <div className="space-y-6">
          {weeks.map((week: any) => (
            <div
              key={week.weekNumber}
              className="bg-white rounded-lg shadow p-6 border border-gray-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    Week {week.weekNumber}: {week.focus}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {format(new Date(week.startDate), 'MMM d')} -{' '}
                    {format(
                      new Date(
                        new Date(week.startDate).getTime() + 6 * 24 * 60 * 60 * 1000
                      ),
                      'MMM d, yyyy'
                    )}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      week.phase === 'base'
                        ? 'bg-blue-100 text-blue-800'
                        : week.phase === 'build'
                        ? 'bg-green-100 text-green-800'
                        : week.phase === 'peak'
                        ? 'bg-orange-100 text-orange-800'
                        : week.phase === 'taper'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {week.phase.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-600">
                    Volume: {week.volume}%
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {week.workouts.map((workout: any, idx: number) => {
                  const workoutFromDB = plan.workouts.find(
                    (w) =>
                      new Date(w.date).toDateString() ===
                      new Date(workout.date).toDateString()
                  );

                  return (
                    <div
                      key={idx}
                      className={`border-2 rounded-lg p-4 ${
                        workoutFromDB?.completed
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-xs text-gray-600">
                          {format(new Date(workout.date), 'EEE, MMM d')}
                        </div>
                        {workoutFromDB?.completed && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <h4 className="font-semibold mb-1">{workout.name}</h4>
                      <div className="text-sm text-gray-700 mb-2">
                        {workout.duration} min
                        {workout.distance &&
                          ` • ${workout.distance.toFixed(1)} km`}
                      </div>
                      <p className="text-xs text-gray-600">
                        {workout.description}
                      </p>
                      <div className="mt-2">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            workout.intensity === 'low'
                              ? 'bg-green-100 text-green-800'
                              : workout.intensity === 'moderate'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {workout.intensity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calendar View */}
      {selectedView === 'calendar' && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-xl font-semibold mb-4">Full Plan Calendar</h3>
          <div className="space-y-2">
            {plan.workouts.map((workout) => (
              <div
                key={workout.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  workout.completed
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-sm font-semibold text-gray-700 w-32">
                    {format(new Date(workout.date), 'EEE, MMM d')}
                  </div>
                  <div>
                    <div className="font-semibold">{workout.name}</div>
                    <div className="text-sm text-gray-600">
                      {workout.duration} min
                      {workout.distance && ` • ${workout.distance.toFixed(1)} km`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      workout.type === 'EASY' || workout.type === 'RECOVERY'
                        ? 'bg-green-100 text-green-800'
                        : workout.type === 'TEMPO'
                        ? 'bg-yellow-100 text-yellow-800'
                        : workout.type === 'INTERVAL'
                        ? 'bg-red-100 text-red-800'
                        : workout.type === 'LONG'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {workout.type}
                  </span>
                  {workout.completed && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
