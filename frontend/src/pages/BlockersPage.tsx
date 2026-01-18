// frontend/src/pages/BlockersPage.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { EmptyState } from '../components/EmptyState';
import { BlockerCard } from '../components/blockers/BlockerCard';
import { BlockerForm } from '../components/blockers/BlockerForm';
import { useBlockers, useDeleteBlocker } from '../hooks/useBlockers';
import { schoolsApi } from '../api/schools';
import { teamsApi } from '../api/teams';
import { facilitiesApi } from '../api/facilities';
import type { Blocker, BlockerType, BlockerScope } from '../api/blockers';
import { BLOCKER_TYPE_LABELS } from '../components/blockers/BlockerTypeIcon';

const SCOPE_LABELS: Record<BlockerScope, string> = {
  SCHOOL_WIDE: 'School-wide',
  TEAM: 'Team',
  FACILITY: 'Facility',
};

export function BlockersPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBlocker, setEditingBlocker] = useState<Blocker | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Blocker | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<BlockerType | ''>('');
  const [scopeFilter, setScopeFilter] = useState<BlockerScope | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Queries
  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolsApi.get(schoolId!),
    enabled: !!schoolId,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams', schoolId],
    queryFn: () => teamsApi.list(schoolId!),
    enabled: !!schoolId,
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId!),
    enabled: !!schoolId,
  });

  const query = {
    page,
    limit,
    ...(typeFilter && { type: typeFilter }),
    ...(scopeFilter && { scope: scopeFilter }),
  };

  const { data: blockersData, isLoading: blockersLoading } = useBlockers(schoolId!, query);
  const deleteMutation = useDeleteBlocker(schoolId!);

  // Helper maps for entity names
  const teamMap = new Map(teams?.map((t) => [t.id, t.name]) || []);
  const facilityMap = new Map(facilities?.map((f) => [f.id, f.name]) || []);

  const handleCreateSuccess = (conflictCount: number) => {
    if (conflictCount > 0) {
      setSuccessMessage(`Blocker created. ${conflictCount} existing event(s) conflict with this blocker.`);
    } else {
      setSuccessMessage('Blocker created successfully.');
    }
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleEditSuccess = (conflictCount: number) => {
    if (conflictCount > 0) {
      setSuccessMessage(`Blocker updated. ${conflictCount} existing event(s) conflict with this blocker.`);
    } else {
      setSuccessMessage('Blocker updated successfully.');
    }
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
      setSuccessMessage('Blocker deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleRowClick = (blocker: Blocker) => {
    setEditingBlocker(blocker);
  };

  if (schoolLoading) {
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

  const blockers = blockersData?.data || [];
  const meta = blockersData?.meta;
  const totalPages = meta?.totalPages || 1;

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="mb-6">
        <nav className="text-sm mb-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">Dashboard</Link>
          <span className="mx-2 text-gray-400">/</span>
          <Link to={`/schools/${schoolId}`} className="text-gray-500 hover:text-gray-700">{school.name}</Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-900">Blockers</span>
        </nav>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Blockers</h1>
            <p className="text-gray-500">Manage scheduling blockers for {school.name}</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            data-testid="create-blocker-button"
          >
            + Create Blocker
          </button>
        </div>
      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="mb-4 bg-green-50 text-green-700 p-4 rounded-md text-sm flex items-center justify-between" data-testid="success-toast">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">&times;</button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as BlockerType | '');
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {Object.entries(BLOCKER_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Scope</label>
          <select
            value={scopeFilter}
            onChange={(e) => {
              setScopeFilter(e.target.value as BlockerScope | '');
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Scopes</option>
            {Object.entries(SCOPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Blockers List */}
      {blockersLoading ? (
        <p className="text-gray-500">Loading blockers...</p>
      ) : blockers.length === 0 ? (
        <EmptyState
          title="No blockers found"
          description={typeFilter || scopeFilter ? 'Try adjusting your filters.' : 'Create your first blocker to start managing schedule constraints.'}
          action={!typeFilter && !scopeFilter ? {
            label: '+ Create Blocker',
            onClick: () => setIsCreateModalOpen(true),
          } : undefined}
        />
      ) : (
        <>
          <div className="space-y-3" data-testid="blockers-list">
            {blockers.map((blocker) => (
              <div key={blocker.id} className="relative group">
                <BlockerCard
                  blocker={blocker}
                  onClick={() => handleRowClick(blocker)}
                  teamName={blocker.teamId ? teamMap.get(blocker.teamId) : undefined}
                  facilityName={blocker.facilityId ? facilityMap.get(blocker.facilityId) : undefined}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(blocker);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                  data-testid="delete-blocker"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages} ({meta?.total} total)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <BlockerForm
        schoolId={schoolId!}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Modal */}
      <BlockerForm
        schoolId={schoolId!}
        isOpen={!!editingBlocker}
        onClose={() => setEditingBlocker(null)}
        blocker={editingBlocker}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto" data-testid="confirm-delete-dialog">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setDeleteConfirm(null)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
              <h3 className="text-lg font-semibold mb-2">Delete Blocker</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  data-testid="confirm-delete"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
