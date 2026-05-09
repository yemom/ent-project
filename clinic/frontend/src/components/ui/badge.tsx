import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
}

const badgeVariants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'border border-border text-foreground',
  success: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  warning: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  destructive: 'bg-red-100 text-red-700 ring-1 ring-red-200'
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', badgeVariants[variant], className)} {...props} />;
}
