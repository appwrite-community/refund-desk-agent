import { toMs } from '@/lib/format';
import type { RequestStatus, RunStep } from '@/lib/types';

export type RunKind = 'intake' | 'decision' | 'reply' | 'return_check';

/** One execution of the refund agent and the steps it wrote. */
export type Run = {
  runId: string;
  number: number;
  kind: RunKind | null;
  trigger: RunStep | null;
  steps: RunStep[];
  startedAt: number;
  endedAt: number;
  running: boolean;
};

const RUN_LABELS: Record<RunKind, string> = {
  intake: 'New request',
  decision: 'Staff decision',
  reply: 'Customer reply',
  return_check: 'Return check',
};

// The first write of every run is its trigger step, saved under an ID derived
// from what started it: req_<requestId>, apr_<approvalId>, rep_<approvalId>, chk_<requestId>_<attempt>.
const TRIGGER_PREFIXES: Record<string, RunKind> = { req: 'intake', apr: 'decision', rep: 'reply', chk: 'return_check' };

export function runLabel(run: Run) {
  // A decision made outside the staff team is not carried out; the agent reopens the recommendation.
  if (run.kind === 'decision' && run.trigger?.actor === 'agent') return 'Ignored decision';
  return run.kind ? RUN_LABELS[run.kind] : (run.trigger?.title ?? 'Run');
}

const stepEnd = (step: RunStep) => toMs(step.$createdAt) + (step.durationMs ?? 0);

export const byCreation = (a: RunStep, b: RunStep) =>
  a.$createdAt.localeCompare(b.$createdAt) || Number(a.$sequence) - Number(b.$sequence);

/** Groups timeline rows into runs, in the order the runs started. */
export function groupRuns(steps: RunStep[], status: RequestStatus): Run[] {
  const runs = new Map<string, RunStep[]>();
  for (const step of [...steps].sort(byCreation)) {
    runs.set(step.runId, [...(runs.get(step.runId) ?? []), step]);
  }
  const grouped = [...runs.entries()].map(([runId, rows], index): Run => {
    const trigger = rows.find((row) => row.kind === 'trigger') ?? null;
    const prefix = trigger?.$id.split('_')[0] ?? '';
    return {
      runId,
      number: index + 1,
      kind: TRIGGER_PREFIXES[prefix] ?? null,
      trigger,
      steps: rows.filter((row) => row !== trigger),
      startedAt: toMs(rows[0]!.$createdAt),
      endedAt: Math.max(...rows.map(stepEnd)),
      running: false,
    };
  });
  const last = grouped.at(-1);
  if (last && status === 'working' && !last.steps.some((step) => step.kind === 'finish')) last.running = true;
  return grouped;
}

/** Who the request is waiting for after its last run, if anyone. */
export function waitingFor(status: RequestStatus): 'staff' | 'customer' | 'return' | null {
  if (status === 'needs_approval') return 'staff';
  if (status === 'needs_customer') return 'customer';
  if (status === 'awaiting_return') return 'return';
  return null;
}
