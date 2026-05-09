import { DoctorPatientDetailPage } from '@/features/doctor/doctor-pages';

export default function Page({ params }: { params: { id: string } }) {
  return <DoctorPatientDetailPage id={params.id} />;
}
