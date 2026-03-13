// frontend/src/components/weekly-board/SlotPopover.tsx
import { useState, useEffect, useRef, type FormEvent } from 'react';

interface SlotPopoverProps {
  date: Date;
  hour: number;
  minute: number;
  position: { top: number; left: number };
  onClose: () => void;
  onCreateGame: (datetime: string) => void;
  onCreatePractice: (datetime: string) => void;
}

export function SlotPopover({
  date,
  hour,
  minute,
  position,
  onClose,
  onCreateGame,
  onCreatePractice,
}: SlotPopoverProps) {
  const [eventType, setEventType] = useState<'game' | 'practice'>('practice');
  const ref = useRef<HTMLDivElement>(null);

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

  const datetime = new Date(date);
  datetime.setHours(hour, minute, 0, 0);
  const isoString = datetime.toISOString();

  const timeStr = datetime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const dateStr = datetime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (eventType === 'game') {
      onCreateGame(isoString);
    } else {
      onCreatePractice(isoString);
    }
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-64"
      style={{ top: position.top, left: position.left }}
    >
      <div className="text-sm font-medium text-gray-800 mb-3">
        {dateStr} at {timeStr}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEventType('practice')}
            className={`flex-1 px-3 py-1.5 text-sm rounded-md border ${
              eventType === 'practice'
                ? 'bg-green-50 border-green-300 text-green-800'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Practice
          </button>
          <button
            type="button"
            onClick={() => setEventType('game')}
            className={`flex-1 px-3 py-1.5 text-sm rounded-md border ${
              eventType === 'game'
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Game
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
