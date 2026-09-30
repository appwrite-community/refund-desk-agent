import type { LucideIcon } from 'lucide-react';
import { RotateCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex size-10 items-center justify-center rounded-md border border-border-strong bg-raised text-muted">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children && <p className="mt-1 max-w-sm text-13 text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** An inline error with a retry button. */
export function ErrorState({ title, onRetry, className }: { title: string; onRetry: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex items-center gap-3 rounded-md border border-rose/24 bg-rose/8 px-4 py-3', className)}>
      <TriangleAlert className="size-4 shrink-0 text-rose" aria-hidden />
      <p className="flex-1 text-13 text-foreground">{title}</p>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        <RotateCw aria-hidden />
        Try again
      </Button>
    </div>
  );
}
