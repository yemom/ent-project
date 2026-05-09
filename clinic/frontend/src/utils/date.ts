import { format, parseISO } from 'date-fns';

export function formatClinicDate(value: string | Date, pattern = 'dd MMM yyyy') {
  return format(typeof value === 'string' ? parseISO(value) : value, pattern);
}
