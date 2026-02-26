// frontend/src/pages/PriorityRulesPage.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { Tabs } from '../components/Tabs';
import { PriorityRulesForm } from '../components/priority-rules/PriorityRulesForm';
import { PriorityAuditLog } from '../components/priority-rules/PriorityAuditLog';
import { usePriorityRules } from '../hooks/usePriorityRules';
import { schoolsApi } from '../api/schools';

const TABS = [
  { id: 'configuration', label: 'Configuration' },
  { id: 'audit-log', label: 'Audit Log' },
];

export function PriorityRulesPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [activeTab, setActiveTab] = useState('configuration');

  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolsApi.get(schoolId!),
    enabled: !!schoolId,
  });

  const { data: rules, isLoading: rulesLoading } = usePriorityRules(schoolId!);

  if (schoolLoading || rulesLoading) {
    return (
      <Layout>
        <p className="text-gray-500">Loading...</p>
      </Layout>
    );
  }

  if (!school) {
    return (
      <Layout>
        <p className="text-red-500">School not found</p>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="mb-6">
        <nav className="text-sm mb-4">
          <Link to="/" className="text-gray-500 hover:text-gray-700">Dashboard</Link>
          <span className="mx-2 text-gray-400">/</span>
          <Link to={`/schools/${schoolId}`} className="text-gray-500 hover:text-gray-700">{school.name}</Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-900">Priority Rules</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold">Priority Rules</h1>
          <p className="text-gray-500">Configure how event priorities are calculated for {school.name}</p>
        </div>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'configuration' && rules && (
          <PriorityRulesForm schoolId={schoolId!} rules={rules} />
        )}
        {activeTab === 'audit-log' && (
          <PriorityAuditLog schoolId={schoolId!} />
        )}
      </Tabs>
    </Layout>
  );
}
