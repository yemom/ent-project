'use client';

import { useQuery } from '@tanstack/react-query';
import { listDoctors, listPatients, listUsers } from '@/services/api/users';

export function useUsers(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => listUsers(params)
  });
}

export function useDoctors(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['doctors', params],
    queryFn: () => listDoctors(params)
  });
}

export function usePatients(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['patients', params],
    queryFn: () => listPatients(params)
  });
}
