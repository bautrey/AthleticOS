// frontend/src/pages/AcceptInvitePage.tsx
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useInviteDetails, useAcceptInvite } from '../hooks/useInvites';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  ATHLETIC_DIRECTOR: 'Athletic Director',
  COACH: 'Coach',
  PARENT: 'Parent',
  ATHLETE: 'Athlete',
};

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: invite, isLoading, error } = useInviteDetails(token!);
  const acceptMutation = useAcceptInvite();

  const handleAccept = async () => {
    if (!token) return;
    try {
      const result = await acceptMutation.mutateAsync(token);
      navigate(`/schools/${result.schoolId}`);
    } catch {
      // Error handled by mutation state
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading invite...</p>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Invite</h1>
          <p className="text-gray-600 mb-6">This invite link is invalid or has expired.</p>
          <Link to="/login" className="text-blue-600 hover:underline">Go to login</Link>
        </div>
      </div>
    );
  }

  if (invite.acceptedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
          <h1 className="text-2xl font-bold mb-4">Already Accepted</h1>
          <p className="text-gray-600 mb-6">This invite has already been accepted.</p>
          <Link to="/" className="text-blue-600 hover:underline">Go to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
        <h1 className="text-2xl font-bold mb-2">AthleticOS</h1>
        <h2 className="text-lg text-gray-600 mb-6">You've been invited!</h2>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <div className="mb-2">
            <span className="text-sm text-gray-500">School</span>
            <p className="font-medium">{invite.schoolName}</p>
          </div>
          <div className="mb-2">
            <span className="text-sm text-gray-500">Role</span>
            <p className="font-medium">{ROLE_LABELS[invite.role] || invite.role}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Invited by</span>
            <p className="font-medium">{invite.inviterEmail}</p>
          </div>
        </div>

        {user ? (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Logged in as <strong>{user.email}</strong>
            </p>
            {acceptMutation.error && (
              <p className="text-red-600 text-sm mb-4">Failed to accept invite. Please try again.</p>
            )}
            <button
              onClick={handleAccept}
              disabled={acceptMutation.isPending}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {acceptMutation.isPending ? 'Accepting...' : 'Accept Invite'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              to={`/login?invite=${token}`}
              className="block w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center"
            >
              Log in to accept
            </Link>
            <Link
              to={`/register?invite=${token}`}
              className="block w-full py-2 border border-gray-300 rounded hover:bg-gray-50 text-center"
            >
              Create an account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
