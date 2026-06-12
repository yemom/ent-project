import { DoctorMedicalRecordDetailPage } from '@/features/doctor/doctor-pages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DoctorMedicalRecordDetailPage id={id} />;
}
