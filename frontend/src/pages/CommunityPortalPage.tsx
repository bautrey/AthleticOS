// frontend/src/pages/CommunityPortalPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { facilityRequestsApi } from '../api/facilityRequests';
import { api } from '../api/client';

export function CommunityPortalPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [mode, setMode] = useState<'register' | 'login' | 'dashboard'>('register');

  // Registration fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard state
  const [requests, setRequests] = useState<any[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  if (!schoolId) return <div className="min-h-screen flex items-center justify-center">Invalid school link.</div>;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await facilityRequestsApi.communityRegister({ email, password, name, schoolId });
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      setMode('dashboard');
      loadRequests();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      setMode('dashboard');
      loadRequests();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    setDashLoading(true);
    try {
      const result = await facilityRequestsApi.list(schoolId);
      setRequests(result.data);
    } catch {
      // May fail if not authorized
    } finally {
      setDashLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    DENIED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };

  if (mode === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto py-12 px-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Community Portal</h1>
          <p className="text-sm text-gray-500 mb-6">Track your facility requests.</p>

          {dashLoading ? (
            <div className="text-gray-500 text-center py-8">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No requests yet. Contact the school to submit a facility request.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req: any) => (
                <div key={req.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-800">{req.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[req.status]}`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {req.facility?.name} | {new Date(req.requestedDate).toLocaleDateString()} | {req.startTime}-{req.endTime}
                  </div>
                  {req.reviewNotes && (
                    <p className="text-xs text-gray-500 mt-1 italic">Review notes: {req.reviewNotes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); setMode('login'); }}
            className="mt-6 text-sm text-gray-400 hover:text-gray-600"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-xl font-bold text-gray-800 mb-1">Community Portal</h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'register' ? 'Create an account to request facility bookings.' : 'Sign in to view your requests.'}
        </p>

        <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Please wait...' : mode === 'register' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          {mode === 'register' ? (
            <button onClick={() => { setMode('login'); setError(''); }} className="text-sm text-blue-600 hover:underline">
              Already have an account? Sign in
            </button>
          ) : (
            <button onClick={() => { setMode('register'); setError(''); }} className="text-sm text-blue-600 hover:underline">
              Need an account? Register
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
