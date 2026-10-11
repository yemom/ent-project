'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { useCreateAccount, useUpdateAccount } from '@/features/admin/use-user-accounts';
import { getApiErrorMessage } from '@/lib/error-handler';
import type { ManagedUser, UserProfile } from '@/services/api/admin';
import type { UserRole } from '@/types/api';

/**
 * Roles a Super Admin may provision.
 *
 * <p>`ADMIN` and `LABORATORY` are omitted: they are legacy aliases the server
 * canonicalises to SUPER_ADMIN and LAB_TECHNICIAN, and offering them would let an
 * account be stored under a second spelling of the same role.
 */
export const ASSIGNABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'NURSE', label: 'Nurse' },
  { value: 'PHARMACIST', label: 'Pharmacist' },
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
  { value: 'LAB_TECHNICIAN', label: 'Laboratory technician' },
  { value: 'PATIENT', label: 'Patient' },
  { value: 'HOSPITAL_ADMIN', label: 'Hospital administrator' },
  { value: 'SUPER_ADMIN', label: 'Super administrator' },
];

/**
 * Client-side validation mirroring the server's rules.
 *
 * <p>Deliberately not the authority. It exists so obvious mistakes are caught
 * without a round trip; every one of these constraints is enforced again on the
 * server, because anything typed into a browser is a suggestion.
 */
const accountSchema = z
  .object({
    /** Set by the role selector; drives which conditional rules apply below. */
    role: z.string().optional(),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    fullName: z.string().min(2, 'Full name is required').max(100),
    phone: z
      .string()
      .regex(/^$|^[0-9+()\- ]{7,20}$/, 'Phone must be 7-20 digits')
      .optional()
      .or(z.literal('')),
    password: z.string().optional(),
    // Role-specific, validated conditionally below because only now is the role known.
    specialization: z.string().optional(),
    licenseNumber: z.string().optional(),
    yearsOfExperience: z.coerce.number().int().min(0, 'Cannot be negative').optional(),
    consultationFee: z.coerce.number().min(0, 'Cannot be negative').optional(),
    qualifications: z.string().optional(),
    employeeNumber: z.string().optional(),
    pharmacyLocation: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    address: z.string().optional(),
    bloodType: z.string().optional(),
    medicalHistory: z.string().optional(),
    allergies: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    registrationNumber: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const doctor = (field: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });

    if (values.role === 'DOCTOR') {
      if (!values.specialization?.trim()) doctor('specialization', 'Specialization is required');
      if (!values.licenseNumber?.trim()) doctor('licenseNumber', 'License number is required');
    }
    if (values.role === 'PHARMACIST' && !values.employeeNumber?.trim()) {
      doctor('employeeNumber', 'Employee number is required');
    }
    if (values.role === 'PATIENT') {
      if (!values.dateOfBirth) {
        doctor('dateOfBirth', 'Date of birth is required');
      } else if (new Date(values.dateOfBirth) > new Date()) {
        doctor('dateOfBirth', 'Date of birth cannot be in the future');
      }
    }
    if (values.password && values.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Use at least 8 characters, or leave blank to generate one',
      });
    }
  });

type AccountFormValues = z.input<typeof accountSchema>;

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Create or edit an account.
 *
 * <p>One component for both, because the field set is identical and the only
 * difference is what is submitted. Splitting them would guarantee the two drift.
 *
 * <p>Fields appear and disappear with the selected role: a cashier has no
 * specialization, and showing an empty one invites the question of what to type
 * into it.
 */
