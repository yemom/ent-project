'use client';

import { useQuery } from '@tanstack/react-query';
import {
  searchDoctors,
  searchPatientDirectory,
  type PatientDirectoryItem,
} from '@/services/api/users';
import type { UserItem } from '@/services/api/users';

/**
 * A patient as the booking screen needs them.
 *
 * <p>An alias of the directory item the API actually returns, narrowed to the
 * front-desk fields. The booking form needs to tell two similarly named patients
 * apart — it has no business reading a chart.
 */
export type DirectoryPatient = PatientDirectoryItem;

/** Mirrors `DoctorResponse`, restricted to the scheduling-relevant fields. */
export interface DirectoryDoctor {
  id: string;
  fullName: string;
  email: string | null;
  specialization: string | null;
  available: boolean | null;
  active: boolean | null;
}

export const DIRECTORY_PAGE_SIZE = 25;

/** Shortest term worth sending; below this the result set is effectively the directory. */
const MIN_QUERY_LENGTH = 2;

export const DIRECTORY_KEYS = {
  patients: (query: string) => ['directory', 'patients', query] as const,
  doctors: () => ['directory', 'doctors'] as const,
};

export function usePatientDirectory(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: DIRECTORY_KEYS.patients(trimmed),
    queryFn: async () => {
      const page = await searchPatientDirectory({ fullName: trimmed, size: DIRECTORY_PAGE_SIZE });
      return (page.content ?? []) as DirectoryPatient[];
    },
    // A blank box shows "start typing", not an unfiltered dump of every patient in
    // the hospital, so the request is held back until there is something to match.
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  });
}

/**
 * Doctors for the picker and the doctor filter.
 *
 * <p>Loaded unfiltered on first open rather than on keystrokes: the clinic's roster
 * is small enough to show at once, and a receptionist filtering a list of fifteen
 * names gains nothing from server-side search.
 */
export function useDoctorDirectory() {
  return useQuery({
    queryKey: DIRECTORY_KEYS.doctors(),
    queryFn: async () => {
      const page = await searchDoctors({ active: true, size: 100 });
      return (page.content ?? []).map((doctor) => toDirectoryDoctor(doctor as UserItem));
    },
    staleTime: 60_000,
  });
}

function toDirectoryDoctor(doctor: UserItem): DirectoryDoctor {
  return {
    id: doctor.id,
    fullName: doctor.fullName,
    email: doctor.email ?? null,
    specialization: doctor.specialization ?? null,
    available: doctor.available ?? null,
    active: doctor.active ?? null,
  };
}