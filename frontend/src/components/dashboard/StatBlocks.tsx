// frontend/src/components/dashboard/StatBlocks.tsx
import { Link } from 'react-router-dom';

interface StatBlocksProps {
  schoolId: string;
  stats: {
    teams: number;
    seasons: number;
    conflicts: number;
    upcomingEvents: number;
  };
}

export function StatBlocks({ schoolId, stats }: StatBlocksProps) {
  const blocks = [
    { label: 'Teams', value: stats.teams, color: 'text-blue-600', link: `/schools/${schoolId}` },
    { label: 'Active Seasons', value: stats.seasons, color: 'text-purple-600', link: `/schools/${schoolId}` },
    { label: 'Conflicts', value: stats.conflicts, color: stats.conflicts > 0 ? 'text-amber-600' : 'text-green-600', link: `/schools/${schoolId}/conflicts` },
    { label: 'Upcoming Events', value: stats.upcomingEvents, color: 'text-gray-900' },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
      {blocks.map((block) => {
        const content = (
          <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
            <div className={`text-2xl font-bold ${block.color}`}>{block.value}</div>
            <div className="text-sm text-gray-500 mt-1">{block.label}</div>
          </div>
        );

        return block.link ? (
          <Link key={block.label} to={block.link}>{content}</Link>
        ) : (
          <div key={block.label}>{content}</div>
        );
      })}
    </div>
  );
}
