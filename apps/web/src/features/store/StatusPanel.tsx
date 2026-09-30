import { useQuery } from '@tanstack/react-query';
import { Archive, CircleCheck, CircleX, Inbox, PackageCheck, PackageOpen, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AgentAvatar, StoreAvatar } from '@/components/Avatars';
import { CopyButton } from '@/components/CopyButton';
import { Skeleton } from '@/components/ui/skeleton';
import { dateTime, money, shortDate } from '@/lib/format';
import { paymentQuery } from '@/lib/queries';
import type { RefundRequest, RunStep } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AnswerForm } from './AnswerForm';

const RETURN_ADDRESS = ['Pourhaven Returns', '1200 Harbor Way, Unit 4', 'Oakland, CA 94607'];
const SUPPORT_EMAIL = 'support@pourhaven.example';

/** The main panel of the customer's request page. It changes with the request status. */
export function StatusPanel({ request, steps }: { request: RefundRequest; steps: RunStep[] }) {
  const lastMessage = steps.findLast((step) => step.kind === 'message')?.detail;

  switch (request.status) {
    case 'submitted':
      return (
        <Panel icon={Inbox} title="Request received">
          Our refund agent will start in a moment.
        </Panel>
      );
    case 'working':
      return (
        <Panel marker={<AgentAvatar size="md" className="animate-agent-pulse" />} title="Our refund agent is reviewing your request" agent>
          This usually takes about a minute. You can close this page.
        </Panel>
      );
    case 'needs_approval':
      return (
        <Panel icon={Users} title="A member of our support team is reviewing your request">
          They reply within one business day. This page updates as soon as they do.
        </Panel>
      );
    case 'needs_customer':
      return <QuestionPanel request={request} />;
    case 'awaiting_return':
      return <ReturnPanel request={request} />;
    case 'refunded':
      return <RefundedPanel request={request} />;
    case 'declined':
      return (
        <Panel icon={CircleX} tone="rose" title="We cannot refund this item">
          <span className="block whitespace-pre-line text-foreground/90">{lastMessage ?? 'We reviewed your request and cannot offer a refund.'}</span>
          <span className="mt-3 block">
            Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline-offset-4 hover:underline">{SUPPORT_EMAIL}</a>.
          </span>
        </Panel>
      );
    case 'closed':
      return (
        <Panel icon={Archive} title="This request is closed">
          <span className="block text-foreground/90">{lastMessage ?? 'This request is closed.'}</span>
        </Panel>
      );
  }
}

type PanelProps = {
  icon?: LucideIcon;
  marker?: ReactNode;
  title: string;
  tone?: 'green' | 'rose';
  agent?: boolean;
  children: ReactNode;
};

function Panel({ icon: Icon, marker, title, tone, agent, children }: PanelProps) {
  return (
    <section className={cn('relative overflow-hidden rounded-lg border bg-surface p-6', agent ? 'border-iris/30' : 'border-border')} aria-live="polite">
      {agent && (
        <span className="absolute inset-x-0 top-0 h-px overflow-hidden bg-iris/20" aria-hidden>
          <span className="block h-full w-1/3 animate-progress bg-gradient-to-r from-transparent via-iris to-transparent" />
        </span>
      )}
      <div className="flex gap-4">
        {marker ?? (
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full border',
              tone === 'green' && 'border-green/30 bg-green/12 text-green',
              tone === 'rose' && 'border-rose/30 bg-rose/12 text-rose',
              !tone && 'border-border-strong bg-raised text-muted',
            )}
          >
            {Icon && <Icon className="size-4" strokeWidth={1.75} aria-hidden />}
          </span>
        )}
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
          <div className="mt-1 text-sm text-muted">{children}</div>
        </div>
      </div>
    </section>
  );
}

