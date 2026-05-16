'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LAB_TEST_TYPES, LAB_URGENCY } from '@/lib/constants';
import type { CreateLabOrderDto } from '../types';
import { labOrdersService } from '../services/lab-orders.service';

interface Props {
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  onSuccess?: (order: any) => void;
}

export function LabOrderForm({ patientId, doctorId, appointmentId, onSuccess }: Props) {
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<typeof LAB_URGENCY[number]>('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (selectedTests.length === 0) return;
    setIsSubmitting(true);
    const payload: CreateLabOrderDto = {
      patientId,
      doctorId,
      appointmentId: appointmentId ?? null,
      tests: selectedTests,
      urgency,
      clinicalNotes
    };

    try {
      const data = await labOrdersService.create(payload as CreateLabOrderDto);
      onSuccess?.(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Select Tests</label>
        <Select multiple value={selectedTests} onChange={(e) => setSelectedTests(Array.from((e.target as HTMLSelectElement).selectedOptions).map((o) => o.value))}>
          {LAB_TEST_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium">Urgency</label>
        <Select value={urgency} onChange={(e) => setUrgency(e.target.value as any)}>
          {LAB_URGENCY.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium">Clinical Notes</label>
        <Textarea value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={isSubmitting || selectedTests.length === 0}>
          {isSubmitting ? 'Sending...' : 'Send to Lab'}
        </Button>
      </div>
    </div>
  );
}
