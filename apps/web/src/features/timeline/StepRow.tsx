import {
  Archive,
  BadgeDollarSign,
  BookOpen,
  CalendarClock,
  CircleCheck,
  CircleDot,
  CircleX,
  Eye,
  History,
  Hourglass,
  MessageCircleQuestionMark,
  MessageSquare,
  PackageOpen,
  PenLine,
  Receipt,
  ScanSearch,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useNow } from '@/hooks/use-now';
import { AgentAvatar, PersonAvatar, ScheduleAvatar, StoreAvatar } from '@/components/Avatars';
import { Tooltip } from '@/components/ui/tooltip';
import { duration, timestamp, toMs } from '@/lib/format';
import type { RunStep } from '@/lib/types';
import { cn } from '@/lib/utils';

const TOOL_ICONS: Record<string, LucideIcon> = {
  get_order: Receipt,
  get_refund_history: History,
  read_policy: BookOpen,
  inspect_photo: ScanSearch,
  issue_refund: BadgeDollarSign,
  request_approval: UserCheck,
  write_message: PenLine,
};

const FINISH: Record<string, { icon: LucideIcon; className: string }> = {
  Refunded: { icon: CircleCheck, className: 'text-green' },
  Declined: { icon: CircleX, className: 'text-rose' },
  Closed: { icon: Archive, className: 'text-muted' },
  'Waiting for staff': { icon: Hourglass, className: 'text-amber' },
  'Waiting for the customer': { icon: MessageCircleQuestionMark, className: 'text-sky' },
  'Waiting for the return': { icon: PackageOpen, className: 'text-muted' },
};

const ACTOR_ROLES: Record<RunStep['actor'], string> = { staff: 'Staff', customer: 'Customer', system: 'Scheduled', agent: 'Agent' };

const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

/** The icon or avatar in the rail. Agent steps are iris; people are neutral initials. */
function Marker({ step }: { step: RunStep }) {
  if (step.kind === 'trigger') {
    if (step.actor === 'system') return <ScheduleAvatar size="xs" />;
    if (step.actor === 'agent') return <AgentAvatar size="xs" />;
    return <PersonAvatar name={step.actorName} size="xs" />;
  }
  if (step.kind === 'message' && step.actor === 'system') return <StoreAvatar size="xs" />;

  const finish = step.kind === 'finish' ? FINISH[step.title] : undefined;
  const Icon =
    step.kind === 'error'
      ? TriangleAlert
      : finish
        ? finish.icon
        : step.kind === 'message'
          ? MessageSquare
          : step.kind === 'tool'
            ? (TOOL_ICONS[step.tool ?? ''] ?? CircleDot)
            : step.title.startsWith('Issued refund')
              ? BadgeDollarSign
              : step.title.startsWith('Scheduled')
                ? CalendarClock
                : CircleDot;

  return (
    <span
      className={cn(
        'relative flex size-5 shrink-0 items-center justify-center rounded-[6px]',
        step.kind === 'error' || step.status === 'failed'
          ? 'bg-rose/12 text-rose ring-1 ring-rose/30 ring-inset'
          : finish
            ? cn('bg-raised ring-1 ring-border-strong ring-inset', finish.className)
            : 'bg-iris/12 text-iris ring-1 ring-iris/30 ring-inset',
      )}
    >
      <Icon className="size-3" strokeWidth={2} aria-hidden />
      {step.status === 'running' && <span className="absolute -top-0.5 -right-0.5 size-1.5 animate-agent-pulse rounded-full bg-iris" aria-hidden />}
    </span>
  );
}

export function StepRow({ step, last }: { step: RunStep; last: boolean }) {
  const detail = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const person = step.kind === 'trigger';
  const running = step.status === 'running';

  // Measure again when the column width changes (for example when the timeline gains a scrollbar)
  // and once the font has loaded.
  useLayoutEffect(() => {
    const element = detail.current;
    if (!element || expanded) return;
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    void document.fonts.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [step.detail, expanded]);

  return (
    <li className="group/step relative flex animate-rise gap-3 pb-3.5">
      {!last && <span className="absolute top-6 bottom-0.5 left-2.5 w-px bg-border" aria-hidden />}
      <span className="relative mt-px">
        <Marker step={step} />
      </span>
      <div className="min-w-0 flex-1">
        {person && (
          <p className="text-xs text-muted">
            <span className="font-medium text-foreground">{step.actorName}</span>
            <span className="text-subtle"> · {ACTOR_ROLES[step.actor]}</span>
          </p>
        )}
        <div className="flex items-start gap-2">
          <p className={cn('min-w-0 flex-1 text-13 font-medium', running ? 'text-shimmer' : step.kind === 'error' ? 'text-rose' : 'text-foreground')}>
            {step.title}
          </p>
          <span className="mt-px flex shrink-0 items-center gap-1.5 font-mono text-[11px] leading-[18px] text-subtle tabular">
            {step.visibility === 'customer' && (
              <Tooltip content="The customer sees this update">
                <span className="inline-flex" tabIndex={0}>
                  <Eye className="size-3.5" aria-label="Visible to the customer" />
                </span>
              </Tooltip>
            )}
            <Tooltip content={timestamp(step.$createdAt)}>
              <span>
                {running ? (
                  <Elapsed since={step.$createdAt} />
                ) : step.durationMs !== null ? (
                  duration(step.durationMs)
                ) : (
                  clock.format(new Date(step.$createdAt))
                )}
              </span>
            </Tooltip>
          </span>
        </div>
        {step.detail && (
          <>
            <p
              ref={detail}
              className={cn('mt-0.5 text-xs leading-[18px] break-words whitespace-pre-line text-muted', !expanded && 'line-clamp-2')}
            >
              {step.detail}
            </p>
            {(clamped || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mt-0.5 rounded-[4px] text-xs font-medium text-subtle transition-colors hover:text-foreground"
                aria-expanded={expanded}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** A tool call in progress: its running time, updated live. */
function Elapsed({ since }: { since: string }) {
  const now = useNow(200);
  return <span className="text-iris">{duration(Math.max(0, now - toMs(since)))}</span>;
}