export function UserAccountForm({
  user,
  defaultRole,
  onDone,
  onCancel,
}: {
  /** Present when editing; absent when creating. */
  user?: ManagedUser | null;
  defaultRole?: UserRole;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(user);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const pending = createAccount.isPending || updateAccount.isPending;

  const profile: UserProfile = user?.profile ?? {};

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      role: user?.role ?? defaultRole ?? 'DOCTOR',
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
      password: '',
      specialization: profile.specialization ?? '',
      licenseNumber: profile.licenseNumber ?? '',
      yearsOfExperience: profile.yearsOfExperience ?? undefined,
      consultationFee: profile.consultationFee ?? undefined,
      qualifications: profile.qualifications ?? '',
      employeeNumber: profile.employeeNumber ?? '',
      pharmacyLocation: profile.pharmacyLocation ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      gender: (profile.gender as 'MALE' | 'FEMALE' | 'OTHER' | undefined) ?? undefined,
      address: profile.address ?? '',
      bloodType: profile.bloodType ?? '',
      medicalHistory: profile.medicalHistory ?? '',
      allergies: profile.allergies ?? '',
      emergencyContactName: profile.emergencyContactName ?? '',
      emergencyContactPhone: profile.emergencyContactPhone ?? '',
      registrationNumber: profile.registrationNumber ?? '',
    } as AccountFormValues,
  });

  // Refetch the profile whenever a different account is opened for editing.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const role = watch('role');

  const error = createAccount.error ?? updateAccount.error;

  /**
   * Routes a server-side field error back onto the matching form input.
   *
   * <p>A duplicate email arrives as a 409 with a message, not as structured data, so
   * the message is matched against the field it names. That is a heuristic, and it
   * degrades safely: when nothing matches, the message is still shown at the top of
   * the form rather than being swallowed.
   */
  useEffect(() => {
    if (!error) return;
    const message = getApiErrorMessage(error);
    if (!message) return;

    const lower = message.toLowerCase();
    const fields: [RegExp, string][] = [
      [/email|already exists/, 'email'],
      [/specialization/, 'specialization'],
      [/license/, 'licenseNumber'],
      [/employee number/, 'employeeNumber'],
      [/date of birth/, 'dateOfBirth'],
      [/password/, 'password'],
      [/phone/, 'phone'],
    ];
    const match = fields.find(([pattern]) => pattern.test(lower));
    if (match) setError(match[1] as never, { type: 'server', message });
  }, [error, setError]);

  const onSubmit = handleSubmit((values) => {
    const trimmed = (value?: string) => {
      const text = value?.trim();
      return text ? text : undefined;
    };

    if (isEdit && user) {
      // The role is not submitted here: it has its own audited endpoint, so a
      // profile save can never escalate an account by accident.
      updateAccount.mutate(
        {
          id: user.id,
          payload: {
            email: trimmed(values.email),
            fullName: trimmed(values.fullName),
            phone: trimmed(values.phone),
            specialization: trimmed(values.specialization),
            licenseNumber: trimmed(values.licenseNumber),
            yearsOfExperience: values.yearsOfExperience || undefined,
            consultationFee: values.consultationFee || undefined,
            qualifications: trimmed(values.qualifications),
            employeeNumber: trimmed(values.employeeNumber),
            pharmacyLocation: trimmed(values.pharmacyLocation),
            dateOfBirth: trimmed(values.dateOfBirth),
            gender: values.gender,
            address: trimmed(values.address),
            bloodType: trimmed(values.bloodType),
            medicalHistory: trimmed(values.medicalHistory),
            allergies: trimmed(values.allergies),
            emergencyContactName: trimmed(values.emergencyContactName),
            emergencyContactPhone: trimmed(values.emergencyContactPhone),
            registrationNumber: trimmed(values.registrationNumber),
          },
        },
        { onSuccess: onDone }
      );
      return;
    }

    createAccount.mutate(
      {
        email: (values.email ?? '').trim(),
        fullName: (values.fullName ?? '').trim(),
        phone: trimmed(values.phone),
        role: (values.role ?? 'DOCTOR') as UserRole,
        password: trimmed(values.password),
        specialization: trimmed(values.specialization),
        licenseNumber: trimmed(values.licenseNumber),
        yearsOfExperience: values.yearsOfExperience || undefined,
        consultationFee: values.consultationFee || undefined,
        qualifications: trimmed(values.qualifications),
        employeeNumber: trimmed(values.employeeNumber),
        pharmacyLocation: trimmed(values.pharmacyLocation),
        dateOfBirth: trimmed(values.dateOfBirth),
        gender: values.gender,
        address: trimmed(values.address),
        bloodType: trimmed(values.bloodType),
        medicalHistory: trimmed(values.medicalHistory),
        allergies: trimmed(values.allergies),
        emergencyContactName: trimmed(values.emergencyContactName),
        emergencyContactPhone: trimmed(values.emergencyContactPhone),
        registrationNumber: trimmed(values.registrationNumber),
      },
      { onSuccess: onDone }
    );
  });

  const isDoctor = role === 'DOCTOR';
  const isPharmacist = role === 'PHARMACIST';
  const isPatient = role === 'PATIENT';

  const serverMessage = useMemo(() => (error ? getApiErrorMessage(error) : ''), [error]);

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {!isEdit ? (
        <Field label="Role" htmlFor="role" error={errors.role?.message}>
          <Select
            id="role"
            value={role ?? 'DOCTOR'}
            onChange={(event) =>
              setValue('role', event.target.value as UserRole, { shouldValidate: true })
            }
          >
            <option value="">Choose a role</option>
            {ASSIGNABLE_ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          Role: <span className="font-medium text-foreground">{user?.role.replace(/_/g, ' ')}</span>.
          Changing it is a separate, audited action.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
          <Input id="fullName" {...register('fullName')} placeholder="e.g. Amara Okoye" />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="name@clinic.local"
          />
        </Field>

        <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" {...register('phone')} placeholder="+15551234567" />
        </Field>

        {!isEdit ? (
          <Field
            label="Temporary password"
            htmlFor="password"
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              placeholder="Leave blank to generate"
            />
            <p className="text-xs text-muted-foreground">
              The account must change this password on first sign-in.
            </p>
          </Field>
        ) : null}
      </div>

      {isDoctor ? (
        <section className="space-y-4 rounded-2xl border border-border/70 p-4">
          <h3 className="text-sm font-semibold">Doctor profile</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Specialization" htmlFor="specialization" error={errors.specialization?.message}>
              <Input
                id="specialization"
                {...register('specialization')}
                placeholder="e.g. Cardiology"
              />
            </Field>
            <Field label="License number" htmlFor="licenseNumber" error={errors.licenseNumber?.message}>
              <Input id="licenseNumber" {...register('licenseNumber')} placeholder="e.g. LIC-2041" />
            </Field>
            <Field label="Years of experience" htmlFor="yearsOfExperience" error={errors.yearsOfExperience?.message}>
              <Input
                id="yearsOfExperience"
                type="number"
                min={0}
                {...register('yearsOfExperience')}
              />
            </Field>
            <Field label="Consultation fee" htmlFor="consultationFee" error={errors.consultationFee?.message}>
              <Input
                id="consultationFee"
                type="number"
                min={0}
                step="0.01"
                {...register('consultationFee')}
              />
            </Field>
          </div>
          <Field label="Qualifications" htmlFor="qualifications">
            <Textarea id="qualifications" rows={2} {...register('qualifications')} />
          </Field>
        </section>
      ) : null}

      {isPharmacist ? (
        <section className="space-y-4 rounded-2xl border border-border/70 p-4">
          <h3 className="text-sm font-semibold">Pharmacist profile</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee number" htmlFor="employeeNumber" error={errors.employeeNumber?.message}>
              <Input id="employeeNumber" {...register('employeeNumber')} placeholder="e.g. EMP-104" />
            </Field>
            <Field label="Pharmacy location" htmlFor="pharmacyLocation">
              <Input id="pharmacyLocation" {...register('pharmacyLocation')} placeholder="e.g. Main" />
            </Field>
          </div>
        </section>
      ) : null}

      {isPatient ? (
        <section className="space-y-4 rounded-2xl border border-border/70 p-4">
          <h3 className="text-sm font-semibold">Patient demographics</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date of birth" htmlFor="dateOfBirth" error={errors.dateOfBirth?.message}>
              <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
            </Field>
            <Field label="Gender" htmlFor="gender">
              <Select
                id="gender"
                value={watch('gender') ?? ''}
                onChange={(event) =>
                  setValue(
                    'gender',
                    (event.target.value || undefined) as 'MALE' | 'FEMALE' | 'OTHER' | undefined
                  )
                }
              >
                <option value="">Not specified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label="Blood type" htmlFor="bloodType">
              <Input id="bloodType" {...register('bloodType')} placeholder="e.g. O+" />
            </Field>
            <Field label="Registration number" htmlFor="registrationNumber">
              <Input id="registrationNumber" {...register('registrationNumber')} />
            </Field>
          </div>
          <Field label="Address" htmlFor="address">
            <Input id="address" {...register('address')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Emergency contact name" htmlFor="emergencyContactName">
              <Input id="emergencyContactName" {...register('emergencyContactName')} />
            </Field>
            <Field label="Emergency contact phone" htmlFor="emergencyContactPhone">
              <Input id="emergencyContactPhone" {...register('emergencyContactPhone')} />
            </Field>
          </div>
          <Field label="Allergies" htmlFor="allergies">
            <Textarea id="allergies" rows={2} {...register('allergies')} />
          </Field>
        </section>
      ) : null}

      {serverMessage && !errors.email ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverMessage}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : isEdit ? 'Save changes' : 'Create account'}
        </Button>
      </div>
    </form>
  );
}
