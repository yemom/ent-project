import { Skeleton } from '@/components/ui/skeleton';

export function LoadingState({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}
