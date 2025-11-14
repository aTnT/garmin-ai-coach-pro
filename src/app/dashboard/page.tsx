'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { format, isToday, isTomorrow } from 'date-fns';
import { Activity, Heart, Zap, Moon, Calendar, Clock, ArrowRight } from 'lucide-react';
import ReadinessCard from '@/components/ReadinessCard';
import MetricCard from '@/components/MetricCard';
import HRVTrendChart from '@/components/charts/HRVTrendChart';
import TrainingLoadChart from '@/components/charts/TrainingLoadChart';
import ACWRChart from '@/components/charts/ACWRChart';
import ReadinessScoreTrend from '@/components/charts/ReadinessScoreTrend';
import { ReadinessScore } from '@/lib/calculations/readiness';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [todaysWorkout, setTodaysWorkout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeChartTab, setActiveChartTab] = useState<'hrv' | 'load' | 'acwr' | 'readiness'>('hrv');
  const [loadingSampleData, setLoadingSampleData] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [readinessRes, metricsRes, chartsRes, workoutsRes] = await Promise.all([
          fetch('/api/readiness'),
          fetch('/api/metrics?days=30'),
          fetch('/api/metrics/charts?days=30'),
          fetch('/api/workouts'),
        ]);

        if (readinessRes.ok) {
          const readinessData = await readinessRes.json();
          setReadiness(readinessData);
        }

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        }

        if (chartsRes.ok) {
          const charts = await chartsRes.json();
          setChartData(charts);
        }

        if (workoutsRes.ok) {
          const workoutsData = await workoutsRes.json();
          // Find today's workout or next upcoming workout
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const upcomingWorkouts = workoutsData.workouts
            .filter((w: any) => !w.completed)
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Try to find today's workout first
          const todayWorkout = upcomingWorkouts.find((w: any) => {
            const workoutDate = new Date(w.date);
            workoutDate.setHours(0, 0, 0, 0);
            return workoutDate.getTime() === today.getTime();
          });

          // If no workout today, get the next upcoming one
          setTodaysWorkout(todayWorkout || upcomingWorkouts[0] || null);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleLoadSampleData = async () => {
    setLoadingSampleData(true);
    try {
      const response = await fetch('/api/seed', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load sample data');
      }

      const data = await response.json();
      alert(data.message);

      // Reload page to show new data
      window.location.reload();
    } catch (error: any) {
      alert(error.message || 'Failed to load sample data');
    } finally {
      setLoadingSampleData(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {session?.user?.name || session?.user?.email}!
        </h1>
        <p className="text-gray-600">
          Here's your training overview for today
        </p>
      </div>

      {readiness ? (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <ReadinessCard readiness={readiness} />
          </div>

          <div className="space-y-4">
            <MetricCard
              title="Latest HRV"
              value={metrics?.latest?.HRV?.value?.toFixed(0) || 'N/A'}
              unit="ms"
              icon={<Heart className="w-6 h-6" />}
            />
            <MetricCard
              title="Training Load"
              value={metrics?.latest?.TRAINING_LOAD?.value?.toFixed(0) || 'N/A'}
              icon={<Activity className="w-6 h-6" />}
            />
            <MetricCard
              title="VO2 Max"
              value={metrics?.latest?.VO2MAX?.value?.toFixed(0) || 'N/A'}
              unit="ml/kg/min"
              icon={<Zap className="w-6 h-6" />}
            />
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">No Training Data Yet</h2>
          <p className="text-gray-700 mb-4">
            Upload your training data or load sample data to see your readiness score and personalized insights.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={handleLoadSampleData}
              disabled={loadingSampleData}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSampleData ? 'Loading...' : 'Load Sample Data'}
            </button>
            <Link
              href="/dashboard/upload"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Upload Your Data
            </Link>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Sample data includes 60 days of realistic training metrics (HRV, training load, sleep, etc.) and 40+ workouts
          </p>
        </div>
      )}

      {/* Today's Workout */}
      {todaysWorkout && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-lg p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {isToday(new Date(todaysWorkout.date))
                ? "Today's Workout"
                : isTomorrow(new Date(todaysWorkout.date))
                ? "Tomorrow's Workout"
                : 'Next Workout'}
            </h2>
            <Link
              href={`/dashboard/workouts/${todaysWorkout.id}`}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <span>View Details</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-white rounded-lg p-5 shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {todaysWorkout.name}
            </h3>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  todaysWorkout.type === 'EASY' || todaysWorkout.type === 'RECOVERY'
                    ? 'bg-green-100 text-green-800'
                    : todaysWorkout.type === 'TEMPO'
                    ? 'bg-yellow-100 text-yellow-800'
                    : todaysWorkout.type === 'INTERVAL'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {todaysWorkout.type}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                {todaysWorkout.sport}
              </span>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Date</div>
                  <div className="font-semibold text-gray-900">
                    {isToday(new Date(todaysWorkout.date))
                      ? 'Today'
                      : isTomorrow(new Date(todaysWorkout.date))
                      ? 'Tomorrow'
                      : format(new Date(todaysWorkout.date), 'MMM d')}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
                <Clock className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="text-xs text-gray-600">Duration</div>
                  <div className="font-semibold text-gray-900">
                    {todaysWorkout.duration} min
                  </div>
                </div>
              </div>

              {todaysWorkout.distance && (
                <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
                  <Activity className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-xs text-gray-600">Distance</div>
                    <div className="font-semibold text-gray-900">
                      {todaysWorkout.distance.toFixed(1)} km
                    </div>
                  </div>
                </div>
              )}
            </div>

            {todaysWorkout.plan && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Part of:{' '}
                  <Link
                    href={`/dashboard/plans/${todaysWorkout.plan.id}`}
                    className="text-blue-600 hover:text-blue-700 font-semibold underline"
                  >
                    {todaysWorkout.plan.name}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts Section */}
      {chartData && (chartData.hrv.data.length > 0 || chartData.trainingLoad.data.length > 0 || chartData.readiness.data.length > 0) && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-xl font-semibold mb-4">Training Trends</h3>

          {/* Tab Navigation */}
          <div className="flex space-x-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveChartTab('hrv')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                activeChartTab === 'hrv'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              HRV Trend
            </button>
            <button
              onClick={() => setActiveChartTab('load')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                activeChartTab === 'load'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Training Load
            </button>
            <button
              onClick={() => setActiveChartTab('acwr')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                activeChartTab === 'acwr'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              ACWR
            </button>
            <button
              onClick={() => setActiveChartTab('readiness')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                activeChartTab === 'readiness'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Readiness History
            </button>
          </div>

          {/* Chart Display */}
          <div>
            {activeChartTab === 'hrv' && (
              <HRVTrendChart
                data={chartData.hrv.data}
                average={chartData.hrv.average}
              />
            )}
            {activeChartTab === 'load' && (
              <TrainingLoadChart data={chartData.trainingLoad.data} />
            )}
            {activeChartTab === 'acwr' && (
              <ACWRChart data={chartData.trainingLoad.data} />
            )}
            {activeChartTab === 'readiness' && (
              <ReadinessScoreTrend data={chartData.readiness.data} />
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              href="/dashboard/plans/new"
              className="block bg-purple-50 hover:bg-purple-100 p-4 rounded-lg transition"
            >
              <div className="font-semibold text-purple-900">Create Training Plan</div>
              <div className="text-sm text-purple-700">
                Generate a periodized multi-week training plan
              </div>
            </Link>
            <Link
              href="/dashboard/workouts"
              className="block bg-blue-50 hover:bg-blue-100 p-4 rounded-lg transition"
            >
              <div className="font-semibold text-blue-900">Generate Workout</div>
              <div className="text-sm text-blue-700">
                Create a personalized workout for today
              </div>
            </Link>
            <Link
              href="/dashboard/upload"
              className="block bg-green-50 hover:bg-green-100 p-4 rounded-lg transition"
            >
              <div className="font-semibold text-green-900">Upload Data</div>
              <div className="text-sm text-green-700">
                Import your training metrics from CSV
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-xl font-semibold mb-4">Recent Metrics</h3>
          {metrics?.all && metrics.all.length > 0 ? (
            <div className="space-y-2">
              {metrics.all.slice(0, 5).map((metric: any) => (
                <div
                  key={metric.id}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-600">
                    {metric.type.replace('_', ' ')}
                  </span>
                  <span className="font-semibold">
                    {metric.value.toFixed(1)} {metric.unit || ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No metrics available yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
