// frontend/src/pages/NotificationPrefsPage.tsx
import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useNotificationPreferences, useUpdatePreferences, useSendTestNotification } from '../hooks/useNotifications';

export function NotificationPrefsPage() {
  const { user } = useAuth();
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdatePreferences();
  const testMutation = useSendTestNotification();

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [digestMode, setDigestMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [testSent, setTestSent] = useState<string | null>(null);

  const schoolId = user?.schools?.[0]?.id;

  useEffect(() => {
    if (prefs) {
      setEmailEnabled(prefs.emailEnabled);
      setSmsEnabled(prefs.smsEnabled);
      setQuietStart(prefs.quietHoursStart || '');
      setQuietEnd(prefs.quietHoursEnd || '');
      setDigestMode(prefs.digestMode);
      setPhone(prefs.phone || '');
    }
  }, [prefs]);

  const handleSave = () => {
    setSaved(false);
    updateMutation.mutate(
      {
        emailEnabled,
        smsEnabled,
        quietHoursStart: quietStart || null,
        quietHoursEnd: quietEnd || null,
        digestMode,
        phone: phone || null,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      }
    );
  };

  const handleTest = (channel: 'EMAIL' | 'SMS') => {
    if (!schoolId) return;
    setTestSent(null);
    testMutation.mutate(
      { schoolId, channel },
      {
        onSuccess: () => {
          setTestSent(`Test ${channel.toLowerCase()} sent successfully!`);
          setTimeout(() => setTestSent(null), 5000);
        },
        onError: (err: any) => {
          setTestSent(err.response?.data?.error?.message || `Failed to send test ${channel.toLowerCase()}`);
          setTimeout(() => setTestSent(null), 5000);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center text-gray-500 py-12">Loading preferences...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Notification Preferences</h1>
        <p className="text-gray-600 mb-8">
          Manage how and when you receive notifications from AthleticOS.
        </p>

        {/* Email Settings */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Notifications</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">Enable email notifications</span>
          </label>
          <div className="mt-4">
            <button
              onClick={() => handleTest('EMAIL')}
              disabled={!emailEnabled || testMutation.isPending}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {testMutation.isPending ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
        </div>

        {/* SMS Settings */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">SMS Notifications</h2>
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(e) => setSmsEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">Enable SMS notifications</span>
          </label>
          {smsEnabled && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div>
            <button
              onClick={() => handleTest('SMS')}
              disabled={!smsEnabled || !phone || testMutation.isPending}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {testMutation.isPending ? 'Sending...' : 'Send Test SMS'}
            </button>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quiet Hours</h2>
          <p className="text-sm text-gray-500 mb-4">
            Notifications will be queued during quiet hours (except weather alerts).
          </p>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Digest Mode */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Digest Mode</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={digestMode}
              onChange={(e) => setDigestMode(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">Batch notifications into a daily digest</span>
          </label>
          <p className="text-sm text-gray-500 mt-2">
            When enabled, non-urgent notifications are grouped and sent once daily.
          </p>
        </div>

        {/* Status Messages */}
        {saved && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
            Preferences saved successfully.
          </div>
        )}
        {testSent && (
          <div className={`mb-4 p-3 rounded-md text-sm ${testSent.includes('Failed') || testSent.includes('limit') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
            {testSent}
          </div>
        )}
        {updateMutation.isError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            Failed to save preferences. Please try again.
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </Layout>
  );
}
