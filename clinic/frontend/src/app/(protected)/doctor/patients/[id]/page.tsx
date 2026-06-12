'use client';

import { useParams } from 'next/navigation';
import { DoctorPatientDetailPage } from '@/features/doctor/doctor-pages';

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id) {
    return <div className="p-6 text-sm text-muted-foreground">Patient not found.</div>;
  }

  return <DoctorPatientDetailPage id={id} />;
}
