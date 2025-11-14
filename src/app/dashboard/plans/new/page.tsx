'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [sport, setSport] = useState('RUNNING');
  const [raceDate, setRaceDate] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [hoursPerWeek, setHoursPerWeek] = useState(6);
  const [goal, setGoal] = useState('improve');
  const [raceDistance, setRaceDistance] = useState('');
  const [planName, setPlanName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate race date is in the future
      const raceDateObj = new Date(raceDate);
      if (raceDateObj <= new Date()) {
        setError('Race date must be in the future');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport,
          raceDate: raceDateObj.toISOString(),
          currentFitnessLevel: fitnessLevel,
          daysPerWeek,
          hoursPerWeek,
          goal,
          raceDistance: raceDistance ? parseFloat(raceDistance) : undefined,
          name: planName || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate plan');
      }

      const data = await response.json();
      router.push(`/dashboard/plans/${data.plan.id}`);
    } catch (error: any) {
      console.error('Error generating plan:', error);
      setError(error.message || 'Failed to generate training plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link
          href="/dashboard/plans"
          className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Plans</span>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create Training Plan
        </h1>
        <p className="text-gray-600">
          Generate a periodized training plan based on your goals
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200 space-y-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plan Name (Optional)
            </label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g., Spring Marathon 2024"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sport
            </label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="RUNNING">Running</option>
              <option value="CYCLING">Cycling</option>
              <option value="SWIMMING">Swimming</option>
              <option value="TRIATHLON">Triathlon</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Race Date *
              </label>
              <input
                type="date"
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Race Distance (km)
              </label>
              <input
                type="number"
                value={raceDistance}
                onChange={(e) => setRaceDistance(e.target.value)}
                placeholder="e.g., 42.2 for marathon"
                step="0.1"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                5K, 10K, Half (21.1), Marathon (42.2), etc.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Fitness Level
            </label>
            <select
              value={fitnessLevel}
              onChange={(e) => setFitnessLevel(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="beginner">Beginner (New to the sport)</option>
              <option value="intermediate">
                Intermediate (Regular training)
              </option>
              <option value="advanced">Advanced (Competitive athlete)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Goal
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="finish">Finish the race</option>
              <option value="improve">Improve my time</option>
              <option value="compete">Compete for placement</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200 space-y-6">
          <h2 className="text-xl font-semibold mb-4">Training Commitment</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Training Days per Week: {daysPerWeek}
            </label>
            <input
              type="range"
              min="3"
              max="7"
              step="1"
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>3 days</span>
              <span>5 days</span>
              <span>7 days</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hours per Week: {hoursPerWeek}
            </label>
            <input
              type="range"
              min="2"
              max="20"
              step="1"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>2 hours</span>
              <span>11 hours</span>
              <span>20 hours</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">
              Your Training Commitment
            </h4>
            <p className="text-sm text-blue-700">
              {daysPerWeek} workouts per week, averaging{' '}
              {Math.round((hoursPerWeek * 60) / daysPerWeek)} minutes per session
            </p>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating Plan...' : 'Generate Training Plan'}
          </button>
          <Link
            href="/dashboard/plans"
            className="px-6 py-3 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2">
            How Plan Generation Works
          </h4>
          <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
            <li>
              <strong>Base Phase</strong>: Build aerobic foundation with easy
              runs
            </li>
            <li>
              <strong>Build Phase</strong>: Add tempo and interval workouts
            </li>
            <li>
              <strong>Peak Phase</strong>: Race-specific training at goal pace
            </li>
            <li>
              <strong>Taper Phase</strong>: Reduce volume to arrive fresh
            </li>
            <li>Recovery weeks every 4 weeks to absorb training</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
