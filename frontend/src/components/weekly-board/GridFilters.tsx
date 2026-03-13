// frontend/src/components/weekly-board/GridFilters.tsx

interface FilterOption {
  value: string;
  label: string;
}

interface GridFiltersProps {
  teams: FilterOption[];
  facilities: FilterOption[];
  selectedTeam: string;
  selectedFacility: string;
  selectedType: string;
  onTeamChange: (value: string) => void;
  onFacilityChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}

export function GridFilters({
  teams,
  facilities,
  selectedTeam,
  selectedFacility,
  selectedType,
  onTeamChange,
  onFacilityChange,
  onTypeChange,
}: GridFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select
        value={selectedTeam}
        onChange={(e) => onTeamChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Teams</option>
        {teams.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <select
        value={selectedFacility}
        onChange={(e) => onFacilityChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Facilities</option>
        {facilities.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Types</option>
        <option value="game">Games</option>
        <option value="practice">Practices</option>
      </select>
    </div>
  );
}
