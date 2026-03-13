// frontend/src/pages/SmsOptOutPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';

export function SmsOptOutPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleOptOut = async () => {
    if (!token) return;
    setStatus('loading');
    try {
      await notificationsApi.smsOptOut(token);
      setStatus('success');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to process opt-out request.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">SMS Opt-Out</h1>

        {status === 'success' ? (
          <div>
            <p className="text-green-700 mb-4">
              You have been successfully opted out of SMS notifications from AthleticOS.
            </p>
            <p className="text-sm text-gray-500">
              You can re-enable SMS notifications at any time from your notification preferences in the app.
            </p>
          </div>
        ) : status === 'error' ? (
          <div>
            <p className="text-red-700 mb-4">{errorMsg}</p>
            <button
              onClick={handleOptOut}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 mb-6">
              Click the button below to stop receiving SMS notifications from AthleticOS.
            </p>
            <button
              onClick={handleOptOut}
              disabled={status === 'loading'}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              {status === 'loading' ? 'Processing...' : 'Opt Out of SMS'}
            </button>
            <p className="text-xs text-gray-400 mt-4">
              This will disable all SMS notifications. You can re-enable them in the app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
