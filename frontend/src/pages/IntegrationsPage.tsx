// frontend/src/pages/IntegrationsPage.tsx
//
// Self-service Blackbaud setup. A school administrator connects their own
// environment here: the Connect button sends them to Blackbaud's own login, they
// authorize there, and AthleticOS receives a token. No username or password is
// ever entered into AthleticOS or stored by it.
//
// The activity table matters as much as the button. It is the audit trail the
// school can read without asking us, so an administrator can watch exactly what
// the integration does before approving it for anything real.

import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { schoolsApi } from '../api/schools';
import {
  blackbaudApi,
  type ExternalApiCall,
  type ConnectionTestResult,
  type ConnectionCheck,
} from '../api/blackbaud';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function CheckRow({ check }: { check: ConnectionCheck }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
            check.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {check.ok ? 'OK' : 'Failed'}
        </span>
        <div className="min-w-0">
          <div className="font-medium text-gray-900">
            {check.label}
            {check.ok && typeof check.count === 'number' && (
              <span className="ml-2 font-normal text-gray-500">
                {check.count} {check.count === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>
          <div className="font-mono text-xs text-gray-500 break-all">{check.endpoint}</div>
          {check.error && <div className="text-sm text-red-700 mt-1">{check.error}</div>}
          {check.ok && check.sample && check.sample.length > 0 && (
            <div className="text-sm text-gray-600 mt-1">
              e.g. {check.sample.join(', ')}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusPill({ call }: { call: ExternalApiCall }) {
  if (call.status === null) {
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
        {call.errorKind ?? 'failed'}
      </span>
    );
  }
  const ok = call.status >= 200 && call.status < 300;
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {call.status}
    </span>
  );
}

export function IntegrationsPage() {
  const params = useParams<{ schoolId?: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The OAuth callback redirects here without a school in the path, so fall back
  // to the user's own school list.
  const { data: schools, isLoading: schoolsLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: schoolsApi.list,
    enabled: !params.schoolId,
  });
  const schoolId = params.schoolId ?? schools?.[0]?.id;

  const callbackResult = searchParams.get('blackbaud');
  const callbackReason = searchParams.get('reason');

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['blackbaud', 'status', schoolId],
    queryFn: () => blackbaudApi.getStatus(schoolId!),
    enabled: !!schoolId,
  });

  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ['blackbaud', 'audit', schoolId],
    queryFn: () => blackbaudApi.listAuditCalls(schoolId!),
    enabled: !!schoolId,
    refetchInterval: 15000,
  });

  const disconnect = useMutation({
    mutationFn: () => blackbaudApi.disconnect(schoolId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blackbaud'] }),
  });

  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const runTest = useMutation({
    mutationFn: () => blackbaudApi.testConnection(schoolId!),
    onSuccess: (result) => {
      setTestResult(result);
      // The test just made real calls. Refresh the log so they appear below it,
      // which is the point: the school sees its own action land in the record.
      queryClient.invalidateQueries({ queryKey: ['blackbaud', 'audit', schoolId] });
    },
    onError: () => setTestResult(null),
  });

  async function handleConnect() {
    if (!schoolId) return;
    setConnecting(true);
    setError(null);
    try {
      window.location.href = await blackbaudApi.getAuthorizeUrl(schoolId);
    } catch {
      setError('Could not start the Blackbaud connection. Please try again.');
      setConnecting(false);
    }
  }

  if (schoolsLoading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-500">Loading…</div>
      </Layout>
    );
  }

  if (!schoolId) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-500">
          No school is associated with this account.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <nav className="text-sm mb-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">Dashboard</Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-900">Integrations</span>
        </nav>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-gray-500 mt-1">
          Connect AthleticOS to the systems your school already runs.
        </p>
      </div>

      {callbackResult === 'connected' && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Blackbaud connected. Every call AthleticOS makes now appears in the activity log below.
        </div>
      )}
      {callbackResult === 'error' && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Blackbaud did not complete the connection{callbackReason ? ` (${callbackReason})` : ''}.
          Nothing was changed. You can try again below.
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Connection */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">Blackbaud Education Management</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Reads the school calendar, athletics teams and team schedules.
            </p>
          </div>
          {statusLoading ? (
            <span className="text-sm text-gray-400 shrink-0">Checking…</span>
          ) : (
            <span
              className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full ${
                status?.connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status?.connected ? 'Connected' : 'Not connected'}
            </span>
          )}
        </div>

        <div className="px-5 py-4">
          {status?.connected ? (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
                {status.environmentId && (
                  <div>
                    <dt className="text-gray-500">Environment</dt>
                    <dd className="font-mono text-xs text-gray-900 break-all">{status.environmentId}</dd>
                  </div>
                )}
                {status.connectedAt && (
                  <div>
                    <dt className="text-gray-500">Connected</dt>
                    <dd className="text-gray-900">{formatWhen(status.connectedAt)}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => runTest.mutate()}
                  disabled={runTest.isPending}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {runTest.isPending ? 'Testing…' : 'Test connection'}
                </button>
                <button
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                  className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
                >
                  {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Testing reads your athletics teams and the next two weeks of your school
                calendar. It reads nothing else, and no student records. Every call it makes
                is listed in the activity log below.
              </p>

              {runTest.isError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  The test could not run. Please try again.
                </div>
              )}

              {testResult && (
                <div
                  className={`mt-4 rounded-lg border px-4 py-3 ${
                    testResult.ok ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="font-medium text-gray-900 mb-1">
                    {testResult.ok
                      ? 'Connection works. AthleticOS can read the following.'
                      : 'Some checks did not pass.'}
                  </div>
                  <ul className="divide-y divide-gray-200 mt-2">
                    {testResult.checks.map((check) => (
                      <CheckRow key={check.endpoint} check={check} />
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-3">
                Disconnecting deletes the stored token. You can also revoke access at any time
                from your own Blackbaud admin portal, or simply change the account's password,
                neither of which requires us to act.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {connecting ? 'Redirecting…' : 'Connect Blackbaud'}
              </button>
              <p className="text-xs text-gray-500 mt-3 max-w-2xl">
                You will be sent to Blackbaud to sign in and approve access. Your username and
                password are entered on Blackbaud's own site — AthleticOS never sees or stores
                them. Whatever the account you sign in with is permitted to do is what the
                integration can do, so sign in with a read-only account.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Audit trail */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Activity</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Every request AthleticOS has made to Blackbaud, most recent first. Endpoints and
            response codes only — no student data is recorded here.
          </p>
        </div>

        {callsLoading ? (
          <div className="p-8 text-center text-gray-500">Loading activity…</div>
        ) : !calls || calls.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No calls yet. Anything AthleticOS reads from Blackbaud will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Endpoint</th>
                  <th className="px-5 py-3">Result</th>
                  <th className="px-5 py-3 text-right">Took</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calls.map((call) => (
                  <tr key={call.id}>
                    <td className="px-5 py-2.5 whitespace-nowrap text-gray-600">
                      {formatWhen(call.createdAt)}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-gray-600">{call.method}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-gray-900 break-all">
                      {call.path}
                    </td>
                    <td className="px-5 py-2.5"><StatusPill call={call} /></td>
                    <td className="px-5 py-2.5 text-right text-gray-500 whitespace-nowrap">
                      {call.durationMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
