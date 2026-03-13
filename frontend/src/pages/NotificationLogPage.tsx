// frontend/src/pages/NotificationLogPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useNotificationLog } from '../hooks/useNotifications';
import type { NotificationLogQuery } from '../api/notifications';

const CHANNELS = ['', 'EMAIL', 'SMS', 'IN_APP', 'PUSH'] as const;
const STATUSES = ['', 'QUEUED', 'SENT', 'FAILED', 'DELIVERED'] as const;

const statusColors: Record<string, string> = {
  QUEUED: 'bg-yellow-100 text-yellow-800',
  SENT: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  DELIVERED: 'bg-blue-100 text-blue-800',
};

const channelColors: Record<string, string> = {
  EMAIL: 'bg-indigo-100 text-indigo-800',
  SMS: 'bg-purple-100 text-purple-800',
  IN_APP: 'bg-gray-100 text-gray-800',
  PUSH: 'bg-teal-100 text-teal-800',
};

function formatTrigger(trigger: string): string {
  return trigger.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function NotificationLogPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');

  const query: NotificationLogQuery = {
    page,
    limit: 25,
    ...(channel && { channel }),
    ...(status && { status }),
  };

  const { data, isLoading } = useNotificationLog(schoolId!, query);

  return (
    <Layout>
      <div className="max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Notification Log</h1>
        <p className="text-gray-600 mb-6">
          View all notifications sent to school members.
        </p>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Channel</label>
            <select
              value={channel}
              onChange={(e) => { setChannel(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Channels</option>
              {CHANNELS.filter(Boolean).map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {STATUSES.filter(Boolean).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading notifications...</div>
          ) : !data || data.data.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No notifications found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.data.map((n) => (
                      <tr key={n.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {n.user.name || n.user.email}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${channelColors[n.channel] || 'bg-gray-100 text-gray-800'}`}>
                            {n.channel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatTrigger(n.trigger)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[n.status] || 'bg-gray-100 text-gray-800'}`}>
                            {n.status}
                          </span>
                          {n.failReason && (
                            <p className="text-xs text-red-500 mt-0.5">{n.failReason}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                          {n.subject}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {n.sentAt ? new Date(n.sentAt).toLocaleString() : n.createdAt ? new Date(n.createdAt).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.meta.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
                      disabled={page >= data.meta.totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
