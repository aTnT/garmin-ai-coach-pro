'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { User, Save, Trash2, Key, AlertCircle, Activity as ActivityIcon, RefreshCw, Link as LinkIcon, Unlink } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  age: number | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  weight: number | null;
  createdAt: string;
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  const [weight, setWeight] = useState<number | ''>('');

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Garmin Connect state
  const [garminConnected, setGarminConnected] = useState(false);
  const [garminLastSync, setGarminLastSync] = useState<string | null>(null);
  const [garminConnecting, setGarminConnecting] = useState(false);
  const [garminSyncing, setGarminSyncing] = useState(false);

  useEffect(() => {
    fetchProfile();
    checkGarminConnection();
  }, []);

  const checkGarminConnection = async () => {
    try {
      const response = await fetch('/api/garmin/sync');
      if (response.ok) {
        const data = await response.json();
        setGarminConnected(data.connected);
        setGarminLastSync(data.lastSync);
      }
    } catch (error) {
      console.error('Error checking Garmin connection:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setName(data.name || '');
        setAge(data.age || '');
        setGender(data.gender || '');
        setWeight(data.weight || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      showMessage('error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updates: any = {
        name: name || undefined,
        age: age !== '' ? Number(age) : null,
        gender: gender || null,
        weight: weight !== '' ? Number(weight) : null,
      };

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);

      // Update session with new name
      if (name !== session?.user?.name) {
        await updateSession({ name });
      }

      showMessage('success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showMessage('error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showMessage('error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      showMessage('error', 'Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      showMessage('success', 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      showMessage('error', error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleConnectGarmin = async () => {
    setGarminConnecting(true);
    try {
      const response = await fetch('/api/garmin/connect');
      if (!response.ok) {
        throw new Error('Failed to initiate Garmin connection');
      }

      const data = await response.json();
      // Redirect to Garmin authorization page
      window.location.href = data.authorizationUrl;
    } catch (error: any) {
      console.error('Error connecting to Garmin:', error);
      showMessage('error', error.message || 'Failed to connect to Garmin');
      setGarminConnecting(false);
    }
  };

  const handleSyncGarmin = async () => {
    setGarminSyncing(true);
    try {
      const response = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sync Garmin data');
      }

      const data = await response.json();
      showMessage(
        'success',
        `Synced ${data.activitiesImported} activities and ${data.metricsImported} metrics from Garmin`
      );
      setGarminLastSync(new Date().toISOString());
    } catch (error: any) {
      console.error('Error syncing Garmin data:', error);
      showMessage('error', error.message || 'Failed to sync Garmin data');
    } finally {
      setGarminSyncing(false);
    }
  };

  const handleDisconnectGarmin = async () => {
    const confirmation = confirm(
      'Are you sure you want to disconnect your Garmin account? Your synced data will remain, but you will need to reconnect to sync new data.'
    );

    if (!confirmation) {
      return;
    }

    try {
      const response = await fetch('/api/garmin/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect Garmin');
      }

      setGarminConnected(false);
      setGarminLastSync(null);
      showMessage('success', 'Garmin account disconnected successfully');
    } catch (error: any) {
      console.error('Error disconnecting Garmin:', error);
      showMessage('error', error.message || 'Failed to disconnect Garmin');
    }
  };

  const handleDeleteAllData = async () => {
    const confirmation = prompt(
      'This will delete ALL your training data (metrics, workouts, plans). Type "DELETE" to confirm:'
    );

    if (confirmation !== 'DELETE') {
      return;
    }

    try {
      const response = await fetch('/api/seed', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete data');
      }

      showMessage('success', 'All training data deleted successfully');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('Error deleting data:', error);
      showMessage('error', error.message || 'Failed to delete data');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your profile and account settings</p>
      </div>

      {/* Message Display */}
      {message && (
        <div
          className={`rounded-lg p-4 flex items-center space-x-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <AlertCircle className="w-5 h-5" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Information */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <User className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Profile Information</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Your age"
                min="10"
                max="120"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight (kg)
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="Your weight in kg"
                min="20"
                max="300"
                step="0.1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <div className="font-medium">Account created</div>
                <div>
                  {profile?.createdAt && format(new Date(profile.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <Key className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-semibold">Change Password</h2>
        </div>

        {!showPasswordChange ? (
          <button
            onClick={() => setShowPasswordChange(true)}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            Change Password
          </button>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={changingPassword}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changingPassword ? 'Changing...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Garmin Connect Integration */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <ActivityIcon className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-semibold">Garmin Connect Integration</h2>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600">
            Connect your Garmin account to automatically sync your activities and health metrics.
          </p>

          {!garminConnected ? (
            <div>
              <button
                onClick={handleConnectGarmin}
                disabled={garminConnecting}
                className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LinkIcon className="w-5 h-5" />
                <span>{garminConnecting ? 'Connecting...' : 'Connect to Garmin'}</span>
              </button>
              <p className="text-sm text-gray-500 mt-2">
                You'll be redirected to Garmin to authorize the connection
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-green-600">
                <LinkIcon className="w-5 h-5" />
                <span className="font-semibold">Connected to Garmin</span>
              </div>

              {garminLastSync && (
                <div className="text-sm text-gray-600">
                  Last synced: {format(new Date(garminLastSync), 'MMM d, yyyy h:mm a')}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleSyncGarmin}
                  disabled={garminSyncing}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-5 h-5 ${garminSyncing ? 'animate-spin' : ''}`} />
                  <span>{garminSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>

                <button
                  onClick={handleDisconnectGarmin}
                  className="flex items-center space-x-2 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  <Unlink className="w-5 h-5" />
                  <span>Disconnect</span>
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Auto-sync:</strong> Your Garmin data syncs automatically every 24 hours.
                  Use "Sync Now" to manually sync the last 30 days of activities and metrics.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Trash2 className="w-6 h-6 text-red-600" />
          <h2 className="text-xl font-semibold text-red-900">Danger Zone</h2>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-red-900 mb-2">
              Delete All Training Data
            </h3>
            <p className="text-sm text-red-700 mb-3">
              This will permanently delete all your metrics, workouts, and training
              plans. Your account will remain active. This action cannot be undone.
            </p>
            <button
              onClick={handleDeleteAllData}
              className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Delete All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
