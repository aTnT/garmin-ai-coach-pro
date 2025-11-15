'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Mail, TrendingUp, Calendar, Activity, Trash2, Crown, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';

interface Athlete {
  membership: {
    id: string;
    joinedAt: string;
  };
  athlete: {
    id: string;
    name: string;
    email: string;
    age: number | null;
    gender: string | null;
    weight: number | null;
  };
  stats: {
    totalWorkouts: number;
    activePlans: number;
    latestReadiness: number | null;
    latestReadinessDate: string | null;
  };
}

export default function TeamDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [maxAthletes, setMaxAthletes] = useState(10);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchAthletes();
  }, []);

  const fetchAthletes = async () => {
    try {
      const response = await fetch('/api/team/athletes');

      if (response.status === 403) {
        // User doesn't have TEAM subscription
        const data = await response.json();
        setMessage({ type: 'error', text: data.message });
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch athletes');
      }

      const data = await response.json();
      setAthletes(data.athletes);
      setMaxAthletes(data.maxAthletes);
    } catch (error: any) {
      console.error('Error fetching athletes:', error);
      setMessage({ type: 'error', text: 'Failed to load athletes' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteEmail: inviteEmail,
          message: inviteMessage || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send invite');
      }

      setMessage({ type: 'success', text: 'Invitation sent successfully!' });
      setInviteEmail('');
      setInviteMessage('');
      setShowInviteForm(false);
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSending(false);
    }
  };

  const handleRemoveAthlete = async (athleteId: string, athleteName: string) => {
    const confirmation = confirm(
      `Are you sure you want to remove ${athleteName} from your team? They will no longer be able to share data with you.`
    );

    if (!confirmation) return;

    try {
      const response = await fetch(`/api/team/athletes/${athleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove athlete');
      }

      setMessage({ type: 'success', text: 'Athlete removed from team' });
      fetchAthletes();
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
              <Users className="w-8 h-8 text-blue-600" />
              <span>My Team</span>
            </h1>
            <p className="text-gray-600 mt-2">
              Manage your athletes and track their progress
            </p>
          </div>

          {athletes.length < maxAthletes && (
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <UserPlus className="w-5 h-5" />
              <span>Invite Athlete</span>
            </button>
          )}
        </div>

        {/* Team Capacity */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-semibold text-gray-900">
                Team Capacity: {athletes.length} / {maxAthletes} athletes
              </span>
            </div>
            {athletes.length >= maxAthletes && (
              <span className="text-sm text-red-600 font-semibold">Limit reached</span>
            )}
          </div>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <div className="mb-8 bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Mail className="w-5 h-5" />
            <span>Send Invitation</span>
          </h3>
          <form onSubmit={handleSendInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Athlete Email
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="athlete@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Personal Message (Optional)
              </label>
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Let's work together to achieve your training goals..."
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={sending}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Invitation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteEmail('');
                  setInviteMessage('');
                }}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Athletes List */}
      {athletes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center border border-gray-200">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Athletes Yet</h3>
          <p className="text-gray-600 mb-6">
            Start building your team by inviting athletes to join.
          </p>
          <button
            onClick={() => setShowInviteForm(true)}
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            <UserPlus className="w-5 h-5" />
            <span>Invite Your First Athlete</span>
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {athletes.map((athlete) => (
            <div
              key={athlete.athlete.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition border border-gray-200 overflow-hidden"
            >
              <div className="p-6">
                {/* Athlete Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {athlete.athlete.name || 'Unnamed Athlete'}
                    </h3>
                    <p className="text-sm text-gray-600">{athlete.athlete.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Joined {format(new Date(athlete.membership.joinedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 text-blue-600 mb-1">
                      <Activity className="w-4 h-4" />
                      <span className="text-xs font-semibold">Workouts</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">
                      {athlete.stats.totalWorkouts}
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 text-purple-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-semibold">Plans</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">
                      {athlete.stats.activePlans}
                    </p>
                  </div>
                </div>

                {/* Readiness Score */}
                {athlete.stats.latestReadiness !== null && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Latest Readiness</span>
                      <TrendingUp className="w-3 h-3" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            athlete.stats.latestReadiness >= 80
                              ? 'bg-green-500'
                              : athlete.stats.latestReadiness >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${athlete.stats.latestReadiness}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {athlete.stats.latestReadiness}
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => router.push(`/dashboard/team/${athlete.athlete.id}`)}
                    className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition text-sm"
                  >
                    <span>View Details</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleRemoveAthlete(athlete.athlete.id, athlete.athlete.name || 'this athlete')}
                    className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
