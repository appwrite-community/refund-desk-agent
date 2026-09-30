import { useQuery } from '@tanstack/react-query';
import { Archive, CircleCheck, CircleX, Inbox, MessageCircleQuestionMark, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AgentAvatar } from '@/components/Avatars';
import { Chip } from '@/components/Chip';
import { CopyButton } from '@/components/CopyButton';
import { RelativeTime } from '@/components/RelativeTime';
import { Skeleton } from '@/components/ui/skeleton';
import { dateTime, money } from '@/lib/format';
import { paymentQuery } from '@/lib/queries';
import { recommendationLabel, recommendationTone } from '@/lib/status';
import type { Approval, RefundRequest, RunStep } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Panel } from './Panel';

const DECISION_VERBS = { approve: 'Approved', decline: 'Declined', ask_customer: 'Asked the customer' } as const;

/** A thin iris bar that means "the agent is on it". */
function AgentProgress() {
  return (
    <span className="absolute inset-x-0 top-0 h-px overflow-hidden bg-iris/20" aria-hidden>
      <span className="block h-full w-1/3 animate-progress bg-gradient-to-r from-transparent via-iris to-transparent" />
    </span>
  );
}

export function AgentWorkingCard({ current }: { current: RunStep | undefined }) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-iris/30 bg-surface px-5 py-4" aria-live="polite">
      <AgentProgress />
      <div className="flex items-center gap-3">
        <AgentAvatar size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">The refund agent is working on this request</p>
          <p className={cn('mt-0.5 truncate text-13', current?.status === 'running' ? 'text-shimmer' : 'text-muted')}>
            {current ? current.title : 'Starting the run'}
          </p>
        </div>
      </div>
    </section>
  );
}

export function SubmittedCard() {
  return (
    <StateCard icon={Inbox} title="Waiting for the agent to start">
      The request event queues a refund-agent execution. It usually starts within a few seconds.
    </StateCard>
  );
}

/** Shown between a staff click and the end of the run it starts. */
export function DecidedCard({ approval, viewerId }: { approval: Approval; viewerId: string }) {
  const byMe = approval.decidedBy === viewerId;
  const verb = approval.decision === 'approve' && approval.requireReturn ? 'Approved with a return' : DECISION_VERBS[approval.decision ?? 'approve'];
  return (
    <section className="relative overflow-hidden rounded-lg border border-iris/30 bg-surface px-5 py-4" aria-live="polite">
      <AgentProgress />
      <div className="flex items-center gap-3">
        <AgentAvatar size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {verb} by {byMe ? 'you' : approval.decidedByName}
            {!byMe && approval.decidedAt && (
              <span className="font-normal text-muted">
                {' '}
                <RelativeTime value={approval.decidedAt} format="ago" />
              </span>
            )}
          </p>
          <p className="mt-0.5 text-13 text-muted">The refund agent is finishing the request.</p>
        </div>
      </div>
    </section>
  );
}

export function QuestionCard({ request, approval }: { request: RefundRequest; approval: Approval | undefined }) {
  return (
    <Panel
      title="Question sent to the customer"
      aside={
        approval?.decidedAt && (
          <span className="text-xs text-muted">
            {approval.decidedByName} · <RelativeTime value={approval.decidedAt} format="ago" />
          </span>
        )
      }
    >
      <div className="flex gap-3 px-5 py-4">
        <MessageCircleQuestionMark className="mt-0.5 size-4 shrink-0 text-sky" strokeWidth={1.75} aria-hidden />
        <div>
          <p className="text-sm whitespace-pre-line">{request.question}</p>
          <p className="mt-2 text-xs text-muted">The customer answers on their request page. The answer starts a new run.</p>
        </div>
      </div>
    </Panel>
  );
}

/** The final result of a resolved request. */
export function OutcomeCard({ request, steps }: { request: RefundRequest; steps: RunStep[] }) {
  const lastMessage = steps.findLast((step) => step.kind === 'message' && step.visibility === 'customer');
  if (request.status === 'refunded') return <RefundOutcome request={request} />;
  const declined = request.status === 'declined';
  return (
    <StateCard icon={declined ? CircleX : Archive} tone={declined ? 'rose' : undefined} title={declined ? 'Declined' : 'Closed'}>
      {lastMessage?.detail ? (
        <>
          <span className="mb-1 block text-xs text-subtle">Message to the customer</span>
          <span className="block whitespace-pre-line text-foreground/90">{lastMessage.detail}</span>
        </>
      ) : (
        'This request is closed.'
      )}
    </StateCard>
  );
}

function RefundOutcome({ request }: { request: RefundRequest }) {
  const payment = useQuery({ ...paymentQuery(request.refundId ?? ''), enabled: Boolean(request.refundId) });
  return (
    <section className="rounded-lg border border-green/25 bg-surface">
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="flex size-8 items-center justify-center rounded-full border border-green/30 bg-green/12 text-green">
          <CircleCheck className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">Refunded {money(payment.data?.amountCents ?? request.amountCents)}</p>
          <div className="mt-0.5 text-13 text-muted">
            {payment.data ? (
              <>
                To {payment.data.cardBrand} ending {payment.data.cardLast4} · {dateTime(payment.data.$createdAt)}
              </>
            ) : (
              <Skeleton className="mt-1 h-3.5 w-48" />
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-5 py-2.5 text-xs text-subtle">
        Payment reference
        {payment.data ? (
          <span className="flex items-center gap-1.5 font-mono text-muted">
            {payment.data.reference}
            <CopyButton value={payment.data.reference} label="Copy reference" />
          </span>
        ) : (
          <Skeleton className="h-3.5 w-32" />
        )}
      </div>
    </section>
  );
}

function StateCard({ icon: Icon, title, tone, children }: { icon: LucideIcon; title: string; tone?: 'rose'; children: ReactNode }) {
  return (
    <section className={cn('rounded-lg border bg-surface px-5 py-4', tone === 'rose' ? 'border-rose/25' : 'border-border')}>
      <div className="flex gap-3">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full border',
            tone === 'rose' ? 'border-rose/30 bg-rose/12 text-rose' : 'border-border-strong bg-raised text-muted',
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm font-medium">{title}</p>
          <div className="mt-1 text-13 text-muted">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Past recommendations and what staff decided. */
export function DecisionHistory({ approvals }: { approvals: Approval[] }) {
  if (approvals.length === 0) return null;
  return (
    <Panel title="Decisions">
      <ol className="divide-y divide-border">
        {approvals.map((approval) => (
          <li key={approval.$id} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2 text-13">
              <span className="text-muted">Agent recommended</span>
              <Chip tone={recommendationTone(approval.recommendation)} size="sm">
                {recommendationLabel(approval.recommendation, approval.amountCents)}
              </Chip>
            </div>
            {approval.decision ? (
              <p className="mt-1.5 text-13">
                <span className="font-medium">{approval.decidedByName}</span>{' '}
                <span className="text-muted">
                  {(approval.decision === 'approve' && approval.requireReturn ? 'approved with a return' : DECISION_VERBS[approval.decision].toLowerCase())}
                  {approval.decidedAt && (
                    <>
                      {' '}
                      <RelativeTime value={approval.decidedAt} format="ago" />
                    </>
                  )}
                </span>
              </p>
            ) : (
              <p className="mt-1.5 flex items-center gap-1.5 text-13 text-muted">
                <TriangleAlert className="size-3.5 text-amber" aria-hidden />
                No decision recorded
              </p>
            )}
            {approval.staffNote && <p className="mt-1.5 border-l-2 border-border-strong pl-3 text-13 whitespace-pre-line text-muted">{approval.staffNote}</p>}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
