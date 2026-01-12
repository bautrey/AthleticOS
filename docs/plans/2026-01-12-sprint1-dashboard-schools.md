# Sprint 1: Core Dashboard & School Management

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build the core UI for managing schools, teams, facilities, and seasons using existing backend APIs.

**Architecture:** React components with TanStack Query for data fetching, React Router for navigation, Tailwind for styling. All APIs already exist - this is pure frontend work.

**Tech Stack:** React 18, TanStack Query, React Router, Tailwind CSS, Axios

---

## Task 1: Dashboard Layout

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create Sidebar component**

```tsx
// frontend/src/components/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold">AthleticOS</h1>
      </div>

      <nav className="flex-1 space-y-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `block px-4 py-2 rounded ${isActive ? 'bg-blue-600' : 'hover:bg-gray-800'}`
          }
        >
          Dashboard
        </NavLink>
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
```

**Step 2: Create Layout component**

```tsx
// frontend/src/components/Layout.tsx
import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
```

**Step 3: Update Dashboard to use Layout**

```tsx
// frontend/src/pages/Dashboard.tsx
import { Layout } from '../components/Layout';

export function Dashboard() {
  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <p className="text-gray-600">Welcome to AthleticOS</p>
    </Layout>
  );
}
```

**Step 4: Verify in browser**

Run: Navigate to http://localhost:3005 after login
Expected: Sidebar on left with nav, main content area on right

**Step 5: Commit**

```bash
git add frontend/src/components frontend/src/pages/Dashboard.tsx
git commit -m "feat: add dashboard layout with sidebar navigation"
```

---

## Task 2: Schools List on Dashboard

**Files:**
- Create: `frontend/src/api/schools.ts`
- Create: `frontend/src/components/SchoolCard.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Create schools API functions**

```tsx
// frontend/src/api/schools.ts
import { api } from './client';

export interface School {
  id: string;
  name: string;
  timezone: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchoolInput {
  name: string;
  timezone: string;
  settings?: Record<string, unknown>;
}

export const schoolsApi = {
  list: async (): Promise<School[]> => {
    const { data } = await api.get('/schools');
    return data.data;
  },

  get: async (id: string): Promise<School> => {
    const { data } = await api.get(`/schools/${id}`);
    return data.data;
  },

  create: async (input: CreateSchoolInput): Promise<School> => {
    const { data } = await api.post('/schools', input);
    return data.data;
  },

  update: async (id: string, input: Partial<CreateSchoolInput>): Promise<School> => {
    const { data } = await api.put(`/schools/${id}`, input);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/schools/${id}`);
  },
};
```

**Step 2: Create SchoolCard component**

```tsx
// frontend/src/components/SchoolCard.tsx
import { Link } from 'react-router-dom';
import type { School } from '../api/schools';

interface SchoolCardProps {
  school: School;
}

export function SchoolCard({ school }: SchoolCardProps) {
  return (
    <Link
      to={`/schools/${school.id}`}
      className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
    >
      <h3 className="text-lg font-semibold text-gray-900">{school.name}</h3>
      <p className="text-sm text-gray-500 mt-1">{school.timezone}</p>
    </Link>
  );
}
```

**Step 3: Update Dashboard to fetch and display schools**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { SchoolCard } from '../components/SchoolCard';
import { schoolsApi } from '../api/schools';

export function Dashboard() {
  const { data: schools, isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: schoolsApi.list,
  });

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Schools</h1>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schools?.map((school) => (
            <SchoolCard key={school.id} school={school} />
          ))}
        </div>
      )}
    </Layout>
  );
}
```

**Step 4: Verify in browser**

Run: Navigate to http://localhost:3005 after login
Expected: Dashboard shows "Lincoln High School" card (created during testing)

**Step 5: Commit**

```bash
git add frontend/src/api/schools.ts frontend/src/components/SchoolCard.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat: display schools list on dashboard"
```

---

## Task 3: Create School Modal

**Files:**
- Create: `frontend/src/components/Modal.tsx`
- Create: `frontend/src/components/CreateSchoolModal.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Create reusable Modal component**

```tsx
// frontend/src/components/Modal.tsx
import { type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              &times;
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create CreateSchoolModal component**

```tsx
// frontend/src/components/CreateSchoolModal.tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { schoolsApi } from '../api/schools';

interface CreateSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
];

export function CreateSchoolModal({ isOpen, onClose }: CreateSchoolModalProps) {
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: schoolsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      onClose();
      setName('');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name, timezone });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create School">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create school'}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            School Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create School'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