function QuestionPanel({ request }: { request: RefundRequest }) {
  return (
    <section className="overflow-hidden rounded-lg border border-sky/30 bg-surface" aria-live="polite">
      <div className="flex gap-4 p-6 pb-5">
        <StoreAvatar size="md" />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-xs font-medium tracking-wide text-sky uppercase">Question from Pourhaven</p>
          <p className="mt-1.5 text-base whitespace-pre-line text-foreground">{request.question}</p>
        </div>
      </div>
      <AnswerForm requestId={request.$id} />
    </section>
  );
}

function ReturnPanel({ request }: { request: RefundRequest }) {
  const received = request.returnStatus === 'received';
  return (
    <section className="rounded-lg border border-border bg-surface" aria-live="polite">
      <div className="flex gap-4 p-6">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-raised text-muted">
          {received ? <PackageCheck className="size-4" strokeWidth={1.75} aria-hidden /> : <PackageOpen className="size-4" strokeWidth={1.75} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-base font-semibold tracking-[-0.01em]">{received ? 'We received your item' : 'Send the item back'}</h2>
          <p className="mt-1 text-sm text-muted">
            {received
              ? `Your refund of ${money(request.amountCents)} follows at our next check.`
              : `Ship it within 7 days with the return code below. We refund ${money(request.amountCents)} as soon as it arrives.`}
          </p>
        </div>
      </div>
      <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2">
        <div className="bg-surface px-6 py-4">
          <p className="text-xs text-subtle">Return code</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-base font-medium tracking-wide">
            {request.returnCode}
            {request.returnCode && <CopyButton value={request.returnCode} label="Copy return code" />}
          </p>
        </div>
        <div className="bg-surface px-6 py-4">
          <p className="text-xs text-subtle">{received ? 'Received' : 'We check for it on'}</p>
          <p className="mt-1 text-sm font-medium">
            {received && request.returnReceivedAt
              ? dateTime(request.returnReceivedAt)
              : request.returnCheckAt
                ? shortDate(request.returnCheckAt)
                : 'Soon'}
          </p>
        </div>
        <address className="bg-surface px-6 py-4 text-sm not-italic sm:col-span-2">
          <span className="block text-xs text-subtle">Ship to</span>
          <span className="mt-1 block">
            {RETURN_ADDRESS.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
        </address>
      </div>
    </section>
  );
}

function RefundedPanel({ request }: { request: RefundRequest }) {
  const payment = useQuery({ ...paymentQuery(request.refundId ?? ''), enabled: Boolean(request.refundId) });
  return (
    <section className="rounded-lg border border-green/25 bg-surface" aria-live="polite">
      <div className="flex gap-4 p-6">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-green/30 bg-green/12 text-green">
          <CircleCheck className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-base font-semibold tracking-[-0.01em]">Refund issued</h2>
          <p className="mt-1 text-sm text-muted">Refunds usually show up in 5 to 10 business days.</p>
        </div>
      </div>
      <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
        <div className="bg-surface px-6 py-4">
          <dt className="text-xs text-subtle">Amount</dt>
          <dd className="mt-1 text-xl font-semibold tracking-[-0.02em] tabular">{money(payment.data?.amountCents ?? request.amountCents)}</dd>
        </div>
        <div className="bg-surface px-6 py-4">
          <dt className="text-xs text-subtle">Refunded to</dt>
          <dd className="mt-1 text-sm font-medium">
            {payment.data ? `${payment.data.cardBrand} ending ${payment.data.cardLast4}` : <Skeleton className="mt-1.5 h-4 w-28" />}
          </dd>
        </div>
        <div className="bg-surface px-6 py-4">
          <dt className="text-xs text-subtle">Reference</dt>
          <dd className="mt-1 flex items-center gap-2 font-mono text-13">
            {payment.data ? (
              <>
                {payment.data.reference}
                <CopyButton value={payment.data.reference} label="Copy reference" />
              </>
            ) : (
              <Skeleton className="mt-1.5 h-4 w-36" />
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
