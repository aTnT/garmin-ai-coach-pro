'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Download, Trash2, AlertTriangle, Shield } from 'lucide-react';

export default function PrivacyPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExportData = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/user/data');

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const data = await response.json();

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garmin-ai-coach-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({
        type: 'success',
        text: 'Your data has been downloaded successfully',
      });
    } catch (error: any) {
      console.error('Error exporting data:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to export data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmEmail || confirmEmail !== session?.user?.email) {
      setMessage({
        type: 'error',
        text: 'Please confirm your email address',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/user/data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmEmail,
          reason: deleteReason,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete account');
      }

      setMessage({
        type: 'success',
        text: 'Your account and all data have been deleted. Signing out...',
      });

      // Sign out and redirect
      setTimeout(() => {
        signOut({ callbackUrl: '/' });
      }, 2000);
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to delete account',
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Data Privacy & Security
            </h1>
          </div>
          <p className="text-gray-600">
            Manage your personal data in compliance with GDPR and privacy regulations
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        {/* Export Data Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Export Your Data
              </h2>
              <p className="text-gray-600 mb-4">
                Download a complete copy of all your personal data, including training metrics,
                workouts, plans, and conversations. This file will be in JSON format.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                <strong>Includes:</strong> Profile, training metrics, workouts, plans, AI conversations,
                connected accounts, subscription info, and team memberships.
              </p>
              <button
                onClick={handleExportData}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>{loading ? 'Exporting...' : 'Download My Data'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Delete Account Section */}
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Delete Your Account
              </h2>
              <p className="text-gray-600 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">Warning: This will permanently delete:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>All training data (metrics, workouts, plans)</li>
                      <li>All AI coaching conversations</li>
                      <li>Connected Garmin account (OAuth disconnected)</li>
                      <li>Active subscription (will be canceled)</li>
                      <li>Team memberships (removed from all teams)</li>
                      <li>Your user account and profile</li>
                    </ul>
                  </div>
                </div>
              </div>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete My Account
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm your email address to proceed
                    </label>
                    <input
                      type="email"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      placeholder={session?.user?.email || 'your@email.com'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for deletion (optional)
                    </label>
                    <textarea
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="Help us improve by telling us why you're leaving..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={loading || confirmEmail !== session?.user?.email}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? 'Deleting...' : 'Permanently Delete Everything'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setConfirmEmail('');
                        setDeleteReason('');
                      }}
                      disabled={loading}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Privacy Information */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Your Privacy Rights
          </h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              <strong>GDPR Compliance:</strong> We comply with the General Data Protection Regulation (GDPR)
              and other privacy laws. You have the right to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Access your personal data (export above)</li>
              <li>Rectify inaccurate data (edit in settings)</li>
              <li>Erase your data (delete account above)</li>
              <li>Restrict or object to processing</li>
              <li>Data portability (JSON export)</li>
            </ul>
            <p className="mt-3">
              <strong>Data Retention:</strong> Audit logs are retained for 90 days for security purposes.
              All other data is deleted immediately upon account deletion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
