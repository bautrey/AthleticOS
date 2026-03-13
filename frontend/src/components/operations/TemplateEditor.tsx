// frontend/src/components/operations/TemplateEditor.tsx
import { useState } from 'react';
import { useTemplates, useCreateTemplate } from '../../hooks/useOperations';
import type { TemplateItem } from '../../api/operations';

interface TemplateEditorProps {
  schoolId: string;
}

const EMPTY_ITEM: TemplateItem = { title: '', description: '' };

export function TemplateEditor({ schoolId }: TemplateEditorProps) {
  const { data: templates = [], isLoading } = useTemplates(schoolId);
  const createMutation = useCreateTemplate(schoolId);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([{ ...EMPTY_ITEM }]);

  const resetForm = () => {
    setName('');
    setItems([{ ...EMPTY_ITEM }]);
    setShowForm(false);
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof TemplateItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(item => item.title.trim());
    if (!name.trim() || validItems.length === 0) return;

    await createMutation.mutateAsync({
      name: name.trim(),
      items: validItems,
    });
    resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Operations Templates</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            New Template
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Home Game Prep"
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Items list */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Checklist Items</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.title}
                    onChange={e => handleItemChange(idx, 'title', e.target.value)}
                    placeholder="Item title"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={e => handleItemChange(idx, 'description', e.target.value)}
                    placeholder="Description (optional)"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-red-500 hover:text-red-700 text-sm px-1"
                    disabled={items.length <= 1}
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              + Add Item
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Template'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Templates list */}
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-6 text-center">
          No operations templates yet. Create one to auto-generate checklists for events.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(template => (
            <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{template.name}</span>
                <span className="text-xs text-gray-500">
                  {new Date(template.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {(template.items as TemplateItem[]).length} items
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
