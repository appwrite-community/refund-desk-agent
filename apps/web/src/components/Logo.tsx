import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** A pour-over cone on a server rim, with one drop. */
export function LogoMark({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn('size-6', className)} {...props}>
      <g stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16l-5 9H9z" />
        <path d="M6 14h12" />
      </g>
      <circle cx={12} cy={18.4} r={1.6} fill="currentColor" />
    </svg>
  );
}

export function Logo({ surface, className }: { surface?: 'desk' | 'support'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-foreground', className)}>
      <LogoMark />
      <span className="text-[15px] leading-none font-semibold tracking-[-0.02em]">Pourhaven</span>
      {surface === 'desk' && (
        <span className="rounded-full border border-border-strong px-1.5 py-0.5 text-[11px] leading-none font-medium text-muted">
          Desk
        </span>
      )}
      {surface === 'support' && <span className="text-[15px] leading-none font-normal tracking-[-0.02em] text-muted">Support</span>}
    </span>
  );
}
