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
