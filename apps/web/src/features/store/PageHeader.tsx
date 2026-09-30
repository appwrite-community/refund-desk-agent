import type { ReactNode } from 'react';

export function PageHeader({ title, children, actions }: { title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
        {children && <p className="mt-1.5 max-w-3xl text-sm text-pretty text-muted">{children}</p>}
      </div>
      {actions}
    </div>
  );
}
