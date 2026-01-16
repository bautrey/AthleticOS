// frontend/src/components/conflicts/ConflictWarningModal.tsx
import { useState } from 'react';
import { Modal } from '../Modal';
import type { Conflict } from '../../api/conflicts';

interface ConflictWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (reason?: string) => void;
  conflicts: Conflict[];
  eventType: 'game' | 'practice';
}

const formatDateRange = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };

  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
};

export function ConflictWarningModal({
  isOpen,
  onClose,
  onProceed,
  conflicts,
  eventType,
}: ConflictWarningModalProps) {
  const [overrideReason, setOverrideReason] = useState('');

  const handleProceed = () => {
    onProceed(overrideReason || undefined);
    setOverrideReason('');
  };

  const handleClose = () => {
    setOverrideReason('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-amber-600">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold">Schedule Conflict Detected</h3>
        </div>

        <p className="text-sm text-gray-600">
          This {eventType} conflicts with {conflicts.length} blocker
          {conflicts.length !== 1 && 's'}:
        </p>

        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {conflicts.map((conflict) => (
            <li
              key={conflict.blockerId}
              className="p-3 bg-amber-50 rounded-lg border border-amber-200"
            >
              <div className="font-medium text-amber-800">
                {conflict.blockerName}
              </div>
              <div className="text-sm text-amber-600">{conflict.reason}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatDateRange(conflict.startDatetime, conflict.endDatetime)}
              </div>
            </li>
          ))}
        </ul>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for override (optional)
          </label>
          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="e.g., League-mandated game, cannot reschedule"
            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Go Back & Fix
          </button>
          <button
            type="button"
            onClick={handleProceed}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
          >
            Save Anyway
          </button>
        </div>
      </div>
    </Modal>
  );
}
