// frontend/src/pages/OperationsReadinessPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { TemplateEditor } from '../components/operations/TemplateEditor';
import { ReadinessGrid } from '../components/operations/ReadinessGrid';

type Tab = 'readiness' | 'templates';

export function OperationsReadinessPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('readiness');
  const [days, setDays] = useState(7);

  if (!schoolId) return null;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Operations</h1>
            <p className="text-sm text-gray-500">
              Track event readiness and manage operations templates
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('readiness')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 ${
                activeTab === 'readiness'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Readiness Dashboard
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Templates
            </button>
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'readiness' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Show next</label>
              <select
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
            <ReadinessGrid schoolId={schoolId} days={days} />
          </div>
        )}

        {activeTab === 'templates' && (
          <TemplateEditor schoolId={schoolId} />
        )}
      </div>
    </Layout>
  );
}
