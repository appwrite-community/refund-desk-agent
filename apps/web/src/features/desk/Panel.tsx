import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A titled card in the request detail. */
export function Panel({ title, aside, className, children }: { title: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}>
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <h2 className="flex-1 text-13 font-medium">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
