'use client';

import { useState } from 'react';
import { WorkoutStructure } from '@/lib/calculations/workouts';

export default function WorkoutsPage() {
  const [sport, setSport] = useState('RUNNING');
  const [type, setType] = useState('EASY');
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [workout, setWorkout] = useState<WorkoutStructure | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/workouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, type, duration }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate workout');
      }

      const data = await response.json();
      setWorkout(data.structure);
    } catch (error) {
      console.error('Error generating workout:', error);
      alert('Failed to generate workout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Generate Workout
        </h1>
        <p className="text-gray-600">
          Create a personalized workout based on your preferences
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Workout Parameters</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sport
            </label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="RUNNING">Running</option>
              <option value="CYCLING">Cycling</option>
              <option value="SWIMMING">Swimming</option>
              <option value="TRIATHLON">Triathlon</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workout Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="EASY">Easy</option>
              <option value="TEMPO">Tempo</option>
              <option value="INTERVAL">Interval</option>
              <option value="LONG">Long</option>
              <option value="RECOVERY">Recovery</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration: {duration} minutes
            </label>
            <input
              type="range"
              min="10"
              max="180"
              step="5"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10 min</span>
              <span>90 min</span>
              <span>180 min</span>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Workout'}
          </button>
        </div>
      </div>

      {workout && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-2xl font-bold mb-2">{workout.name}</h2>
          <p className="text-gray-600 mb-4">{workout.description}</p>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-700">Total Duration</div>
              <div className="text-2xl font-bold text-blue-900">
                {workout.totalDuration} min
              </div>
            </div>
            {workout.estimatedDistance && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-700">Est. Distance</div>
                <div className="text-2xl font-bold text-green-900">
                  {workout.estimatedDistance.toFixed(1)} km
                </div>
              </div>
            )}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-700">Segments</div>
              <div className="text-2xl font-bold text-purple-900">
                {workout.segments.length}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Workout Structure</h3>
            {workout.segments.map((segment) => (
              <div
                key={segment.order}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">
                      {segment.order}. {segment.name}
                    </h4>
                    <p className="text-sm text-gray-600">{segment.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{segment.duration} min</div>
                    {segment.heartRateZone && (
                      <div className="text-sm text-gray-600">
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

          {workout.notes && workout.notes.length > 0 && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Training Notes</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {workout.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
