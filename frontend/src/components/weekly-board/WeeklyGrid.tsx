// frontend/src/components/weekly-board/WeeklyGrid.tsx
import { useCallback } from 'react';
import { EventCard } from './EventCard';
import type { UpcomingEvent } from '../../api/events';

interface WeeklyGridProps {
  weekStart: Date;
  events: UpcomingEvent[];
  selectedEventId: string | null;
  onEventClick: (event: UpcomingEvent) => void;
  onSlotClick: (date: Date, hour: number, minute: number, rect: DOMRect) => void;
}

// Grid constants
const START_HOUR = 7;
const END_HOUR = 22; // 10pm
const SLOT_HEIGHT = 28; // px per 30-min slot
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2; // 30 half-hour slots

function getDayDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function formatTimeLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** Calculate top offset in px for a given time within the grid */
function timeToTopPx(hour: number, minute: number): number {
  const slotsFromStart = (hour - START_HOUR) * 2 + minute / 30;
  return slotsFromStart * SLOT_HEIGHT;
}

/** Estimate height in px for a duration */
function durationToHeightPx(durationMinutes: number): number {
  return (durationMinutes / 30) * SLOT_HEIGHT;
}

/** Default duration estimate when not available from event data */
const DEFAULT_DURATION = 90;

export function WeeklyGrid({ weekStart, events, selectedEventId, onEventClick, onSlotClick }: WeeklyGridProps) {
  const dayDates = getDayDates(weekStart);

  // Group events by day column index
  const eventsByDay: Map<number, UpcomingEvent[]> = new Map();
  for (const event of events) {
    const eventDate = new Date(event.datetime);
    const dayIndex = dayDates.findIndex(d => isSameDay(d, eventDate));
    if (dayIndex >= 0) {
      if (!eventsByDay.has(dayIndex)) eventsByDay.set(dayIndex, []);
      eventsByDay.get(dayIndex)!.push(event);
    }
  }

  const handleSlotClick = useCallback((e: React.MouseEvent<HTMLDivElement>, dayIndex: number) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slotIndex = Math.floor(y / SLOT_HEIGHT);
    const hour = START_HOUR + Math.floor(slotIndex / 2);
    const minute = (slotIndex % 2) * 30;
    onSlotClick(dayDates[dayIndex], hour, minute, rect);
  }, [dayDates, onSlotClick]);

  // Time labels
  const timeLabels: { hour: number; label: string }[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    timeLabels.push({ hour: h, label: formatTimeLabel(h) });
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
        <div className="p-2 text-xs text-gray-400" />
        {dayDates.map((date, i) => (
          <div
            key={i}
            className={`p-2 text-center text-sm font-medium border-l border-gray-200 ${
              isToday(date)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700'
            }`}
          >
            {formatDayHeader(date)}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] overflow-y-auto" style={{ maxHeight: '700px' }}>
        {/* Time column */}
        <div className="relative">
          {timeLabels.map(({ hour, label }) => (
            <div
              key={hour}
              className="text-xs text-gray-400 text-right pr-2 border-b border-gray-100"
              style={{ height: SLOT_HEIGHT * 2 }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {dayDates.map((date, dayIndex) => {
          const dayEvents = eventsByDay.get(dayIndex) || [];

          return (
            <div
              key={dayIndex}
              className={`relative border-l border-gray-200 cursor-pointer ${
                isToday(date) ? 'bg-blue-50/30' : ''
              }`}
              style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }}
              onClick={(e) => handleSlotClick(e, dayIndex)}
            >
              {/* Half-hour gridlines */}
              {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                <div
                  key={i}
                  className={`absolute w-full ${
                    i % 2 === 0 ? 'border-b border-gray-200' : 'border-b border-gray-100'
                  }`}
                  style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                />
              ))}

              {/* Events */}
              {dayEvents.map((event) => {
                const eventDate = new Date(event.datetime);
                const hour = eventDate.getHours();
                const minute = eventDate.getMinutes();
                const topPx = timeToTopPx(hour, minute);
                const heightPx = durationToHeightPx(DEFAULT_DURATION);

                return (
                  <EventCard
                    key={`${event.type}-${event.id}`}
                    event={event}
                    topPx={topPx}
                    heightPx={heightPx}
                    onClick={onEventClick}
                    isSelected={selectedEventId === event.id}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
