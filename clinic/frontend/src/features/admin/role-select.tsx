'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '@/features/auth/permissions';
import type { UserRole } from '@/types/api';

/**
 * The assignable roles, in the order they appear in the menu.
 *
 * <p>Every role is listed, including SUPER_ADMIN and HOSPITAL_ADMIN, because a
 * Super Admin must be able to provision any account. The server decides what is
 * actually permitted: `POST /admin/users` grants a privileged role only when the
 * caller already holds `SUPER_ADMIN`, so nobody else can hand themselves one. If
 * the API refuses, the form surfaces that error rather than pretending the save
 * succeeded.
 */
export const ASSIGNABLE_ROLES: Array<{ value: UserRole; description: string }> = [
  {
    value: 'SUPER_ADMIN',
    description: 'Full platform control, roles, branches and audit. No clinical data.',
  },
  {
    value: 'HOSPITAL_ADMIN',
    description: 'Departments, staff, wards, rooms and reports. No diagnoses or prescriptions.',
  },
  {
    value: 'DOCTOR',
    description: 'Assigned patients, diagnoses, prescriptions, lab requests, admissions.',
  },
  {
    value: 'NURSE',
    description: 'Assigned patients, vital signs, medication administration. Cannot prescribe.',
  },
  {
    value: 'RECEPTIONIST',
    description: 'Registration, appointments, check-in, queue and doctor assignment.',
  },
  {
    value: 'LAB_TECHNICIAN',
    description: 'Lab requests, specimens, results entry and validation.',
  },
  {
    value: 'PHARMACIST',
    description: 'Prescription verification, dispensing, inventory and batch expiry.',
  },
  {
    value: 'CASHIER',
    description: 'Invoices, payments, receipts and authorised refunds.',
  },
  {
    value: 'PATIENT',
    description: 'Own appointments, released records, prescriptions and invoices.',
  },
];

/** Roles that need extra profile fields, and which ones. */
export function requiredFieldsFor(role: UserRole): {
  specialization: boolean;
  licenseNumber: boolean;
  employeeNumber: boolean;
  dateOfBirth: boolean;
  gender: boolean;
  bloodType: boolean;
  registrationNumber: boolean;
} {
  return {
    specialization: role === 'DOCTOR',
    licenseNumber: role === 'DOCTOR',
    employeeNumber:
      role === 'PHARMACIST' || role === 'LAB_TECHNICIAN' || role === 'NURSE' || role === 'CASHIER' ||
      role === 'RECEPTIONIST' || role === 'HOSPITAL_ADMIN',
    dateOfBirth: role === 'PATIENT',
    gender: role === 'PATIENT',
    bloodType: role === 'PATIENT',
    registrationNumber: role === 'PATIENT',
  };
}

type RoleSelectProps = {
  value: UserRole;
  onChange: (role: UserRole) => void;
  disabled?: boolean;
  id?: string;
};

/**
 * Burger-style role menu.
 *
 * <p>Keyboard accessible (Escape closes, click-outside closes) and shows the
 * permission count each role carries so an administrator can see what they are
 * granting before they click Save.
 */
export function RoleSelect({ value, onChange, disabled = false, id }: RoleSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{ROLE_LABELS[value] ?? value}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Select role"
          className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-soft"
        >
          {ASSIGNABLE_ROLES.map((role) => {
            const selected = role.value === value;
            return (
              <li key={role.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(role.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-muted/70 ${
                    selected ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="mt-0.5 w-4 shrink-0">
                    {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium">{ROLE_LABELS[role.value]}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {ROLE_PERMISSIONS[role.value]?.length ?? 0} permissions
                      </Badge>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {role.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default RoleSelect;