'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/auth-store';
import { labResultsService } from '../services/lab-results.service';
import { serializeLabFindings } from '../utils';
import type { LabOrder, LabResult, LabResultStatus, SubmitLabResultDto } from '../types';

interface Props {
  order: LabOrder;
  onSubmitted?: (result: LabResult, status: LabResultStatus) => void;
}

export function LabResultForm({ order, onSubmitted }: Props) {
  const user = useAuthStore((state) => state.user);
  const initial: Record<string, string> = {};
  order.tests.forEach((t) => (initial[t] = ''));
  const [findings, setFindings] = useState<Record<string, string>>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const allFilled = order.tests.every((t) => findings[t] && findings[t].trim().length > 0);
  const hasAnyFinding = Object.values(findings).some((value) => value.trim().length > 0);

  const handleChange = (test: string, value: string) => setFindings((f) => ({ ...f, [test]: value }));

  const submitResult = async (status: LabResultStatus) => {
    const serializedFindings = serializeLabFindings(order.tests, findings);
    if (!serializedFindings.trim()) {
      setMessage('Add at least one finding before saving the result.');
      return;
    }
    if (status === 'final' && !allFilled) {
      setMessage('Complete every test field before sending the final result.');
      return;
    }

    setIsSaving(true);
    try {
      setMessage(null);
      const payload: SubmitLabResultDto = {
        labOrderId: order.id,
        labTechnicianId: user?.id || 'laboratory',
        findings: serializedFindings,
        fileUrl: fileUrl.trim() || null,
        status
      };
      const res = await labResultsService.submit(payload);
      onSubmitted?.(res, status);
      if (status === 'final') {
        setMessage('Result sent to the ordering doctor.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the lab result.');
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
        <label className="block text-sm font-medium">Attachment URL (optional)</label>
        <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => submitResult('draft')} disabled={isSaving || !hasAnyFinding}>
          Save Draft
        </Button>
        <Button onClick={() => submitResult('final')} disabled={isSaving || !allFilled}>
          Send to Doctor
        </Button>
      </div>
    </div>
  );
}
