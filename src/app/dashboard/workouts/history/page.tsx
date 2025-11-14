'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { CheckCircle, Circle, Calendar, Filter, Trash2 } from 'lucide-react';

interface Workout {
  id: string;
  date: string;
  sport: string;
  type: string;
  name: string;
  duration: number;
  distance?: number;
  completed: boolean;
  completedAt?: string;
  plan?: {
    id: string;
    name: string;
  };
}

export default function WorkoutHistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'upcoming'>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await fetch('/api/workouts');
      if (response.ok) {
        const data = await response.json();
        setWorkouts(data.workouts);
      }
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async (workoutId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/workouts/${workoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentStatus }),
      });

      if (response.ok) {
        // Update local state
        setWorkouts(
          workouts.map((w) =>
            w.id === workoutId
              ? {
                  ...w,
                  completed: !currentStatus,
                  completedAt: !currentStatus ? new Date().toISOString() : undefined,
                }
              : w
          )
        );
      }
    } catch (error) {
      console.error('Error updating workout:', error);
    }
  };

  const deleteWorkout = async (workoutId: string) => {
    if (!confirm('Are you sure you want to delete this workout?')) return;

    try {
      const response = await fetch(`/api/workouts/${workoutId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWorkouts(workouts.filter((w) => w.id !== workoutId));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete workout');
      }
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('Failed to delete workout');
    }
  };

  const filteredWorkouts = workouts.filter((w) => {
    const now = new Date();
    const workoutDate = new Date(w.date);

    if (filter === 'completed' && !w.completed) return false;
    if (filter === 'upcoming' && (w.completed || workoutDate < now)) return false;
    if (sportFilter !== 'all' && w.sport !== sportFilter) return false;

    return true;
  });

  const sports = Array.from(new Set(workouts.map((w) => w.sport)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Loading workouts...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Workout History
          </h1>
          <p className="text-gray-600">
            View and manage all your workouts
          </p>
        </div>
        <Link
          href="/dashboard/workouts"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Generate Workout
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({workouts.length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completed ({workouts.filter((w) => w.completed).length})
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'upcoming'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Upcoming (
              {
                workouts.filter(
                  (w) => !w.completed && new Date(w.date) >= new Date()
                ).length
              }
              )
            </button>
          </div>

          <div className="flex-1"></div>

          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sports</option>
            {sports.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Workouts List */}
      {filteredWorkouts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No workouts found
          </h3>
          <p className="text-gray-600 mb-4">
            {filter === 'all'
              ? 'Generate your first workout or create a training plan'
              : `No ${filter} workouts found`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkouts.map((workout) => (
            <div
              key={workout.id}
              className={`bg-white rounded-lg shadow p-4 border-2 transition ${
                workout.completed
                  ? 'border-green-300'
                  : new Date(workout.date) < new Date()
                  ? 'border-red-200'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  {/* Completion Checkbox */}
                  <button
                    onClick={() => toggleComplete(workout.id, workout.completed)}
                    className="mt-1 focus:outline-none"
                  >
                    {workout.completed ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>

                  {/* Workout Details */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {workout.name}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          workout.type === 'EASY' || workout.type === 'RECOVERY'
                            ? 'bg-green-100 text-green-800'
                            : workout.type === 'TEMPO'
                            ? 'bg-yellow-100 text-yellow-800'
                            : workout.type === 'INTERVAL'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {workout.type}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                        {workout.sport}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                      <span>
                        📅 {format(new Date(workout.date), 'EEE, MMM d, yyyy')}
                      </span>
                      <span>⏱️ {workout.duration} min</span>
                      {workout.distance && (
                        <span>📍 {workout.distance.toFixed(1)} km</span>
                      )}
                    </div>

                    {workout.plan && (
                      <div className="text-sm text-blue-600">
                        Part of:{' '}
                        <Link
                          href={`/dashboard/plans/${workout.plan.id}`}
                          className="underline hover:text-blue-700"
                        >
                          {workout.plan.name}
                        </Link>
                      </div>
                    )}

                    {workout.completed && workout.completedAt && (
                      <div className="text-sm text-green-600 mt-1">
                        ✓ Completed on{' '}
                        {format(new Date(workout.completedAt), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <Link
                    href={`/dashboard/workouts/${workout.id}`}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
                  >
                    View
                  </Link>
                  {!workout.plan && (
                    <button
                      onClick={() => deleteWorkout(workout.id)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
