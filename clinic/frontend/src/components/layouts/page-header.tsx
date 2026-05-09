import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actionLabel,
  actionHref,
  onAction
}: Readonly<{ title: string; description?: string; actionLabel?: string; actionHref?: string; onAction?: () => void }>) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p> : null}
      </div>
      {actionLabel ? (
        actionHref ? (
          <Link
            href={actionHref as any}
            className={cn(
              'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          >
            {actionLabel}
          </Link>
        ) : (
          <Button className="rounded-2xl" onClick={onAction}>{actionLabel}</Button>
        )
      ) : null}
    </div>
  );
}
