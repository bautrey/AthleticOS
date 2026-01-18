// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { SchoolDetail } from './pages/SchoolDetail';
import { SeasonDetail } from './pages/SeasonDetail';
import { BlockersPage } from './pages/BlockersPage';
import { PublicSchedulePage } from './pages/PublicSchedulePage';
import { PublicScheduleEmbed } from './pages/PublicScheduleEmbed';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Routes>
      {/* Public routes (no auth required) */}
      <Route path="/s/:token" element={<PublicSchedulePage />} />
      <Route path="/s/:token/embed" element={<PublicScheduleEmbed />} />

      {/* Auth routes */}
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/schools/:schoolId" element={<ProtectedRoute><SchoolDetail /></ProtectedRoute>} />
      <Route path="/schools/:schoolId/blockers" element={<ProtectedRoute><BlockersPage /></ProtectedRoute>} />
      <Route path="/schools/:schoolId/seasons/:seasonId" element={<ProtectedRoute><SeasonDetail /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
