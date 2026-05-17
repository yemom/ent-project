import { LabResultView } from '@/features/laboratory/components/lab-result-view';
import { labResultsService } from '@/features/laboratory/services/lab-results.service';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const result = await labResultsService.getByLabOrderId(id);

  return (
    <div>
      <LabResultView result={result ?? undefined} />
    </div>
  );
}
