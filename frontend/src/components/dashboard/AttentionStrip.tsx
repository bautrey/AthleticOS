// frontend/src/components/dashboard/AttentionStrip.tsx
import { Link } from 'react-router-dom';

interface AttentionStripProps {
  schoolId: string;
  conflictCount: number;
  activeBlockerCount: number;
}

export function AttentionStrip({ schoolId, conflictCount, activeBlockerCount }: AttentionStripProps) {
  if (conflictCount === 0 && activeBlockerCount === 0) return null;

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {conflictCount > 0 && (
                <>{conflictCount} scheduling conflict{conflictCount !== 1 ? 's' : ''} detected</>
              )}
              {conflictCount > 0 && activeBlockerCount > 0 && ' &middot; '}
              {activeBlockerCount > 0 && (
                <>{activeBlockerCount} active blocker{activeBlockerCount !== 1 ? 's' : ''}</>
              )}
            </p>
          </div>
        </div>
        <Link
          to={`/schools/${schoolId}/conflicts`}
          className="text-sm font-medium text-amber-700 hover:text-amber-900 hover:underline"
        >
          Review conflicts &rarr;
        </Link>
      </div>
    </div>
  );
}
