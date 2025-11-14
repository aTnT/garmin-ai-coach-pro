'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Activity, Heart, Zap, Moon } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [activeChartTab, setActiveChartTab] = useState<'hrv' | 'load' | 'acwr' | 'readiness'>('hrv');

  useEffect(() => {
    async function fetchData() {
      try {
        const [readinessRes, metricsRes, chartsRes] = await Promise.all([
          fetch('/api/readiness'),
          fetch('/api/metrics?days=30'),
          fetch('/api/metrics/charts?days=30'),
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
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

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
            Upload your training data to see your readiness score and personalized insights.
          </p>
          <Link
            href="/dashboard/upload"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Upload Data
          </Link>
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
