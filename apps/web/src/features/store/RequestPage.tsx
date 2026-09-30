import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AppwriteException } from 'appwrite';
import { ArrowLeft, FileSearch } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { ProductImage } from '@/components/ProductImage';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { usePageTitle } from '@/hooks/use-page-title';
import { money, shortDate, timestamp } from '@/lib/format';
import { requestQuery, stepsQuery } from '@/lib/queries';
import { useCustomerRequestRealtime } from '@/lib/realtime';
import { REASONS } from '@/lib/status';
import { requestNumber, type RefundRequest } from '@/lib/types';
import { ProgressTracker } from './ProgressTracker';
import { StatusPanel } from './StatusPanel';
import { Updates } from './Updates';

export function RequestPage({ requestId }: { requestId: string }) {
  useCustomerRequestRealtime(requestId);
  const request = useQuery(requestQuery(requestId));
  const steps = useQuery(stepsQuery(requestId));
  usePageTitle(request.data ? `Refund request ${requestNumber(request.data)}` : 'Refund request');

  if (request.isError) {
    const missing = request.error instanceof AppwriteException && request.error.code === 404;
    return missing ? <NotFound /> : <ErrorState title="We could not load this request." onRetry={() => void request.refetch()} />;
  }
  if (request.isPending) return <RequestSkeleton />;

  const data = request.data;
  return (
    <>
      <BackLink />
      <header className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Refund request {requestNumber(data)}</h1>
        <StatusBadge status={data.status} audience="customer" />
        <p className="w-full text-sm text-muted">
          <Tooltip content={timestamp(data.$createdAt)}>
            <span>Submitted {shortDate(data.$createdAt)}</span>
          </Tooltip>
          <span className="mx-2 text-border-strong">·</span>
          Order <span className="font-mono text-13 text-foreground">{data.orderNumber}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <div className="rounded-lg border border-border bg-surface px-5 py-4 sm:px-6">
            <ProgressTracker status={data.status} />
          </div>
          <StatusPanel request={data} steps={steps.data ?? []} />
          <section aria-labelledby="updates-heading">
            <h2 id="updates-heading" className="mb-4 text-sm font-semibold">
              Updates
            </h2>
            {steps.isError ? (
              <ErrorState title="We could not load the updates." onRetry={() => void steps.refetch()} />
            ) : steps.isPending ? (
              <UpdatesSkeleton />
            ) : (
              <Updates steps={steps.data} customerName={data.customerName} />
            )}
          </section>
        </div>
        <RequestSummary request={data} />
      </div>
    </>
  );
}

function RequestSummary({ request }: { request: RefundRequest }) {
  const reason = REASONS[request.reason];
  return (
    <aside className="rounded-lg border border-border bg-surface lg:sticky lg:top-24" aria-label="Your request">
      <div className="flex items-center gap-3.5 border-b border-border p-5">
        <ProductImage sku={request.itemSku} name={request.itemName} className="size-14" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{request.itemName}</p>
          <p className="mt-0.5 text-sm tabular text-muted">{money(request.amountCents)}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="mb-2 text-xs text-subtle">Reason</p>
          <Chip icon={reason.icon}>{reason.label}</Chip>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-subtle">What you told us</p>
          <blockquote className="max-h-40 overflow-y-auto border-l-2 border-border-strong pl-3 text-sm whitespace-pre-line text-foreground/90 scrollbar-thin">
            {request.details}
          </blockquote>
        </div>
        {request.photoId && request.photoToken && (
          <div>
            <p className="mb-2 text-xs text-subtle">Your photo</p>
            <PhotoLightbox
              fileId={request.photoId}
              token={request.photoToken}
              label={`Your photo of the ${request.itemName.toLowerCase()}`}
              className="aspect-[4/3] w-full"
            />
          </div>
        )}
      </div>
    </aside>
  );
}

function BackLink() {
  return (
    <Link to="/requests" className="mb-6 inline-flex items-center gap-1.5 rounded-sm text-13 text-muted transition-colors hover:text-foreground">
      <ArrowLeft className="size-3.5" aria-hidden />
      Requests
    </Link>
  );
}

function NotFound() {
  return (
    <>
      <BackLink />
      <div className="rounded-lg border border-dashed border-border-strong">
        <EmptyState
          icon={FileSearch}
          title="We could not find that request"
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/orders">Go to your orders</Link>
            </Button>
          }
        >
          It may belong to another account, or the link may be incomplete.
        </EmptyState>
      </div>
    </>
  );
}

function UpdatesSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1].map((index) => (
        <div key={index} className="flex gap-3.5">
          <Skeleton className="size-6 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestSkeleton() {
  return (
    <>
      <Skeleton className="mb-6 h-4 w-20" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="mt-3 mb-8 h-4 w-60" />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Skeleton className="h-[54px] rounded-lg" />
          <Skeleton className="h-[104px] rounded-lg" />
          <Skeleton className="h-4 w-16" />
          <UpdatesSkeleton />
        </div>
        <Skeleton className="h-[440px] rounded-lg" />
      </div>
    </>
  );
}
