// frontend/src/pages/FacilityRequestsPage.tsx
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { FacilityRequestForm } from '../components/facility-requests/FacilityRequestForm';
import { RequestQueue } from '../components/facility-requests/RequestQueue';
import { useAuth } from '../hooks/useAuth';

export function FacilityRequestsPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const { user } = useAuth();

  if (!schoolId) return null;

  const school = user?.schools.find((s) => s.id === schoolId);
  const canReview = school?.role === 'ADMIN' || school?.role === 'ATHLETIC_DIRECTOR';

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Facility Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Submit and manage facility booking requests.
          </p>
        </div>

        <FacilityRequestForm schoolId={schoolId} />
        <RequestQueue schoolId={schoolId} canReview={canReview} />
      </div>
    </Layout>
  );
}
