// frontend/src/components/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { schoolsApi } from '../api/schools';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { data: schools } = useQuery({
    queryKey: ['schools'],
    queryFn: schoolsApi.list,
  });

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold">AthleticOS</h1>
      </div>

      <nav className="flex-1 space-y-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `block px-4 py-2 rounded ${isActive ? 'bg-blue-600' : 'hover:bg-gray-800'}`
          }
        >
          Dashboard
        </NavLink>

        {schools && schools.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-gray-500 uppercase px-4 mb-2">Schools</div>
            {schools.map((school) => (
              <NavLink
                key={school.id}
                to={`/schools/${school.id}`}
                className={({ isActive }) =>
                  `block px-4 py-2 rounded text-sm ${isActive ? 'bg-blue-600' : 'hover:bg-gray-800'}`
                }
              >
                {school.name}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-gray-700 pt-4">
        <div className="text-sm text-gray-400 mb-2">{user?.email}</div>
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
