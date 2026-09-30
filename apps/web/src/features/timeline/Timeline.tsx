import { Activity } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { EmptyState } from '@/components/States';
import { useNow } from '@/hooks/use-now';
import type { RefundRequest, RunStep } from '@/lib/types';
import { groupRuns, waitingFor } from './model';
import { RunGroup } from './RunGroup';
import { WaitConnector } from './WaitConnector';

/** Every run of the agent on one request, with the waits between them. */
export function Timeline({ steps, request }: { steps: RunStep[]; request: RefundRequest }) {
  const now = useNow(1000);
  const runs = useMemo(() => groupRuns(steps, request.status), [steps, request.status]);
  const end = useRef<HTMLDivElement>(null);
  const waiting = waitingFor(request.status);
  const lastRun = runs.at(-1);

  // Follow new steps while the agent works, like a log.
  useEffect(() => {
    if (lastRun?.running) end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [steps.length, lastRun?.running]);

  if (runs.length === 0) {
    return (
      <EmptyState icon={Activity} title="No activity yet" className="py-10">
        The agent writes a step here for every tool call.
      </EmptyState>
    );
  }

  return (
    <div>
      {runs.map((run, index) => {
        const next = runs[index + 1];
        const who = next?.trigger?.actor === 'staff' ? 'staff' : next?.trigger?.actor === 'customer' ? 'customer' : 'return';
        return (
          <Fragment key={run.runId}>
            <RunGroup run={run} now={now} />
            {next && <WaitConnector mode="past" ms={next.startedAt - run.endedAt} who={who} />}
          </Fragment>
        );
      })}
      {lastRun && (waiting === 'staff' || waiting === 'customer') && (
        <WaitConnector mode="live" ms={now - lastRun.endedAt} who={waiting} />
      )}
      {lastRun && waiting === 'return' && request.returnCheckAt && new Date(request.returnCheckAt).getTime() > now && (
        <WaitConnector mode="scheduled" at={request.returnCheckAt} />
      )}
      <div ref={end} />
    </div>
  );
}
