// frontend/src/components/ShareScheduleModal.tsx
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from './Modal';
import { sharesApi, type CreateShareInput, type UpdateShareInput } from '../api/shares';

interface ShareScheduleModalProps {
  seasonId: string;
  seasonName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareScheduleModal({ seasonId, seasonName, isOpen, onClose }: ShareScheduleModalProps) {
  const [title, setTitle] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [showFacility, setShowFacility] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState<'url' | 'embed' | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const queryClient = useQueryClient();

  const { data: shares, isLoading } = useQuery({
    queryKey: ['shares', seasonId],
    queryFn: () => sharesApi.list(seasonId),
    enabled: isOpen,
  });

  // Get the first active share or null
  const activeShare = shares?.find((s) => s.isActive) || null;

  useEffect(() => {
    if (activeShare) {
      setTitle(activeShare.title || '');
      setShowNotes(activeShare.showNotes);
      setShowFacility(activeShare.showFacility);
      setExpiresAt(activeShare.expiresAt ? activeShare.expiresAt.split('T')[0] : '');
    } else {
      setTitle('');
      setShowNotes(false);
      setShowFacility(true);
      setExpiresAt('');
    }
  }, [activeShare]);

  const createMutation = useMutation({
    mutationFn: (input: CreateShareInput) => sharesApi.create(seasonId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', seasonId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ shareId, input }: { shareId: string; input: UpdateShareInput }) =>
      sharesApi.update(seasonId, shareId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', seasonId] });
      setIsEditing(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (shareId: string) =>
      sharesApi.update(seasonId, shareId, { isActive: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', seasonId] });
    },
  });

  const handleCreateShare = () => {
    createMutation.mutate({
      title: title || undefined,
      showNotes,
      showFacility,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
  };

  const handleUpdateShare = () => {
    if (!activeShare) return;
    updateMutation.mutate({
      shareId: activeShare.id,
      input: {
        title: title || undefined,
        showNotes,
        showFacility,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      },
    });
  };

  const handleDeactivate = () => {
    if (!activeShare) return;
    if (confirm('Are you sure you want to deactivate this share link? Anyone with the link will no longer be able to access the schedule.')) {
      deactivateMutation.mutate(activeShare.id);
    }
  };

  const copyToClipboard = async (text: string, type: 'url' | 'embed') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatViewCount = (count: number): string => {
    if (count === 0) return 'No views yet';
    if (count === 1) return '1 view';
    return `${count.toLocaleString()} views`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Schedule" size="lg">
      {isLoading ? (
        <div className="py-8 text-center text-gray-500">Loading...</div>
      ) : !activeShare ? (
        // No active share - show create form
        <div className="space-y-4">
          <p className="text-gray-600">
            Create a shareable link for "{seasonName}" so parents and players can view the schedule without logging in.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={seasonName}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showFacility}
                onChange={(e) => setShowFacility(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show facility names</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showNotes}
                onChange={(e) => setShowNotes(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show notes</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiration date (optional)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
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
              type="button"
              onClick={handleCreateShare}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Share Link'}
            </button>
          </div>
        </div>
      ) : (
        // Active share exists - show share details
        <div className="space-y-6">
          {/* QR Code and URL */}
          <div className="flex gap-6">
            <div className="flex-shrink-0 p-3 bg-white border rounded-lg">
              <QRCodeSVG
                value={activeShare.url}
                size={120}
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Share URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activeShare.url}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(activeShare.url, 'url')}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm whitespace-nowrap"
                  >
                    {copied === 'url' ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500">{formatViewCount(activeShare.viewCount)}</span>
                {activeShare.expiresAt && (
                  <span className="text-amber-600">
                    Expires: {new Date(activeShare.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Embed Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Embed Code
            </label>
            <div className="flex gap-2">
              <textarea
                readOnly
                value={activeShare.embedCode}
                rows={2}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(activeShare.embedCode, 'embed')}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm whitespace-nowrap"
              >
                {copied === 'embed' ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Paste this code into any website to embed the schedule.
            </p>
          </div>

          {/* Settings */}
          {isEditing ? (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900">Edit Settings</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={seasonName}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showFacility}
                    onChange={(e) => setShowFacility(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Show facility names</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showNotes}
                    onChange={(e) => setShowNotes(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Show notes</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration date
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-200 rounded-md text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateShare}
                  disabled={updateMutation.isPending}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600">
                <span className="font-medium">Settings:</span>{' '}
                {showFacility ? 'Facility names visible' : 'Facility names hidden'}
                {' · '}
                {showNotes ? 'Notes visible' : 'Notes hidden'}
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-700"
              >
                Edit
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={deactivateMutation.isPending}
              className="text-red-600 hover:text-red-700 text-sm"
            >
              {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate Link'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
