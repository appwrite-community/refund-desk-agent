import { AgentAvatar, PersonAvatar, StoreAvatar } from '@/components/Avatars';
import { RelativeTime } from '@/components/RelativeTime';
import type { RunStep } from '@/lib/types';

/** Customer-visible timeline rows. Row permissions decide which rows reach this page. */
export function Updates({ steps, customerName }: { steps: RunStep[]; customerName: string }) {
  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const actor = actorOf(step, customerName);
        return (
          <li key={step.$id} className="relative flex animate-rise gap-3.5 pb-6 last:pb-0">
            {index < steps.length - 1 && <span className="absolute top-7 bottom-1 left-3 w-px bg-border" aria-hidden />}
            {actor.avatar}
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-13">
                <span className="font-medium text-foreground">{actor.label}</span>
                <RelativeTime value={step.$createdAt} format="ago" className="text-xs text-subtle" />
              </p>
              <p className="mt-0.5 text-sm font-medium">{step.title}</p>
              {step.detail && <p className="mt-1 text-sm whitespace-pre-line text-muted">{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function actorOf(step: RunStep, customerName: string) {
  if (step.actor === 'customer') return { label: 'You', avatar: <PersonAvatar name={customerName} /> };
  if (step.actor === 'agent') {
    return {
      label: (
        <span className="inline-flex items-center gap-1.5">
          {step.actorName}
          <span className="size-1.5 rounded-full bg-iris" aria-hidden />
        </span>
      ),
      avatar: <AgentAvatar />,
    };
  }
  return { label: step.actorName, avatar: <StoreAvatar /> };
}
