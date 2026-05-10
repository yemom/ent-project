import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatClinicDate(value: string | Date, pattern = 'dd MMM yyyy') {
  return format(typeof value === 'string' ? parseISO(value) : value, pattern);
}
