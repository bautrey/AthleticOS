// frontend/src/pages/Dashboard.tsx
import { useAuth } from '../hooks/useAuth';

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">AthleticOS</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.email}</span>
            <button onClick={logout} className="text-red-600 hover:underline">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        {user?.schools.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-600 mb-4">You don't have any schools yet.</p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Create School
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {user?.schools.map((school) => (
              <div key={school.id} className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-semibold text-lg">{school.name}</h3>
                <p className="text-sm text-gray-500 capitalize">{school.role.toLowerCase()}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
