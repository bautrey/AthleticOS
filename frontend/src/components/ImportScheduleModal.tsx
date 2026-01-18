// frontend/src/components/ImportScheduleModal.tsx
import { useState, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { detectAndParseCsv, type CsvParseResult, type ParsedGameRow, type ParsedPracticeRow } from '../utils/csvParser';
import { importApi, type ImportPreviewResult, type ImportRow } from '../api/import';
import { facilitiesApi } from '../api/facilities';

interface ImportScheduleModalProps {
  seasonId: string;
  schoolId: string;
  isOpen: boolean;
  onClose: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing';

export function ImportScheduleModal({ seasonId, schoolId, isOpen, onClose }: ImportScheduleModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvParseResult<ParsedGameRow> | CsvParseResult<ParsedPracticeRow> | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [facilityAssignments, setFacilityAssignments] = useState<Record<string, string>>({});
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: facilities } = useQuery({
    queryKey: ['facilities', schoolId],
    queryFn: () => facilitiesApi.list(schoolId),
    enabled: isOpen,
  });

  const previewMutation = useMutation({
    mutationFn: async ({ type, rows }: { type: 'games' | 'practices'; rows: ImportRow[] }) => {
      return importApi.preview(seasonId, type, rows);
    },
    onSuccess: (result) => {
      setPreviewResult(result);
      setStep('preview');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to preview import');
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!csvResult || !previewResult) return;

      const type = csvResult.type as 'games' | 'practices';
      const rows = csvResult.rows.map((r) => ({
        ...r,
        facility: 'facility' in r ? (r as ParsedGameRow).facility : null,
      })) as ImportRow[];

      return importApi.execute(seasonId, type, rows, {
        facilityAssignments,
        overrideConflicts: previewResult.rowsWithConflicts > 0,
        overrideReason: overrideReason || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games', seasonId] });
      queryClient.invalidateQueries({ queryKey: ['practices', seasonId] });
      queryClient.invalidateQueries({ queryKey: ['conflicts', seasonId] });
      handleClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to import');
    },
  });

  const handleClose = () => {
    setStep('upload');
    setCsvResult(null);
    setPreviewResult(null);
    setFacilityAssignments({});
    setOverrideReason('');
    setError(null);
    onClose();
  };

  const processFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const result = await detectAndParseCsv(file);

      if (result.type === 'unknown') {
        setError('Could not detect CSV type. For games, include columns: date, time, opponent, home_away. For practices, include columns: date, time, duration.');
        return;
      }

      setCsvResult(result);

      // Send to backend for preview
      const type = result.type as 'games' | 'practices';
      const rows = result.rows.map((r) => ({
        ...r,
        facility: 'facility' in r ? (r as ParsedGameRow).facility : null,
      })) as ImportRow[];

      previewMutation.mutate({ type, rows });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  }, [previewMutation]);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      processFile(file);
    } else {
      setError('Please upload a CSV file');
    }
  }, [processFile]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFacilityChange = (rowNum: number, facilityId: string) => {
    setFacilityAssignments((prev) => ({
      ...prev,
      [String(rowNum)]: facilityId,
    }));
  };

  const getRowStatusIcon = (rowIndex: number) => {
    if (!previewResult) return null;

    const previewRow = previewResult.preview[rowIndex];
    const hasConflict = previewResult.conflicts.some((c) => c.row === previewRow?.row);
    const hasFuzzyMatch = previewRow?.facilityMatch?.type === 'fuzzy';

    if (previewRow?.status === 'error') {
      return <span className="text-red-600 text-lg" title="Error">❌</span>;
    }
    if (hasConflict) {
      return <span className="text-amber-600 text-lg" title="Conflict">⚠️</span>;
    }
    if (hasFuzzyMatch && !facilityAssignments[String(previewRow.row)]) {
      return <span className="text-blue-600 text-lg" title="Needs confirmation">🔍</span>;
    }
    return <span className="text-green-600 text-lg" title="Valid">✅</span>;
  };

  const canImport = previewResult?.canImport &&
    (previewResult.rowsWithConflicts === 0 || overrideReason.trim().length > 0);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Schedule" size="xl">
      {error && (
        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded text-sm">
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <div className="text-gray-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-gray-600 mb-2">Drag and drop a CSV file here, or</p>
          <label className="cursor-pointer">
            <span className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Browse files
            </span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <p className="text-gray-400 text-sm mt-4">
            Games CSV: date, time, opponent, home_away, facility (optional), notes (optional)<br />
            Practices CSV: date, time, duration (optional), facility (optional), notes (optional)
          </p>
        </div>
      )}

      {step === 'preview' && previewResult && csvResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex gap-4 text-sm">
            <div className="bg-gray-100 px-3 py-2 rounded">
              <span className="font-medium">{previewResult.totalRows}</span> rows
            </div>
            {previewResult.invalidRows > 0 && (
              <div className="bg-red-100 text-red-800 px-3 py-2 rounded">
                <span className="font-medium">{previewResult.invalidRows}</span> errors
              </div>
            )}
            {previewResult.rowsWithConflicts > 0 && (
              <div className="bg-amber-100 text-amber-800 px-3 py-2 rounded">
                <span className="font-medium">{previewResult.rowsWithConflicts}</span> conflicts
              </div>
            )}
            {previewResult.preview.filter((p) => p.facilityMatch?.type === 'fuzzy').length > 0 && (
              <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded">
                <span className="font-medium">
                  {previewResult.preview.filter((p) => p.facilityMatch?.type === 'fuzzy').length}
                </span> to confirm
              </div>
            )}
          </div>

          {/* Validation errors block import */}
          {!previewResult.canImport && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-red-800 font-medium mb-2">
                Cannot import: Fix all errors before proceeding
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                {previewResult.errors.map((err, i) => (
                  <li key={i}>Row {err.row}: {err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview table */}
          <div className="max-h-80 overflow-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date/Time</th>
                  {csvResult.type === 'games' ? (
                    <>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Opponent</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">H/A</th>
                    </>
                  ) : (
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Duration</th>
                  )}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Facility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewResult.preview.map((row, index) => {
                  const conflict = previewResult.conflicts.find((c) => c.row === row.row);
                  const rowClass = row.status === 'error'
                    ? 'bg-red-50'
                    : conflict
                      ? 'bg-amber-50/50'
                      : '';

                  return (
                    <tr key={row.row} className={rowClass}>
                      <td className="px-4 py-2 text-sm">{getRowStatusIcon(index)}</td>
                      <td className="px-4 py-2 text-sm">
                        {row.parsed?.datetime
                          ? new Date(row.parsed.datetime).toLocaleString()
                          : '-'}
                      </td>
                      {csvResult.type === 'games' ? (
                        <>
                          <td className="px-4 py-2 text-sm">{row.parsed?.opponent || '-'}</td>
                          <td className="px-4 py-2 text-sm">{row.parsed?.homeAway || '-'}</td>
                        </>
                      ) : (
                        <td className="px-4 py-2 text-sm">{row.parsed?.duration ? `${row.parsed.duration} min` : '-'}</td>
                      )}
                      <td className="px-4 py-2 text-sm">
                        {row.facilityMatch?.type === 'fuzzy' ? (
                          <select
                            value={facilityAssignments[String(row.row)] || row.facilityMatch.suggestion?.id || ''}
                            onChange={(e) => handleFacilityChange(row.row, e.target.value)}
                            className="text-sm border rounded px-2 py-1 bg-blue-50 border-blue-200"
                          >
                            <option value="">None</option>
                            {facilities?.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} {row.facilityMatch?.suggestion?.id === f.id ? '(suggested)' : ''}
                              </option>
                            ))}
                          </select>
                        ) : row.facilityMatch?.type === 'none' && csvResult.rows[index] && 'facility' in csvResult.rows[index] ? (
                          <select
                            value={facilityAssignments[String(row.row)] || ''}
                            onChange={(e) => handleFacilityChange(row.row, e.target.value)}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="">None</option>
                            {facilities?.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                        ) : (
                          row.parsed?.facilityName || '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Conflicts section */}
          {previewResult.rowsWithConflicts > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <p className="text-amber-800 font-medium mb-2">
                {previewResult.rowsWithConflicts} events have scheduling conflicts
              </p>
              <ul className="text-sm text-amber-700 space-y-1 mb-3">
                {previewResult.conflicts.slice(0, 5).map((c, i) => (
                  <li key={i}>
                    Row {c.row}: {c.conflicts.map((conf) => conf.blockerName).join(', ')}
                  </li>
                ))}
                {previewResult.conflicts.length > 5 && (
                  <li>...and {previewResult.conflicts.length - 5} more</li>
                )}
              </ul>
              <div>
                <label className="block text-sm font-medium text-amber-800 mb-1">
                  Override reason (required to proceed)
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g., League schedule is fixed"
                  className="w-full px-3 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setStep('upload');
                setCsvResult(null);
                setPreviewResult(null);
                setError(null);
              }}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Upload different file
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeMutation.mutate()}
                disabled={!canImport || executeMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executeMutation.isPending
                  ? 'Importing...'
                  : `Import ${previewResult.validRows} ${csvResult.type}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewMutation.isPending && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Processing CSV...</span>
        </div>
      )}
    </Modal>
  );
}
