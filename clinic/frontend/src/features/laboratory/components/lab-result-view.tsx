'use client';

import { Button } from '@/components/ui/button';
import type { LabResult, LabOrder } from '../types';

interface Props {
  order?: LabOrder;
  result?: LabResult;
}

export function LabResultView({ order, result }: Props) {
  if (!order && !result) return <div>No result available</div>;

  const r = result;

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded">
        <div className="text-sm font-semibold text-slate-900">Patient: {order?.patientName || order?.patientId}</div>
        <div className="text-xs text-slate-500 font-medium">Tests: {order?.tests.join(', ')}</div>
        <div className="text-xs">Submitted: {r?.submittedAt ?? r?.updatedAt}</div>
      </div>

      <div className="space-y-2">
        {r && typeof r.findings === 'string' ? (
          <div className="rounded-2xl border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
            {r.findings}
          </div>
        ) : (
          r && typeof r.findings === 'object' && Object.entries(r.findings).map(([k, v]) => (
            <div key={k} className="p-3 border rounded">
              <div className="text-sm font-medium">{k}</div>
              <div className="text-sm">{v}</div>
            </div>
          ))
        )}

        {r?.fileUrl && (
          <div>
            <a href={r.fileUrl} target="_blank" rel="noreferrer">
              <Button variant="outline">Download Attachment</Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
