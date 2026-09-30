import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AppwriteException } from 'appwrite';
import { ArrowLeft, CreditCard, FileSearch, PackageCheck, Receipt, TriangleAlert } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { PersonAvatar } from '@/components/Avatars';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState } from '@/components/States';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { groupRuns } from '@/features/timeline/model';
import { Timeline } from '@/features/timeline/Timeline';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useNow } from '@/hooks/use-now';
import { usePageTitle } from '@/hooks/use-page-title';
import { deliveredAgo, money, TIME, timestamp, toMs } from '@/lib/format';
import { approvalsQuery, deskRequestsQuery, orderQuery, repliesQuery, requestQuery, stepsQuery, type Viewer } from '@/lib/queries';
import { useCaseRealtime } from '@/lib/realtime';
import { requestNumber, type Approval, type RefundRequest, type RunStep } from '@/lib/types';
import { ApprovalCard } from './ApprovalCard';
import { ClaimCard } from './ClaimCard';
import { ReturnCard } from './ReturnCard';
import { AgentWorkingCard, DecidedCard, DecisionHistory, OutcomeCard, QuestionCard, SubmittedCard } from './StateCards';

const STALLED_AFTER = 6 * TIME.MINUTE;
const NOT_STARTED_AFTER = 2 * TIME.MINUTE;

export function RequestDetail({ requestId, queue, viewer }: { requestId: string; queue: string; viewer: Viewer }) {
  useCaseRealtime(requestId);
  const queryClient = useQueryClient();
  const wide = useMediaQuery('(min-width: 75rem)');

  const request = useQuery({
    ...requestQuery(requestId),
    initialData: () => queryClient.getQueryData(deskRequestsQuery.queryKey)?.find((row) => row.$id === requestId),
    initialDataUpdatedAt: () => queryClient.getQueryState(deskRequestsQuery.queryKey)?.dataUpdatedAt,
  });
  const steps = useQuery(stepsQuery(requestId));
  const approvals = useQuery(approvalsQuery(requestId));
  const replies = useQuery(repliesQuery(requestId));
  usePageTitle(request.data ? `${requestNumber(request.data)} ${request.data.itemName}` : 'Desk');

  if (request.isError) {
    const missing = request.error instanceof AppwriteException && request.error.code === 404;
    return missing ? (
      <EmptyState icon={FileSearch} title="This request does not exist" className="h-full">
        It may have been removed, or the link is incomplete.
      </EmptyState>
    ) : (
      <div className="p-6">
        <ErrorState title="Could not load this request." onRetry={() => void request.refetch()} />
      </div>
    );
  }
  if (request.isPending) return <DetailSkeleton />;

  const timeline = steps.isError ? (
    <ErrorState title="Could not load the timeline." onRetry={() => void steps.refetch()} />
  ) : steps.data ? (
    <Timeline steps={steps.data} request={request.data} />
  ) : (
    <TimelineSkeleton />
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto scrollbar-thin">
        <DetailHeader request={request.data} queue={queue} />
        <div className="space-y-4 p-6">
          <Banners request={request.data} />
          <CaseCards
            request={request.data}
            steps={steps.data}
            approvals={approvals.data}
            viewer={viewer}
            loading={approvals.isPending || steps.isPending}
          />
          {replies.isError ? (
            <ErrorState title="Could not load the customer's answers." onRetry={() => void replies.refetch()} />
          ) : (
            <ClaimCard request={request.data} replies={replies.data ?? []} />
          )}
        </div>
        {!wide && (
          <section className="border-t border-border px-6 py-5" aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="mb-4 text-13 font-medium">
              Activity
            </h2>
            {timeline}
          </section>
        )}
      </div>
      {wide && (
        <aside className="flex w-[344px] shrink-0 flex-col border-l border-border bg-surface/40" aria-labelledby="activity-heading">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-5">
            <h2 id="activity-heading" className="text-13 font-medium">
              Activity
            </h2>
            {steps.data && <RunCount steps={steps.data} />}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">{timeline}</div>
        </aside>
      )}
    </div>
  );
}

function RunCount({ steps }: { steps: RunStep[] }) {
  const runs = new Set(steps.map((step) => step.runId)).size;
  if (runs === 0) return null;
  return (
    <span className="text-xs text-subtle">
      {runs} {runs === 1 ? 'run' : 'runs'}
    </span>
  );
}

