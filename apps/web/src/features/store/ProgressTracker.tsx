import { Check } from 'lucide-react';
import type { RequestStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Index of the current stage; a stage below it is done. 4 means everything is done. */
const CURRENT: Record<RequestStatus, number> = {
  submitted: 0,
  working: 1,
  needs_approval: 2,
  needs_customer: 2,
  awaiting_return: 3,
  refunded: 4,
  declined: 4,
  closed: 4,
};

const FINAL_LABEL: Partial<Record<RequestStatus, string>> = {
  refunded: 'Refunded',
  declined: 'Declined',
  closed: 'Closed',
  awaiting_return: 'Return and refund',
};

export function ProgressTracker({ status }: { status: RequestStatus }) {
  const current = CURRENT[status];
  const stages = ['Submitted', 'Reviewing', 'Decision', FINAL_LABEL[status] ?? 'Refund'];

  return (
    <ol className="flex items-center" aria-label="Request progress">
      {stages.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className={cn('flex items-center', index < stages.length - 1 && 'flex-1')} aria-current={active ? 'step' : undefined}>
            <span className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                  done && 'border-foreground bg-foreground text-background',
                  active && (status === 'working' ? 'border-iris text-iris' : 'border-foreground text-foreground'),
                  !done && !active && 'border-border-strong text-subtle',
                )}
              >
                {done ? (
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                ) : (
                  <span className={cn('size-1.5 rounded-full', active ? (status === 'working' ? 'animate-agent-pulse bg-iris' : 'bg-foreground') : 'bg-border-strong')} />
                )}
              </span>
              <span className={cn('text-13 whitespace-nowrap', done || active ? 'font-medium text-foreground' : 'text-subtle')}>
                {label}
                <span className="sr-only">{done ? ' (done)' : active ? ' (current)' : ''}</span>
              </span>
            </span>
            {index < stages.length - 1 && (
              <span className={cn('mx-3 h-px min-w-4 flex-1', index < current ? 'bg-foreground/50' : 'bg-border-strong')} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
