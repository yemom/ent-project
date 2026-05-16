'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { labResultsService } from '../services/lab-results.service';
import type { LabOrder, SubmitLabResultDto } from '../types';

interface Props {
  order: LabOrder;
  onSubmitted?: (result: any) => void;
}

export function LabResultForm({ order, onSubmitted }: Props) {
  const initial: Record<string, string> = {};
  order.tests.forEach((t) => (initial[t] = ''));
  const [findings, setFindings] = useState<Record<string, string>>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const allFilled = order.tests.every((t) => findings[t] && findings[t].trim().length > 0);

  const handleChange = (test: string, value: string) => setFindings((f) => ({ ...f, [test]: value }));

  const uploadFile = async (f: File) => {
    // Minimal: backend may accept multipart; if not, skip upload and rely on fileUrl in DTO.
    // Here we return null and leave upload to server-side implementation.
    return null;
  };

  const saveDraft = async () => {
    setIsSaving(true);
    try {
      const payload: SubmitLabResultDto = {
        labOrderId: order.id,
        labTechnicianId: 'me',
        findings,
        status: 'draft'
      };
      const res = await labResultsService.submit(payload);
      onSubmitted?.(res);
    } finally {
      setIsSaving(false);
    }
  };

  const submitFinal = async () => {
    if (!allFilled) return;
    setIsSaving(true);
    try {
      const payload: SubmitLabResultDto = {
        labOrderId: order.id,
        labTechnicianId: 'me',
        findings,
        status: 'final'
      };
      const res = await labResultsService.submit(payload);
      onSubmitted?.(res);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {order.tests.map((t) => (
        <div key={t}>
          <label className="block text-sm font-medium">{t}</label>
          <Textarea value={findings[t] ?? ''} onChange={(e) => handleChange(t, e.target.value)} />
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium">Attach File (optional)</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={saveDraft} disabled={isSaving}>
          Save Draft
        </Button>
        <Button onClick={submitFinal} disabled={isSaving || !allFilled}>
          Submit Final
        </Button>
      </div>
    </div>
  );
}
