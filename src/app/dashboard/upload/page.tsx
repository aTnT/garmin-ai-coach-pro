'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import Papa from 'papaparse';

export default function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage('');
    setMessageType('');

    try {
      const text = await file.text();

      Papa.parse(text, {
        header: true,
        complete: async (results) => {
          try {
            // Transform CSV data to metrics format
            const metrics = results.data
              .filter((row: any) => row.date && row.type && row.value)
              .map((row: any) => ({
                date: row.date,
                type: row.type,
                value: row.value,
                unit: row.unit || null,
                metadata: row.metadata ? JSON.parse(row.metadata) : null,
              }));

            if (metrics.length === 0) {
              setMessage('No valid metrics found in CSV file');
              setMessageType('error');
              setUploading(false);
              return;
            }

            // Upload to API
            const response = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ metrics }),
            });

            if (!response.ok) {
              throw new Error('Upload failed');
            }

            const data = await response.json();
            setMessage(`Successfully uploaded ${data.count} metrics!`);
            setMessageType('success');

            // Clear file input
            event.target.value = '';
          } catch (error) {
            console.error('Error processing CSV:', error);
            setMessage('Failed to process CSV file. Please check the format.');
            setMessageType('error');
          } finally {
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

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Upload Training Data
        </h1>
        <p className="text-gray-600">
          Import your training metrics from a CSV file
        </p>
      </div>

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

          {uploading && (
            <p className="mt-4 text-blue-600">Uploading...</p>
          )}

          {message && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                messageType === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message}
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">CSV Format</h3>
          <p className="text-sm text-blue-700 mb-3">
            Your CSV file should have the following columns:
          </p>
          <div className="bg-white rounded p-3 font-mono text-sm overflow-x-auto">
            <div className="text-gray-700">
              date,type,value,unit
            </div>
            <div className="text-gray-500">
              2024-01-15,HRV,65,ms
            </div>
            <div className="text-gray-500">
              2024-01-15,TRAINING_LOAD,450,
            </div>
            <div className="text-gray-500">
              2024-01-15,VO2MAX,52,ml/kg/min
            </div>
          </div>

          <div className="mt-3 text-sm text-blue-700">
            <p className="font-semibold mb-1">Supported metric types:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>HRV - Heart Rate Variability (ms)</li>
              <li>VO2MAX - VO2 Max (ml/kg/min)</li>
              <li>RESTING_HR - Resting Heart Rate (bpm)</li>
              <li>MAX_HR - Maximum Heart Rate (bpm)</li>
              <li>FTP - Functional Threshold Power (watts)</li>
              <li>TRAINING_LOAD - Training Load</li>
              <li>RECOVERY_TIME - Recovery Time (hours)</li>
              <li>SLEEP_HOURS - Sleep Duration (hours)</li>
              <li>STRESS_LEVEL - Stress Level (0-100)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-3">Sample Data</h3>
        <p className="text-sm text-gray-600 mb-4">
          Download a sample CSV file to see the correct format:
        </p>
        <button
          onClick={() => {
            const csv = `date,type,value,unit
2024-01-15,HRV,65,ms
2024-01-15,TRAINING_LOAD,450,
2024-01-15,VO2MAX,52,ml/kg/min
2024-01-15,RESTING_HR,48,bpm
2024-01-15,SLEEP_HOURS,7.5,hours
2024-01-14,HRV,62,ms
2024-01-14,TRAINING_LOAD,380,
2024-01-14,RECOVERY_TIME,24,hours`;

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sample-metrics.csv';
            a.click();
            window.URL.revokeObjectURL(url);
          }}
          className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          Download Sample CSV
        </button>
      </div>
    </div>
  );
}
