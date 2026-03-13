// frontend/src/components/quick-add/QuickAddBar.tsx
import { useState, useRef } from 'react';
import { useQuickAdd } from '../../hooks/useQuickAdd';
import { QuickAddPreview } from './QuickAddPreview';
import type { QuickAddResult } from '../../api/quickAdd';

interface QuickAddBarProps {
  schoolId: string;
  weekStartDate: string; // ISO date (Monday)
  seasonId?: string;
  onConfirmGame?: (data: {
    seasonId: string;
    opponent: string;
    datetime: string;
    facilityId?: string;
    homeAway?: string;
  }) => void;
  onConfirmPractice?: (data: {
    seasonId: string;
    datetime: string;
    durationMinutes?: number;
    facilityId?: string;
  }) => void;
  onOpenFullForm?: () => void;
}

export function QuickAddBar({
  schoolId,
  weekStartDate,
  seasonId,
  onConfirmGame,
  onConfirmPractice,
  onOpenFullForm,
}: QuickAddBarProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<QuickAddResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const quickAdd = useQuickAdd(schoolId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.trim().length < 3) return;

    const parsed = await quickAdd.mutateAsync({
      text: text.trim(),
      weekStartDate,
      seasonId,
    });
    setResult(parsed);
  };

  const handleConfirm = () => {
    if (!result?.parsed) return;
    const { parsed } = result;

    if (parsed.eventType === 'GAME' && parsed.seasonId && parsed.opponent && parsed.datetime) {
      onConfirmGame?.({
        seasonId: parsed.seasonId,
        opponent: parsed.opponent,
        datetime: parsed.datetime,
        facilityId: parsed.facilityId ?? undefined,
        homeAway: 'HOME',
      });
    } else if (parsed.eventType === 'PRACTICE' && parsed.seasonId && parsed.datetime) {
      onConfirmPractice?.({
        seasonId: parsed.seasonId,
        datetime: parsed.datetime,
        durationMinutes: parsed.durationMinutes ?? undefined,
        facilityId: parsed.facilityId ?? undefined,
      });
    }

    setText('');
    setResult(null);
  };

  const handleDismiss = () => {
    setResult(null);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Quick add: e.g. 'Varsity Football practice Tue 3:30-5pm @ Main Field'"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {quickAdd.isPending && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={quickAdd.isPending || text.trim().length < 3}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          Parse
        </button>
      </form>

      {/* Preview panel */}
      {result && (
        <QuickAddPreview
          result={result}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
          onOpenFullForm={onOpenFullForm}
        />
      )}
    </div>
  );
}
