'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Confirmation for an action that takes an account away from someone.
 *
 * <p>Deactivation requires a written reason, and the input is part of this dialog
 * rather than a separate step: "deactivated" with no explanation cannot be reviewed
 * six months later, so asking at the moment of the decision is the only place the
 * answer is actually known.
 */
export function AccountActionDialog({
  open,
  onOpenChange,
  mode,
  fullName,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'deactivate' | 'delete';
  fullName: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const needsReason = mode === 'deactivate';
  const reasonMissing = needsReason && reason.trim().length === 0;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    // Cleared on close so a stale reason from a previous action is never resubmitted.
    if (!next) {
      setReason('');
      setTouched(false);
    }
  };

  const confirm = () => {
    setTouched(true);
    if (reasonMissing) return;
    onConfirm(reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {mode === 'delete' ? `Delete ${fullName}?` : `Deactivate ${fullName}?`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'delete'
              ? 'The account is removed from the directory and can no longer sign in. ' +
                'Appointments, medical records, invoices and audit entries that reference it are kept.'
              : 'The account can no longer sign in, and any session already open is rejected on the ' +
                'next request. You can reactivate it later.'}
          </DialogDescription>
        </DialogHeader>

        {needsReason ? (
          <div className="space-y-1.5">
            <Label htmlFor="deactivation-reason">Reason (required)</Label>
            <Textarea
              id="deactivation-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Contract ended on 30 September"
              aria-invalid={touched && reasonMissing}
            />
            {touched && reasonMissing ? (
              <p role="alert" className="text-xs text-destructive">
                A reason is required so this decision can be explained later.
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy
              ? 'Working...'
              : mode === 'delete'
                ? 'Delete account'
                : 'Deactivate account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
