// frontend/src/components/InboundImportsTab.tsx
//
// Two things on one screen, because they are two halves of the same job.
//
// The address is the top half. Somebody at the school pastes it into SchoolDude
// once, as a recipient on a scheduled report, and reports arrive from then on.
// Until they can SEE it, none of the rest of this exists for them - which is
// why the copy button is not decoration.
//
// The queue is the bottom half. A file that arrives is parsed, shown, and left
// alone. The last real export held 870 events and 39 facility conflicts, so a
// pipeline that applied one on arrival would rewrite a term of the schedule with
// nobody having looked. Approving is a deliberate act and this is where it
// happens.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  inboundApi,
  saveBlob,
  type InboundImport,
  type InboundImportStatus,
  type ParseSummary,
} from '../api/inbound';

interface Props {
  schoolId: string;
}

const STATUS_STYLE: Record<InboundImportStatus, string> = {
  NEEDS_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-200 text-gray-700',
  FAILED: 'bg-red-100 text-red-800',
  RECEIVED: 'bg-blue-100 text-blue-800',
};

const STATUS_LABEL: Record<InboundImportStatus, string> = {
  NEEDS_REVIEW: 'Needs review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  FAILED: 'Could not read',
  RECEIVED: 'Received',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** What the file holds, in the terms someone deciding about it cares about. */
function Summary({ summary }: { summary: ParseSummary }) {
  return (
    <div className="text-sm text-gray-600 mt-1 space-y-0.5">
      <div>
        <strong>{summary.events.toLocaleString()}</strong> events,{' '}
        <strong>{summary.bookings.toLocaleString()}</strong> bookings
        {summary.dateRange && (
          <>
            {' '}
            from {summary.dateRange.from} to {summary.dateRange.to}
          </>
        )}
        {summary.skipped > 0 && (
          <span className="text-amber-700"> · {summary.skipped} rows unreadable</span>
        )}
      </div>
      <div>
        {summary.conflicts > 0 ? (
          <span className="text-amber-700">
            {summary.conflicts} facility {summary.conflicts === 1 ? 'conflict' : 'conflicts'} in
            this file
          </span>
        ) : (
          <span className="text-gray-500">No facility conflicts in this file</span>
        )}
        {summary.rooms.length > 0 && (
          <span className="text-gray-500"> · {summary.rooms.length} rooms</span>
        )}
      </div>
    </div>
  );
}

export function InboundImportsTab({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const addressQuery = useQuery({
    queryKey: ['inbound-address', schoolId],
    queryFn: () => inboundApi.getAddress(schoolId),
  });

  const listQuery = useQuery({
    queryKey: ['inbound-imports', schoolId],
    queryFn: () => inboundApi.list(schoolId, { limit: 25 }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inbound-imports', schoolId] });
  };

  const rotate = useMutation({
    mutationFn: () => inboundApi.rotateAddress(schoolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-address', schoolId] });
      setConfirmRotate(false);
    },
  });

  // Fetched through axios so the auth interceptor runs. A plain link to the
  // download route navigates without the Bearer token and just 401s.
  const download = useMutation({
    mutationFn: async (item: InboundImport) => {
      const blob = await inboundApi.download(schoolId, item.id);
      saveBlob(blob, item.filename ?? `import-${item.id}`);
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => inboundApi.approve(schoolId, id),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      inboundApi.reject(schoolId, id, notes || undefined),
    onSuccess: () => {
      invalidate();
      setRejecting(null);
      setRejectNotes('');
    },
  });

  const copy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the address is selectable either way.
      setCopied(false);
    }
  };

  const imports = listQuery.data?.data ?? [];
  const pending = imports.filter((i) => i.status === 'NEEDS_REVIEW');

  return (
    <div className="space-y-8">
      <section className="max-w-3xl">
        <h2 className="text-lg font-semibold mb-1">Where to send your reports</h2>
        <p className="text-sm text-gray-500 mb-4">
          Give this address to whoever runs your facility scheduling reports. In SchoolDude,
          it goes in the recipient list of a saved, scheduled report — the same box a person's
          email address would go in. It does not need a SchoolDude account of its own.
        </p>

        {addressQuery.isLoading && <p className="text-gray-500">Loading...</p>}

        {addressQuery.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            Could not load the address.{' '}
            {addressQuery.error instanceof Error ? addressQuery.error.message : ''}
          </div>
        )}

        {addressQuery.data && (
          <>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded font-mono text-sm break-all"
                data-testid="inbound-address"
              >
                {addressQuery.data.address}
              </code>
              <button
                type="button"
                onClick={() => copy(addressQuery.data.address)}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 whitespace-nowrap"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 rounded mt-3">
              Treat this like a password. Anyone who knows it can send files into this queue,
              so share it with the person setting up the report and no further. If it gets
              out, replace it below.
            </div>

            <div className="mt-3">
              {!confirmRotate ? (
                <button
                  type="button"
                  onClick={() => setConfirmRotate(true)}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Replace this address
                </button>
              ) : (
                <div className="bg-gray-50 border border-gray-300 rounded p-3">
                  <p className="text-sm text-gray-700 mb-2">
                    The current address stops working the moment you do this, and anything
                    still sending to it will bounce until someone updates the report in
                    SchoolDude. Only do this if the address has got out.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => rotate.mutate()}
                      disabled={rotate.isPending}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
                    >
                      {rotate.isPending ? 'Replacing...' : 'Replace it'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRotate(false)}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-lg font-semibold">Arrived reports</h2>
          {pending.length > 0 && (
            <span className="text-sm text-amber-700">
              {pending.length} waiting for you
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Nothing here changes your schedule until you approve it.
        </p>

        {listQuery.isLoading && <p className="text-gray-500">Loading...</p>}

        {!listQuery.isLoading && imports.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded p-6 text-center text-gray-500">
            Nothing has arrived yet. Once a scheduled report is pointed at the address above,
            it will show up here.
          </div>
        )}

        <div className="space-y-3">
          {imports.map((item: InboundImport) => (
            <div key={item.id} className="border border-gray-200 rounded p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLE[item.status]}`}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className="font-medium truncate">
                      {item.filename ?? item.subject ?? 'Untitled'}
                    </span>
                    {item.sizeBytes !== null && (
                      <span className="text-sm text-gray-500">{formatSize(item.sizeBytes)}</span>
                    )}
                  </div>

                  <div className="text-sm text-gray-500 mt-0.5">
                    from {item.fromAddress} · {formatWhen(item.createdAt)}
                  </div>

                  {item.parseSummary && <Summary summary={item.parseSummary} />}

                  {item.failureReason && (
                    <p className="text-sm text-red-700 mt-1">{item.failureReason}</p>
                  )}

                  {item.reviewNotes && (
                    <p className="text-sm text-gray-600 mt-1">Note: {item.reviewNotes}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {item.sizeBytes !== null && (
                    <button
                      type="button"
                      onClick={() => download.mutate(item)}
                      disabled={download.isPending}
                      className="text-sm text-blue-600 hover:underline whitespace-nowrap disabled:opacity-50"
                    >
                      {download.isPending && download.variables?.id === item.id
                        ? 'Downloading...'
                        : 'Download'}
                    </button>
                  )}

                  {item.status === 'NEEDS_REVIEW' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => approve.mutate(item.id)}
                        disabled={approve.isPending}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejecting(item.id)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {rejecting === item.id && (
                <div className="mt-3 border-t pt-3">
                  <label className="block text-sm text-gray-700 mb-1" htmlFor={`why-${item.id}`}>
                    Why are you rejecting it? Optional, and only you will see it.
                  </label>
                  <input
                    id={`why-${item.id}`}
                    type="text"
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="wrong date range"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => reject.mutate({ id: item.id, notes: rejectNotes })}
                      disabled={reject.isPending}
                      className="px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm disabled:opacity-50"
                    >
                      {reject.isPending ? 'Rejecting...' : 'Reject it'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejecting(null);
                        setRejectNotes('');
                      }}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {(approve.error || reject.error || download.error) && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm mt-3">
            {(() => {
              const err = approve.error ?? reject.error ?? download.error;
              return err instanceof Error ? err.message : 'That did not work.';
            })()}
          </div>
        )}
      </section>
    </div>
  );
}