**Step 3: Add create button to Dashboard**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { SchoolCard } from '../components/SchoolCard';
import { CreateSchoolModal } from '../components/CreateSchoolModal';
import { schoolsApi } from '../api/schools';

export function Dashboard() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: schools, isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: schoolsApi.list,
  });

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Schools</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + New School
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schools?.map((school) => (
            <SchoolCard key={school.id} school={school} />
          ))}
        </div>
      )}

      <CreateSchoolModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </Layout>
  );
}
```

**Step 4: Verify in browser**

Run: Click "+ New School" button, fill form, submit
Expected: Modal opens, school created, appears in list

**Step 5: Commit**

```bash
git add frontend/src/components/Modal.tsx frontend/src/components/CreateSchoolModal.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat: add create school modal"
```

---

## Task 4: School Detail Page with Tabs

**Files:**
- Create: `frontend/src/pages/SchoolDetail.tsx`
- Create: `frontend/src/components/Tabs.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create Tabs component**

```tsx
// frontend/src/components/Tabs.tsx
import { type ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
}

export function Tabs({ tabs, activeTab, onTabChange, children }: TabsProps) {
  return (
    <div>
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
```

**Step 2: Create SchoolDetail page**

```tsx
// frontend/src/pages/SchoolDetail.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Tabs } from '../components/Tabs';
import { schoolsApi } from '../api/schools';

const TABS = [
  { id: 'teams', label: 'Teams' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'settings', label: 'Settings' },
];

export function SchoolDetail() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [activeTab, setActiveTab] = useState('teams');

  const { data: school, isLoading } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolsApi.get(schoolId!),
    enabled: !!schoolId,
  });

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-500">Loading...</p>
      </Layout>
    );
  }

  if (!school) {
    return (
      <Layout>
        <p className="text-red-500">School not found</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-2">{school.name}</h1>
        <p className="text-gray-500">{school.timezone}</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'teams' && <div>Teams content coming soon...</div>}
        {activeTab === 'facilities' && <div>Facilities content coming soon...</div>}
        {activeTab === 'seasons' && <div>Seasons content coming soon...</div>}
        {activeTab === 'settings' && <div>Settings content coming soon...</div>}
      </Tabs>
    </Layout>
  );
}
```

**Step 3: Add route to App.tsx**

```tsx
// frontend/src/App.tsx - add import and route
import { SchoolDetail } from './pages/SchoolDetail';

// In AppRoutes, add after dashboard route:
<Route path="/schools/:schoolId" element={<ProtectedRoute><SchoolDetail /></ProtectedRoute>} />
```

**Step 4: Verify in browser**

Run: Click on a school card from dashboard
Expected: School detail page with tabs, "Back to Dashboard" link works

**Step 5: Commit**

```bash
git add frontend/src/components/Tabs.tsx frontend/src/pages/SchoolDetail.tsx frontend/src/App.tsx
git commit -m "feat: add school detail page with tab navigation"
```

---

## Task 5: Teams Tab

**Files:**
- Create: `frontend/src/api/teams.ts`
- Create: `frontend/src/components/TeamsTab.tsx`
- Create: `frontend/src/components/CreateTeamModal.tsx`
- Modify: `frontend/src/pages/SchoolDetail.tsx`

**Step 1: Create teams API functions**

```tsx
// frontend/src/api/teams.ts
import { api } from './client';

export interface Team {
  id: string;
  schoolId: string;
  name: string;
  sport: string;
  level: 'VARSITY' | 'JV' | 'FRESHMAN' | 'MIDDLE_SCHOOL';
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamInput {
  name: string;
  sport: string;
  level: Team['level'];
}

export const teamsApi = {
  list: async (schoolId: string): Promise<Team[]> => {
    const { data } = await api.get(`/schools/${schoolId}/teams`);
    return data.data;
  },

  create: async (schoolId: string, input: CreateTeamInput): Promise<Team> => {
    const { data } = await api.post(`/schools/${schoolId}/teams`, input);
    return data.data;
  },

  update: async (schoolId: string, teamId: string, input: Partial<CreateTeamInput>): Promise<Team> => {
    const { data } = await api.put(`/schools/${schoolId}/teams/${teamId}`, input);
    return data.data;
  },

  delete: async (schoolId: string, teamId: string): Promise<void> => {
    await api.delete(`/schools/${schoolId}/teams/${teamId}`);
  },
};
```

**Step 2: Create CreateTeamModal component**

