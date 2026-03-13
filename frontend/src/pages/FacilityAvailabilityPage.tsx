// frontend/src/pages/FacilityAvailabilityPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { AvailabilityCalendar } from '../components/facility-requests/AvailabilityCalendar';
import { facilitiesApi } from '../api/facilities';

export function FacilityAvailabilityPage() {
  const { schoolId, facilityId } = useParams<{ schoolId: string; facilityId: string }>();

  // Default to this week
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [from, setFrom] = useState(today.toISOString().slice(0, 10));
  const [to, setTo] = useState(weekEnd.toISOString().slice(0, 10));

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId!),
    enabled: !!schoolId,
  });

  const facility = facilities.find((f: any) => f.id === facilityId);

  if (!schoolId || !facilityId) return null;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {facility ? `${facility.name} - Availability` : 'Facility Availability'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View booked and open time slots for this facility.
          </p>
        </div>

        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        <AvailabilityCalendar schoolId={schoolId} facilityId={facilityId} from={from} to={to} />
      </div>
    </Layout>
  );
}
