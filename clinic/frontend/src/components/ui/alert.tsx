import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  const variantStyles = variant === 'destructive' 
    ? 'border-red-200 bg-red-50 text-red-900 [&>svg]:text-red-600' 
    : 'border-border bg-background text-foreground';

  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-2xl border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4',
        variantStyles,
        className
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn('mb-1 font-semibold leading-none tracking-tight text-sm', className)}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={cn('text-xs opacity-90 [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}
