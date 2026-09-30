import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { TONE_CLASSES, type Tone } from '@/lib/status';
import { cn } from '@/lib/utils';

type ChipProps = {
  tone?: Tone | 'neutral';
  icon?: LucideIcon;
  /** Shows a dot instead of an icon. Pulses for the agent. */
  dot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
};

/** A status or label chip. Always text plus a dot or icon, never color alone. */
export function Chip({ tone = 'neutral', icon: Icon, dot, pulse, size = 'md', className, children }: ChipProps) {
  const colors = tone === 'neutral' ? null : TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'md' ? 'h-6 px-2.5 text-xs' : 'h-5 px-2 text-[11px]',
        colors ? [colors.soft, colors.text] : 'border-border-strong bg-raised text-muted',
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', colors?.dot ?? 'bg-muted', pulse && 'animate-agent-pulse')} />}
      {Icon && !dot && <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />}
      {children}
    </span>
  );
}
