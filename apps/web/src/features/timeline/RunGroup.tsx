import { AgentAvatar } from '@/components/Avatars';
import { CopyButton } from '@/components/CopyButton';
import { duration } from '@/lib/format';
import { runLabel, type Run } from './model';
import { StepRow } from './StepRow';

export function RunGroup({ run, now }: { run: Run; now: number }) {
  const rows = run.trigger ? [run.trigger, ...run.steps] : run.steps;
  const elapsed = (run.running ? now : run.endedAt) - run.startedAt;

  return (
    <section aria-label={`Run ${run.number}: ${runLabel(run)}`} className="py-1">
      <header className="mb-3 flex items-center gap-2.5">
        <AgentAvatar size="xs" />
        <p className="min-w-0 flex-1 truncate text-xs">
          <span className="font-semibold text-foreground">Run {run.number}</span>
          <span className="text-subtle"> · </span>
          <span className="text-muted">{runLabel(run)}</span>
        </p>
        <span className={run.running ? 'font-mono text-[11px] text-iris tabular' : 'font-mono text-[11px] text-subtle tabular'}>
          {duration(Math.max(0, elapsed))}
        </span>
      </header>
      <ol>
        {rows.map((step, index) => (
          <StepRow key={step.$id} step={step} last={index === rows.length - 1} />
        ))}
      </ol>
      <p className="mt-0.5 flex items-center gap-1.5 pl-8 font-mono text-[11px] text-subtle">
        <span>Execution {run.runId.slice(0, 10)}</span>
        <CopyButton value={run.runId} label="Copy execution ID" />
      </p>
    </section>
  );
}