function DetailHeader({ request, queue }: { request: RefundRequest; queue: string }) {
  const order = useQuery(orderQuery(request.orderId));
  return (
    <header>
      <div className="flex h-14 items-center gap-3 border-b border-border px-6">
        <Link
          to="/desk/$queue"
          params={{ queue }}
          className="-ml-2 rounded-sm p-1.5 text-muted transition-colors hover:bg-raised hover:text-foreground desk:hidden"
          aria-label="Back to the list"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <h1 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold">
          <span className="font-mono text-13 font-medium text-subtle">{requestNumber(request)}</span>
          <span className="truncate">{request.itemName}</span>
        </h1>
        <StatusBadge status={request.status} size="sm" />
        <span className="ml-auto text-base font-semibold tracking-[-0.01em] tabular">{money(request.amountCents)}</span>
      </div>
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-6 py-2.5 text-13 text-muted">
        <Meta label="Customer" icon={<PersonAvatar name={request.customerName} size="xs" />}>
          <span className="text-foreground">{request.customerName}</span>
        </Meta>
        <Meta label="Order" icon={<Receipt className="size-3.5" aria-hidden />}>
          <span className="font-mono text-xs">{request.orderNumber}</span>
        </Meta>
        {order.data ? (
          <>
            {order.data.deliveredAt && (
              <Meta label="Delivery" icon={<PackageCheck className="size-3.5" aria-hidden />}>
                <Tooltip content={timestamp(order.data.deliveredAt)}>
                  <span>{deliveredAgo(order.data.deliveredAt)}</span>
                </Tooltip>
              </Meta>
            )}
            <Meta label="Payment" icon={<CreditCard className="size-3.5" aria-hidden />}>
              {order.data.cardBrand} {order.data.cardLast4}
            </Meta>
          </>
        ) : (
          <Skeleton className="h-4 w-56" />
        )}
      </dl>
    </header>
  );
}

function Meta({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="flex items-center text-subtle">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A run that has not written anything for a while was most likely stopped (for example by the function timeout). */
const isStalled = (request: RefundRequest, now: number) =>
  request.status === 'working' && now - toMs(request.$updatedAt) > STALLED_AFTER;

/** Event executions start within seconds; a request still waiting after minutes was never picked up. */
const isNotStarted = (request: RefundRequest, now: number) =>
  request.status === 'submitted' && now - toMs(request.$createdAt) > NOT_STARTED_AFTER;

function Banners({ request }: { request: RefundRequest }) {
  const now = useNow(15_000);
  if (isStalled(request, now)) {
    return (
      <Banner>
        The agent stopped before finishing. Check the refund-agent executions in the Appwrite Console.
      </Banner>
    );
  }
  if (isNotStarted(request, now)) {
    return <Banner>The agent has not started on this request yet. Check that the refund-agent function is enabled.</Banner>;
  }
  return null;
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-md border border-amber/25 bg-amber/8 px-4 py-3 text-13">
      <TriangleAlert className="mt-px size-4 shrink-0 text-amber" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

type CaseCardsProps = {
  request: RefundRequest;
  steps: RunStep[] | undefined;
  approvals: Approval[] | undefined;
  viewer: Viewer;
  loading: boolean;
};

/** The main card changes with the status; the decisions so far stay listed under it. */
function CaseCards({ request, steps, approvals, viewer, loading }: CaseCardsProps) {
  const now = useNow(15_000);
  const runs = useMemo(() => groupRuns(steps ?? [], request.status), [steps, request.status]);
  if (loading || !approvals || !steps) return <Skeleton className="h-52 rounded-lg" />;

  const latest = approvals[0];
  const pending = approvals.find((approval) => approval.$id === request.pendingApprovalId);
  const lastRun = runs.at(-1);
  // A decision is in flight from the click until the run it started finishes.
  const inFlight =
    latest?.decision &&
    ((request.status === 'needs_approval' && request.pendingApprovalId === latest.$id) ||
      (request.status === 'working' && lastRun?.trigger?.$id === `apr_${latest.$id}`))
      ? latest
      : null;
  const history = approvals.filter((approval) => approval.decision && approval !== inFlight);

  let main: ReactNode;
  if (inFlight) main = <DecidedCard approval={inFlight} viewerId={viewer.user.$id} />;
  else if (request.status === 'needs_approval') {
    main = pending ? <ApprovalCard key={pending.$id} approval={pending} request={request} viewer={viewer} /> : <Skeleton className="h-52 rounded-lg" />;
  } else if (request.status === 'working') main = isStalled(request, now) ? null : <AgentWorkingCard run={lastRun} />;
  else if (request.status === 'submitted') main = isNotStarted(request, now) ? null : <SubmittedCard />;
  else if (request.status === 'needs_customer') main = <QuestionCard request={request} approval={latest} />;
  else if (request.status === 'awaiting_return') main = <ReturnCard request={request} />;
  else main = <OutcomeCard request={request} steps={steps} />;

  return (
    <>
      {main}
      {request.status !== 'needs_customer' || history.length > 1 ? <DecisionHistory approvals={history} /> : null}
    </>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-5 rounded-[6px]" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex h-full" aria-hidden>
      <div className="flex-1">
        <div className="flex h-14 items-center gap-3 border-b border-border px-6">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="ml-auto h-5 w-16" />
        </div>
        <div className="flex h-10 items-center gap-5 border-b border-border px-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-4 p-6">
          <Skeleton className="h-60 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
      <div className="hidden w-[344px] border-l border-border p-5 wide:block">
        <TimelineSkeleton />
      </div>
    </div>
  );
}
