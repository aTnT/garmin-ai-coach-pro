'use client';

import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Eye, FileText } from 'lucide-react';
import Papa from 'papaparse';
import {
  detectCSVType,
  mapRowToMetric,
  mapRowToWorkout,
  validateMetrics,
  validateWorkouts,
  MappedMetric,
  MappedWorkout,
} from '@/lib/csv-mapper';

type ImportData = {
  type: 'metrics' | 'workouts';
  metrics?: MappedMetric[];
  workouts?: MappedWorkout[];
  errors: string[];
};

export default function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [previewData, setPreviewData] = useState<ImportData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage('');
    setMessageType('');
    setPreviewData(null);
    setShowPreview(false);

    try {
      const text = await file.text();

      Papa.parse(text, {
        header: true,
        complete: (results) => {
          try {
            const headers = Object.keys(results.data[0] || {});
            const csvType = detectCSVType(headers);

            if (csvType === 'unknown') {
              setMessage('Could not detect CSV format. Please check column names.');
              setMessageType('error');
              setUploading(false);
              return;
            }

            let importData: ImportData = {
              type: csvType,
              errors: [],
            };

            if (csvType === 'metrics') {
              // Map and validate metrics
              const mappedMetrics = results.data
                .map((row: any) => mapRowToMetric(row))
                .filter((m): m is MappedMetric => m !== null);

              const { valid, errors } = validateMetrics(mappedMetrics);
              importData.metrics = valid;
              importData.errors = errors;
            } else {
              // Map and validate workouts
              const mappedWorkouts = results.data
                .map((row: any) => mapRowToWorkout(row))
                .filter((w): w is MappedWorkout => w !== null);

              const { valid, errors } = validateWorkouts(mappedWorkouts);
              importData.workouts = valid;
              importData.errors = errors;
            }

            if (importData.metrics?.length === 0 && importData.workouts?.length === 0) {
              setMessage('No valid data found in CSV file');
              setMessageType('error');
              setUploading(false);
              return;
            }

            setPreviewData(importData);
            setShowPreview(true);
            setMessage(
              `Found ${importData.metrics?.length || importData.workouts?.length} valid ${csvType} records. Review and confirm import.`
            );
            setMessageType('success');
            setUploading(false);

            // Clear file input
            event.target.value = '';
          } catch (error) {
            console.error('Error processing CSV:', error);
            setMessage('Failed to process CSV file. Please check the format.');
            setMessageType('error');
            setUploading(false);
          }
        },
        error: (error: Error) => {
          console.error('CSV parse error:', error);
          setMessage('Failed to parse CSV file');
          setMessageType('error');
          setUploading(false);
        },
      });
    } catch (error) {
      console.error('File read error:', error);
      setMessage('Failed to read file');
      setMessageType('error');
      setUploading(false);
    }
  };

  const confirmImport = async () => {
    if (!previewData) return;

    setUploading(true);

    try {
      const payload: any = {};
      if (previewData.metrics) payload.metrics = previewData.metrics;
      if (previewData.workouts) payload.workouts = previewData.workouts;

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      setMessage(data.message);
      setMessageType('success');
      setPreviewData(null);
      setShowPreview(false);
    } catch (error: any) {
      console.error('Upload error:', error);
      setMessage(error.message || 'Failed to upload data');
      setMessageType('error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Upload Training Data
        </h1>
        <p className="text-gray-600">
          Import your training metrics and workouts from CSV files
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">CSV File Upload</h2>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />

          <label className="block">
            <span className="sr-only">Choose CSV file</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>

          {uploading && !showPreview && (
            <p className="mt-4 text-blue-600">Processing file...</p>
          )}

          {message && (
            <div
              className={`mt-4 p-4 rounded-lg flex items-center justify-center space-x-2 ${
                messageType === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {messageType === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span>{message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Preview Section */}
      {showPreview && previewData && (
        <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Eye className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold">Preview & Confirm Import</h2>
            </div>
            <div className="text-sm font-semibold text-blue-600 uppercase">
              {previewData.type}
            </div>
          </div>

          {/* Errors */}
          {previewData.errors.length > 0 && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-700" />
                <h3 className="font-semibold text-yellow-900">
                  {previewData.errors.length} rows skipped due to errors:
                </h3>
              </div>
              <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1 max-h-40 overflow-y-auto">
                {previewData.errors.slice(0, 10).map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
                {previewData.errors.length > 10 && (
                  <li className="font-semibold">
                    ... and {previewData.errors.length - 10} more errors
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          <div className="mb-6 bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
            <h3 className="font-semibold mb-3">
              Preview (first 10 of {previewData.metrics?.length || previewData.workouts?.length} records):
            </h3>

            {previewData.metrics && (
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2 text-left">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.metrics.slice(0, 10).map((metric, idx) => (
                    <tr key={idx} className="border-t border-gray-200">
                      <td className="px-3 py-2">{metric.date}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                          {metric.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{metric.value.toFixed(2)}</td>
                      <td className="px-3 py-2">{metric.unit || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {previewData.workouts && (
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Sport</th>
                    <th className="px-3 py-2 text-right">Duration</th>
                    <th className="px-3 py-2 text-right">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.workouts.slice(0, 10).map((workout, idx) => (
                    <tr key={idx} className="border-t border-gray-200">
                      <td className="px-3 py-2">{workout.date}</td>
                      <td className="px-3 py-2 font-medium">{workout.name}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                          {workout.sport}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{workout.duration} min</td>
                      <td className="px-3 py-2 text-right">
                        {workout.distance ? `${workout.distance.toFixed(1)} km` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={confirmImport}
              disabled={uploading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Importing...' : 'Confirm Import'}
            </button>
            <button
              onClick={() => {
                setPreviewData(null);
                setShowPreview(false);
                setMessage('');
              }}
              disabled={uploading}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Format Documentation */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Metrics Format */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Metrics CSV Format</h3>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            For training metrics like HRV, VO2max, etc.
          </p>

          <div className="bg-gray-50 rounded p-3 font-mono text-xs overflow-x-auto mb-3">
            <div className="text-gray-700 font-semibold">date,type,value,unit</div>
            <div className="text-gray-600">2024-01-15,HRV,65,ms</div>
            <div className="text-gray-600">2024-01-15,VO2MAX,52,ml/kg/min</div>
            <div className="text-gray-600">2024-01-15,TRAINING_LOAD,450,</div>
          </div>

          <button
            onClick={() => {
              const csv = `date,type,value,unit
2024-01-15,HRV,65,ms
2024-01-15,TRAINING_LOAD,450,
2024-01-15,VO2MAX,52,ml/kg/min
2024-01-15,RESTING_HR,48,bpm
2024-01-15,SLEEP_HOURS,7.5,hours`;

              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'sample-metrics.csv';
              a.click();
              window.URL.revokeObjectURL(url);
            }}
            className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded font-semibold transition"
          >
            Download Sample
          </button>
        </div>

        {/* Workouts Format */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-lg">Workouts CSV Format</h3>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            For individual training activities
          </p>

          <div className="bg-gray-50 rounded p-3 font-mono text-xs overflow-x-auto mb-3">
            <div className="text-gray-700 font-semibold">date,sport,name,duration,distance</div>
            <div className="text-gray-600">2024-01-15,Running,Easy Run,60,10</div>
            <div className="text-gray-600">2024-01-16,Cycling,Tempo Ride,90,35</div>
            <div className="text-gray-600">2024-01-17,Swimming,Intervals,45,2.5</div>
          </div>

          <button
            onClick={() => {
              const csv = `date,sport,name,duration,distance
2024-01-15,Running,Easy Run,60,10
2024-01-16,Cycling,Tempo Ride,90,35
2024-01-17,Swimming,Intervals,45,2.5
2024-01-18,Running,Long Run,120,18`;

              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'sample-workouts.csv';
              a.click();
              window.URL.revokeObjectURL(url);
            }}
            className="text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-2 rounded font-semibold transition"
          >
            Download Sample
          </button>
        </div>
      </div>

      {/* Supported Formats Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Flexible Format Support</h3>
        <p className="text-sm text-blue-800 mb-2">
          Our smart CSV parser automatically detects and maps data from:
        </p>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          <li>Garmin Connect exports</li>
          <li>Strava activity exports</li>
          <li>Custom CSV files with standard column names</li>
          <li>Various date formats (YYYY-MM-DD, timestamps, etc.)</li>
          <li>Duration in seconds, minutes, or HH:MM:SS format</li>
        </ul>
      </div>
    </div>
  );
}