```tsx
// frontend/src/components/CreateTeamModal.tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { teamsApi, type Team } from '../api/teams';

interface CreateTeamModalProps {
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

const LEVELS: Team['level'][] = ['VARSITY', 'JV', 'FRESHMAN', 'MIDDLE_SCHOOL'];

const SPORTS = [
  'Football', 'Basketball', 'Baseball', 'Softball', 'Soccer',
  'Volleyball', 'Track & Field', 'Cross Country', 'Swimming',
  'Tennis', 'Golf', 'Wrestling', 'Lacrosse', 'Hockey',
];

export function CreateTeamModal({ schoolId, isOpen, onClose }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [sport, setSport] = useState('Football');
  const [level, setLevel] = useState<Team['level']>('VARSITY');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof teamsApi.create>[1]) =>
      teamsApi.create(schoolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', schoolId] });
      onClose();
      setName('');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name, sport, level });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Team">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create team'}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Team Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Varsity Football"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sport
          </label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Level
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as Team['level'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

**Step 3: Create TeamsTab component**

```tsx
// frontend/src/components/TeamsTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '../api/teams';
import { CreateTeamModal } from './CreateTeamModal';

interface TeamsTabProps {
  schoolId: string;
}

export function TeamsTab({ schoolId }: TeamsTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams', schoolId],
    queryFn: () => teamsApi.list(schoolId),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Teams</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Add Team
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : teams?.length === 0 ? (
        <p className="text-gray-500">No teams yet. Create your first team!</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sport</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teams?.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{team.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{team.sport}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{team.level.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTeamModal
        schoolId={schoolId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
```

**Step 4: Wire up TeamsTab in SchoolDetail**

```tsx
// frontend/src/pages/SchoolDetail.tsx - update imports and tab content
import { TeamsTab } from '../components/TeamsTab';

// Replace teams tab placeholder:
{activeTab === 'teams' && <TeamsTab schoolId={schoolId!} />}
```

**Step 5: Verify in browser**

Run: Navigate to school detail, click Teams tab, add a team
Expected: Team table shows, modal works, new team appears

**Step 6: Commit**

```bash
git add frontend/src/api/teams.ts frontend/src/components/TeamsTab.tsx frontend/src/components/CreateTeamModal.tsx frontend/src/pages/SchoolDetail.tsx
git commit -m "feat: add teams tab with create team modal"
```

---

## Task 6: Facilities Tab

**Files:**
- Create: `frontend/src/api/facilities.ts`
- Create: `frontend/src/components/FacilitiesTab.tsx`
- Create: `frontend/src/components/CreateFacilityModal.tsx`
- Modify: `frontend/src/pages/SchoolDetail.tsx`

**Step 1: Create facilities API functions**

```tsx
// frontend/src/api/facilities.ts
import { api } from './client';

export interface Facility {
  id: string;
  schoolId: string;
  name: string;
  type: 'GYM' | 'FIELD' | 'POOL' | 'COURT' | 'TRACK' | 'OTHER';
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFacilityInput {
  name: string;
  type: Facility['type'];
  capacity?: number;
}

export const facilitiesApi = {
  list: async (schoolId: string): Promise<Facility[]> => {
    const { data } = await api.get(`/schools/${schoolId}/facilities`);
    return data.data;
  },

  create: async (schoolId: string, input: CreateFacilityInput): Promise<Facility> => {
    const { data } = await api.post(`/schools/${schoolId}/facilities`, input);
    return data.data;
  },

  delete: async (schoolId: string, facilityId: string): Promise<void> => {
    await api.delete(`/schools/${schoolId}/facilities/${facilityId}`);
  },
};
```

**Step 2: Create CreateFacilityModal component**

```tsx
// frontend/src/components/CreateFacilityModal.tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { facilitiesApi, type Facility } from '../api/facilities';

interface CreateFacilityModalProps {
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

const FACILITY_TYPES: Facility['type'][] = ['GYM', 'FIELD', 'POOL', 'COURT', 'TRACK', 'OTHER'];

export function CreateFacilityModal({ schoolId, isOpen, onClose }: CreateFacilityModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Facility['type']>('FIELD');
  const [capacity, setCapacity] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof facilitiesApi.create>[1]) =>
      facilitiesApi.create(schoolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities', schoolId] });
      onClose();
      setName('');
      setCapacity('');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name,
      type,
      capacity: capacity ? parseInt(capacity, 10) : undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Facility">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create facility'}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Facility Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Main Gymnasium"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Facility['type'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FACILITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Capacity (optional)
          </label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g., 500"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Adding...' : 'Add Facility'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

**Step 3: Create FacilitiesTab component**

```tsx
// frontend/src/components/FacilitiesTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facilitiesApi } from '../api/facilities';
import { CreateFacilityModal } from './CreateFacilityModal';

interface FacilitiesTabProps {
  schoolId: string;
}

export function FacilitiesTab({ schoolId }: FacilitiesTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: facilities, isLoading } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Facilities</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Add Facility
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : facilities?.length === 0 ? (
        <p className="text-gray-500">No facilities yet. Add your first facility!</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {facilities?.map((facility) => (
                <tr key={facility.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{facility.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{facility.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{facility.capacity ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateFacilityModal
        schoolId={schoolId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
```

**Step 4: Wire up FacilitiesTab in SchoolDetail**

```tsx
// frontend/src/pages/SchoolDetail.tsx - add import and replace placeholder
import { FacilitiesTab } from '../components/FacilitiesTab';

// Replace facilities tab placeholder:
{activeTab === 'facilities' && <FacilitiesTab schoolId={schoolId!} />}
```

**Step 5: Commit**

```bash
git add frontend/src/api/facilities.ts frontend/src/components/FacilitiesTab.tsx frontend/src/components/CreateFacilityModal.tsx frontend/src/pages/SchoolDetail.tsx
git commit -m "feat: add facilities tab with create facility modal"
```

---

## Task 7: Seasons Tab

**Files:**
- Create: `frontend/src/api/seasons.ts`
- Create: `frontend/src/components/SeasonsTab.tsx`
- Create: `frontend/src/components/CreateSeasonModal.tsx`
- Modify: `frontend/src/pages/SchoolDetail.tsx`

**Step 1: Create seasons API functions**

```tsx
// frontend/src/api/seasons.ts
import { api } from './client';

export interface Season {
  id: string;
  schoolId: string;
  name: string;
  sport: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeasonInput {
  name: string;
  sport: string;
  startDate: string;
  endDate: string;
}

export const seasonsApi = {
  list: async (schoolId: string): Promise<Season[]> => {
    const { data } = await api.get(`/schools/${schoolId}/seasons`);
    return data.data;
  },

  create: async (schoolId: string, input: CreateSeasonInput): Promise<Season> => {
    const { data } = await api.post(`/schools/${schoolId}/seasons`, input);
    return data.data;
  },

  delete: async (schoolId: string, seasonId: string): Promise<void> => {
    await api.delete(`/schools/${schoolId}/seasons/${seasonId}`);
  },
};
```

**Step 2: Create CreateSeasonModal component**

```tsx
// frontend/src/components/CreateSeasonModal.tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { seasonsApi } from '../api/seasons';

interface CreateSeasonModalProps {
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

const SPORTS = [
  'Football', 'Basketball', 'Baseball', 'Softball', 'Soccer',
  'Volleyball', 'Track & Field', 'Cross Country', 'Swimming',
  'Tennis', 'Golf', 'Wrestling', 'Lacrosse', 'Hockey',
];

export function CreateSeasonModal({ schoolId, isOpen, onClose }: CreateSeasonModalProps) {
  const [name, setName] = useState('');
  const [sport, setSport] = useState('Football');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof seasonsApi.create>[1]) =>
      seasonsApi.create(schoolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons', schoolId] });
      onClose();
      setName('');
      setStartDate('');
      setEndDate('');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name, sport, startDate, endDate });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Season">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create season'}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Season Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Fall 2026 Football"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sport
          </label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create Season'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

**Step 3: Create SeasonsTab component**

```tsx
// frontend/src/components/SeasonsTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { seasonsApi } from '../api/seasons';
import { CreateSeasonModal } from './CreateSeasonModal';

interface SeasonsTabProps {
  schoolId: string;
}

export function SeasonsTab({ schoolId }: SeasonsTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: seasons, isLoading } = useQuery({
    queryKey: ['seasons', schoolId],
    queryFn: () => seasonsApi.list(schoolId),
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Seasons</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Add Season
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : seasons?.length === 0 ? (
        <p className="text-gray-500">No seasons yet. Create your first season!</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sport</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {seasons?.map((season) => (
                <tr key={season.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{season.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{season.sport}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(season.startDate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(season.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateSeasonModal
        schoolId={schoolId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
```

**Step 4: Wire up SeasonsTab in SchoolDetail**

```tsx
// frontend/src/pages/SchoolDetail.tsx - add import and replace placeholder
import { SeasonsTab } from '../components/SeasonsTab';

// Replace seasons tab placeholder:
{activeTab === 'seasons' && <SeasonsTab schoolId={schoolId!} />}
```

**Step 5: Commit**

```bash
git add frontend/src/api/seasons.ts frontend/src/components/SeasonsTab.tsx frontend/src/components/CreateSeasonModal.tsx frontend/src/pages/SchoolDetail.tsx
git commit -m "feat: add seasons tab with create season modal"
```

---

## Task 8: School Settings Tab

**Files:**
- Create: `frontend/src/components/SettingsTab.tsx`
- Modify: `frontend/src/pages/SchoolDetail.tsx`

**Step 1: Create SettingsTab component**

```tsx
// frontend/src/components/SettingsTab.tsx
import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { schoolsApi, type School } from '../api/schools';

interface SettingsTabProps {
  school: School;
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
];

export function SettingsTab({ school }: SettingsTabProps) {
  const [name, setName] = useState(school.name);
  const [timezone, setTimezone] = useState(school.timezone);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setName(school.name);
    setTimezone(school.timezone);
  }, [school]);

  const mutation = useMutation({
    mutationFn: (input: { name: string; timezone: string }) =>
      schoolsApi.update(school.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school', school.id] });
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name, timezone });
  };

  const hasChanges = name !== school.name || timezone !== school.timezone;

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold mb-4">School Settings</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to update'}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded text-sm">
            Settings saved successfully!
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            School Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={mutation.isPending || !hasChanges}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Wire up SettingsTab in SchoolDetail**

```tsx
// frontend/src/pages/SchoolDetail.tsx - add import and replace placeholder
import { SettingsTab } from '../components/SettingsTab';

// Replace settings tab placeholder:
{activeTab === 'settings' && <SettingsTab school={school} />}
```

**Step 3: Commit**

```bash
git add frontend/src/components/SettingsTab.tsx frontend/src/pages/SchoolDetail.tsx
git commit -m "feat: add school settings tab"
```

---

## Task 9: Empty States

**Files:**
- Create: `frontend/src/components/EmptyState.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/components/TeamsTab.tsx`
- Modify: `frontend/src/components/FacilitiesTab.tsx`
- Modify: `frontend/src/components/SeasonsTab.tsx`

**Step 1: Create EmptyState component**

```tsx
// frontend/src/components/EmptyState.tsx
interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4 bg-white rounded-lg border-2 border-dashed border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

**Step 2: Update Dashboard empty state**

```tsx
// In Dashboard.tsx, replace the grid when no schools:
{schools?.length === 0 ? (
  <EmptyState
    title="No schools yet"
    description="Create your first school to get started with AthleticOS."
    action={{
      label: '+ Create School',
      onClick: () => setIsCreateModalOpen(true),
    }}
  />
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {schools?.map((school) => (
      <SchoolCard key={school.id} school={school} />
    ))}
  </div>
)}
```

**Step 3: Update TeamsTab, FacilitiesTab, SeasonsTab**

Replace the simple "No X yet" messages with EmptyState component in each tab file.

**Step 4: Commit**

```bash
git add frontend/src/components/EmptyState.tsx frontend/src/pages/Dashboard.tsx frontend/src/components/TeamsTab.tsx frontend/src/components/FacilitiesTab.tsx frontend/src/components/SeasonsTab.tsx
git commit -m "feat: add empty state components for better UX"
```

---

## Task 10: Navigation Polish

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/pages/SchoolDetail.tsx`

**Step 1: Add schools list to sidebar**

```tsx
// frontend/src/components/Sidebar.tsx - add schools navigation
import { useQuery } from '@tanstack/react-query';
import { schoolsApi } from '../api/schools';

// Inside Sidebar component, after Dashboard NavLink:
const { data: schools } = useQuery({
  queryKey: ['schools'],
  queryFn: schoolsApi.list,
});

// Add schools section in nav:
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
```

**Step 2: Add breadcrumb styling to SchoolDetail**

```tsx
// frontend/src/pages/SchoolDetail.tsx - improve breadcrumb
<nav className="text-sm mb-4">
  <Link to="/" className="text-gray-500 hover:text-gray-700">Dashboard</Link>
  <span className="mx-2 text-gray-400">/</span>
  <span className="text-gray-900">{school.name}</span>
</nav>
```

**Step 3: Verify navigation**

Run: Click through dashboard, schools, tabs
Expected: Active states work, breadcrumbs show, sidebar shows school list

**Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/pages/SchoolDetail.tsx
git commit -m "feat: polish navigation with schools in sidebar and breadcrumbs"
```

---

## Verification

After all tasks complete:

1. **Login flow**: Register or login works
2. **Dashboard**: Shows schools grid, create button works
3. **School detail**: Tabs work, all CRUD operations function
4. **Navigation**: Sidebar shows schools, breadcrumbs work
5. **Empty states**: Nice UX when no data

Run full test:
```bash
# Start services
docker compose up -d

# Open browser
open http://localhost:3005
```
