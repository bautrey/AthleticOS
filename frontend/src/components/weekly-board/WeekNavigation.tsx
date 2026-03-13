// frontend/src/components/weekly-board/WeekNavigation.tsx

interface WeekNavigationProps {
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

const formatDateRange = (start: Date): string => {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
};

export function WeekNavigation({ weekStart, onPrevWeek, onNextWeek, onToday }: WeekNavigationProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onPrevWeek}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
        aria-label="Previous week"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={onToday}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
      >
        Today
      </button>

      <button
        onClick={onNextWeek}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
        aria-label="Next week"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <h2 className="text-lg font-semibold text-gray-900 ml-2">
        {formatDateRange(weekStart)}
      </h2>
    </div>
  );
}
