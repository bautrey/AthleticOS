// frontend/src/components/weekly-board/InlineEventEditor.tsx
import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { practicesApi } from '../../api/practices';
import { gamesApi } from '../../api/games';
import type { UpcomingEvent } from '../../api/events';

interface InlineEventEditorProps {
  event: UpcomingEvent;
  position: { top: number; left: number };
  onClose: () => void;
}

const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export function InlineEventEditor({ event, position, onClose }: InlineEventEditorProps) {
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (event.type === 'game') {
        return gamesApi.delete(event.id);
      }
      return practicesApi.delete(event.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['practices'] });
      queryClient.invalidateQueries({ queryKey: ['games'] });
      onClose();
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const isGame = event.type === 'game';

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72"
      style={{ top: position.top, left: position.left }}
    >
      {showDeleteConfirm ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Delete this {event.type}?</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Event header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-block w-3 h-3 rounded-full ${isGame ? 'bg-blue-500' : 'bg-green-500'}`} />
              <span className="text-sm font-semibold text-gray-800">
                {event.teamName}
              </span>
              <span className="text-xs text-gray-500 uppercase">{event.type}</span>
            </div>
            {isGame && event.opponent && (
              <div className="text-sm text-gray-600 ml-5">vs {event.opponent}</div>
            )}
          </div>

          {/* Details */}
          <div className="text-sm text-gray-600 space-y-1">
            <div>{formatDate(event.datetime)} at {formatTime(event.datetime)}</div>
            {event.facilityName && <div>@ {event.facilityName}</div>}
            {event.hasConflicts && (
              <div className="text-amber-600 font-medium">
                {event.conflictCount} conflict{event.conflictCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Notes (informational) */}
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes..."
              rows={2}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
