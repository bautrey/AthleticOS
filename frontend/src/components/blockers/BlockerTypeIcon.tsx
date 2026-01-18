// frontend/src/components/blockers/BlockerTypeIcon.tsx
import {
  AcademicCapIcon,
  WrenchIcon,
  CalendarIcon,
  TruckIcon,
  HomeIcon,
  CloudIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import type { BlockerType } from '../../api/blockers';

export const BLOCKER_TYPE_ICONS: Record<BlockerType, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  EXAM: AcademicCapIcon,
  MAINTENANCE: WrenchIcon,
  EVENT: CalendarIcon,
  TRAVEL: TruckIcon,
  HOLIDAY: HomeIcon,
  WEATHER: CloudIcon,
  CUSTOM: TagIcon,
};

export const BLOCKER_TYPE_LABELS: Record<BlockerType, string> = {
  EXAM: 'Exam Period',
  MAINTENANCE: 'Maintenance',
  EVENT: 'School Event',
  TRAVEL: 'Travel Blackout',
  HOLIDAY: 'Holiday',
  WEATHER: 'Weather',
  CUSTOM: 'Custom',
};

export const BLOCKER_TYPE_COLORS: Record<BlockerType, string> = {
  EXAM: 'text-purple-600',
  MAINTENANCE: 'text-orange-600',
  EVENT: 'text-blue-600',
  TRAVEL: 'text-green-600',
  HOLIDAY: 'text-red-600',
  WEATHER: 'text-cyan-600',
  CUSTOM: 'text-gray-600',
};

interface BlockerTypeIconProps {
  type: BlockerType;
  className?: string;
}

export function BlockerTypeIcon({ type, className = 'h-5 w-5' }: BlockerTypeIconProps) {
  const Icon = BLOCKER_TYPE_ICONS[type];
  const colorClass = BLOCKER_TYPE_COLORS[type];
  return <Icon className={`${className} ${colorClass}`} />;
}
