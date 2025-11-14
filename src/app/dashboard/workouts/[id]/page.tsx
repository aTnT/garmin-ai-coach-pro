'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  CheckCircle,
  Circle,
  ArrowLeft,
  Calendar,
  Clock,
  Activity,
  Trash2,
  Edit2,
} from 'lucide-react';
import { WorkoutStructure } from '@/lib/calculations/workouts';

interface Workout {
  id: string;
  date: string;
  sport: string;
  type: string;
  name: string;
  description?: string;
  duration: number;
  distance?: number;
  completed: boolean;
  completedAt?: string;
  notes?: string;
  structure?: WorkoutStructure;
  plan?: {
    id: string;
    name: string;
  };
}

export default function WorkoutDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workoutId = params.id as string;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchWorkout();
  }, [workoutId]);

  const fetchWorkout = async () => {
    try {
      const response = await fetch(`/api/workouts/${workoutId}`);
      if (response.ok) {
        const data = await response.json();
        setWorkout(data);
        setNotes(data.notes || '');
      } else {
        alert('Workout not found');
        router.push('/dashboard/workouts/history');
      }
    } catch (error) {
      console.error('Error fetching workout:', error);
      alert('Failed to load workout');
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async () => {
    if (!workout) return;

    try {
      const response = await fetch(`/api/workouts/${workoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !workout.completed }),
      });

      if (response.ok) {
        setWorkout({
          ...workout,
          completed: !workout.completed,
          completedAt: !workout.completed ? new Date().toISOString() : undefined,
        });
      }
    } catch (error) {
      console.error('Error updating workout:', error);
      alert('Failed to update workout');
    }
  };

  const saveNotes = async () => {
    if (!workout) return;

    try {
      const response = await fetch(`/api/workouts/${workoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (response.ok) {
        setWorkout({ ...workout, notes });
        setEditingNotes(false);
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    }
  };

  const deleteWorkout = async () => {
    if (!workout) return;

    if (!confirm('Are you sure you want to delete this workout?')) return;

    try {
      const response = await fetch(`/api/workouts/${workoutId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/dashboard/workouts/history');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete workout');
      }
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('Failed to delete workout');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Loading workout...</div>
      </div>
    );
  }

  if (!workout) {
    return null;
  }

  const workoutDate = new Date(workout.date);
  const isPastDue = workoutDate < new Date() && !workout.completed;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/workouts/history"
          className="text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{workout.name}</h1>
          <p className="text-gray-600 mt-1">
            {workout.description || 'Workout details and tracking'}
          </p>
        </div>
        <button
          onClick={toggleComplete}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition ${
            workout.completed
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {workout.completed ? (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Completed</span>
            </>
          ) : (
            <>
              <Circle className="w-5 h-5" />
              <span>Mark Complete</span>
            </>
          )}
        </button>
      </div>

      {/* Metadata Card */}
      <div
        className={`bg-white rounded-lg shadow p-6 border-2 ${
          workout.completed
            ? 'border-green-300'
            : isPastDue
            ? 'border-red-300'
            : 'border-gray-200'
        }`}
      >
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start space-x-3">
            <Calendar className="w-6 h-6 text-blue-600 mt-1" />
            <div>
              <div className="text-sm text-gray-600">Date</div>
              <div className="font-semibold text-gray-900">
                {format(workoutDate, 'EEEE, MMMM d, yyyy')}
              </div>
              {isPastDue && (
                <div className="text-xs text-red-600 mt-1">⚠ Past due</div>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Clock className="w-6 h-6 text-purple-600 mt-1" />
            <div>
              <div className="text-sm text-gray-600">Duration</div>
              <div className="font-semibold text-gray-900">
                {workout.duration} minutes
              </div>
              {workout.distance && (
                <div className="text-sm text-gray-600 mt-1">
                  {workout.distance.toFixed(1)} km
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Activity className="w-6 h-6 text-green-600 mt-1" />
            <div>
              <div className="text-sm text-gray-600">Sport & Type</div>
              <div className="font-semibold text-gray-900">{workout.sport}</div>
              <div className="text-sm text-gray-600 mt-1">{workout.type}</div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <CheckCircle className="w-6 h-6 text-gray-600 mt-1" />
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <div className="font-semibold text-gray-900">
                {workout.completed ? 'Completed' : 'Pending'}
              </div>
              {workout.completedAt && (
                <div className="text-sm text-green-600 mt-1">
                  {format(new Date(workout.completedAt), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          </div>
        </div>

        {workout.plan && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-600 mb-2">Part of Training Plan:</div>
            <Link
              href={`/dashboard/plans/${workout.plan.id}`}
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold"
            >
              {workout.plan.name} →
            </Link>
          </div>
        )}
      </div>

      {/* Workout Structure */}
      {workout.structure && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Workout Structure</h2>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-700">Total Duration</div>
              <div className="text-2xl font-bold text-blue-900">
                {workout.structure.totalDuration} min
              </div>
            </div>
            {workout.structure.estimatedDistance && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-700">Est. Distance</div>
                <div className="text-2xl font-bold text-green-900">
                  {workout.structure.estimatedDistance.toFixed(1)} km
                </div>
              </div>
            )}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-700">Segments</div>
              <div className="text-2xl font-bold text-purple-900">
                {workout.structure.segments.length}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {workout.structure.segments.map((segment) => (
              <div
                key={segment.order}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {segment.order}. {segment.name}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {segment.description}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-semibold text-gray-900">
                      {segment.duration} min
                    </div>
                    {segment.heartRateZone && (
                      <div className="text-sm text-gray-600 mt-1">
                        Zone {segment.heartRateZone}
                      </div>
                    )}
                  </div>
                </div>
                {segment.paceGuidance && (
                  <p className="text-sm text-blue-700 mt-2">
                    <strong>Pace:</strong> {segment.paceGuidance}
                  </p>
                )}
              </div>
            ))}
          </div>

          {workout.structure.notes && workout.structure.notes.length > 0 && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">
                Training Notes
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {workout.structure.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Personal Notes */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Personal Notes</h2>
          {!editingNotes ? (
            <button
              onClick={() => setEditingNotes(true)}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-semibold text-sm"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={saveNotes}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingNotes(false);
                  setNotes(workout.notes || '');
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {editingNotes ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about how this workout went..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px]"
          />
        ) : (
          <div className="text-gray-700">
            {workout.notes ? (
              <p className="whitespace-pre-wrap">{workout.notes}</p>
            ) : (
              <p className="text-gray-400 italic">
                No notes yet. Click "Edit" to add notes about this workout.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {!workout.plan && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            Delete Workout
          </h3>
          <p className="text-sm text-red-700 mb-4">
            This will permanently delete this workout. This action cannot be undone.
          </p>
          <button
            onClick={deleteWorkout}
            className="flex items-center space-x-2 bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Workout</span>
          </button>
        </div>
      )}
    </div>
  );
}
