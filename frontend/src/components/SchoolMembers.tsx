// frontend/src/components/SchoolMembers.tsx
import { useState } from 'react';
import { useMembers, useInvites, useCreateInvite, useRevokeInvite } from '../hooks/useInvites';

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'ATHLETIC_DIRECTOR', label: 'Athletic Director' },
  { value: 'COACH', label: 'Coach' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'ATHLETE', label: 'Athlete' },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]));

export function SchoolMembers({ schoolId }: { schoolId: string }) {
  const { data: members, isLoading: membersLoading } = useMembers(schoolId);
  const { data: invites, isLoading: invitesLoading } = useInvites(schoolId);
  const createInvite = useCreateInvite(schoolId);
  const revokeInvite = useRevokeInvite(schoolId);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ADMIN');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createInvite.mutateAsync({ email, role });
      setEmail('');
      setRole('ADMIN');
      setShowInviteForm(false);
    } catch {
      // Error handled by mutation state
    }
  };

  const pendingInvites = invites?.filter(i => !i.acceptedAt && new Date(i.expiresAt) > new Date()) ?? [];

  return (
    <div className="space-y-6">
      {/* Members */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Members</h3>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Invite Member
          </button>
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <form onSubmit={handleInvite} className="mb-4 p-4 bg-gray-50 rounded-lg">
            {createInvite.error && (
              <div className="mb-3 p-2 bg-red-50 text-red-600 rounded text-sm">
                {(createInvite.error as any)?.response?.data?.error?.message || 'Failed to send invite'}
              </div>
            )}
            {createInvite.isSuccess && (
              <div className="mb-3 p-2 bg-green-50 text-green-700 rounded text-sm">
                Invite sent!
              </div>
            )}
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 px-3 py-2 border rounded text-sm"
                required
              />
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={createInvite.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {createInvite.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        )}

        {membersLoading ? (
          <p className="text-gray-500 text-sm">Loading members...</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members?.map(m => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <div>{m.name || m.email}</div>
                      {m.name && <div className="text-xs text-gray-500">{m.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {!invitesLoading && pendingInvites.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Pending Invites</h3>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pendingInvites.map(inv => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3">{inv.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-xs font-medium">
                        {ROLE_LABELS[inv.role] || inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => revokeInvite.mutate(inv.id)}
                        disabled={revokeInvite.isPending}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
