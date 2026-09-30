import { Bot, CalendarClock } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { LogoMark } from './Logo';

const sizes = { xs: 'size-5 text-[9px]', sm: 'size-6 text-[10px]', md: 'size-8 text-xs' };
const iconSizes = { xs: 'size-3', sm: 'size-3.5', md: 'size-4' };

type Size = keyof typeof sizes;

/** The refund agent: always the iris ring. */
export function AgentAvatar({ size = 'sm', className }: { size?: Size; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-iris/14 text-iris ring-1 ring-iris/60 ring-inset',
        sizes[size],
        className,
      )}
    >
      <Bot className={iconSizes[size]} strokeWidth={1.75} aria-hidden />
    </span>
  );
}

export function PersonAvatar({ name, size = 'sm', className }: { name: string; size?: Size; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border-strong bg-raised font-semibold tracking-wide text-muted',
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Messages the store sends in its own name. */
export function StoreAvatar({ size = 'sm', className }: { size?: Size; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-foreground text-background', sizes[size], className)}
      aria-hidden
    >
      <LogoMark className={iconSizes[size]} strokeWidth={2.4} />
    </span>
  );
}

/** Scheduled return checks. */
export function ScheduleAvatar({ size = 'sm', className }: { size?: Size; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-border-strong bg-raised text-muted', sizes[size], className)}
      aria-hidden
    >
      <CalendarClock className={iconSizes[size]} strokeWidth={1.75} />
    </span>
  );
}
