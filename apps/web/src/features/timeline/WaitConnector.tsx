import { CalendarClock, Pause } from 'lucide-react';
import { dateTime, wait } from '@/lib/format';
import { cn } from '@/lib/utils';

const WHO = { staff: 'staff', customer: 'the customer', return: 'the return check' } as const;

type WaitConnectorProps =
  | { mode: 'past'; ms: number; who: keyof typeof WHO }
  | { mode: 'live'; ms: number; who: 'staff' | 'customer' }
  | { mode: 'scheduled'; at: string | null };

/**
 * The gap between two runs. Nothing runs while the request waits: the state is
 * in TablesDB, and the next event starts a new execution.
 */
export function WaitConnector(props: WaitConnectorProps) {
  return (
    <div className="relative flex gap-3 py-1" role="note">
      <span className="absolute top-0 bottom-0 left-2.5 border-l border-dashed border-border-strong" aria-hidden />
      <span
        className={cn(
          'relative my-2 flex size-5 shrink-0 items-center justify-center rounded-full border bg-background',
          props.mode === 'live' ? 'border-amber/40 text-amber' : 'border-border-strong text-subtle',
        )}
      >
        {props.mode === 'scheduled' ? (
          <CalendarClock className="size-3" strokeWidth={2} aria-hidden />
        ) : (
          <Pause className="size-2.5 fill-current" strokeWidth={0} aria-hidden />
        )}
      </span>
      <p className="my-2 text-xs leading-5 text-muted">
        {props.mode === 'past' && (
          <>
            Waited <span className="font-medium text-foreground tabular">{wait(props.ms)}</span> for {WHO[props.who]}.{' '}
            <span className="text-subtle">No execution ran.</span>
          </>
        )}
        {props.mode === 'live' && (
          <>
            <span className="font-medium text-foreground">Waiting for {WHO[props.who]}</span>
            <span className="text-subtle"> · </span>
            <span className="font-medium text-foreground tabular">{wait(props.ms)}</span>
            <span className="block text-subtle">No execution is running.</span>
          </>
        )}
        {props.mode === 'scheduled' && (
          <>
            <span className="font-medium text-foreground">Next return check {props.at ? dateTime(props.at) : 'soon'}</span>
            <span className="block text-subtle">A delayed execution. Nothing runs until then.</span>
          </>
        )}
      </p>
    </div>
  );
}
