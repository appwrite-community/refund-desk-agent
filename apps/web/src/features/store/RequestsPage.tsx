import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Inbox } from 'lucide-react';
import { ProductImage } from '@/components/ProductImage';
import { RelativeTime } from '@/components/RelativeTime';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/use-page-title';
import { money } from '@/lib/format';
import { customerRequestsQuery } from '@/lib/queries';
import { requestNumber } from '@/lib/types';
import { PageHeader } from './PageHeader';

const columns = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 md:grid-cols-[72px_minmax(0,1fr)_110px_96px_170px_96px_16px]';

export function RequestsPage({ customerId }: { customerId: string }) {
  usePageTitle('Refund requests');
  const requests = useQuery(customerRequestsQuery(customerId));

  return (
    <>
      <PageHeader title="Refund requests">Every refund you asked for, with its latest status.</PageHeader>
      {requests.isError ? (
        <ErrorState title="We could not load your requests." onRetry={() => void requests.refetch()} />
      ) : requests.isPending ? (
        <ListSkeleton />
      ) : requests.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong">
          <EmptyState
            icon={Inbox}
            title="No refund requests yet"
            action={
              <Button asChild variant="secondary" size="sm">
                <Link to="/orders">Go to your orders</Link>
              </Button>
            }
          >
            To ask for a refund, open an order and choose the item.
          </EmptyState>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className={`${columns} hidden border-b border-border px-5 py-2.5 text-xs font-medium text-subtle md:grid`}>
            <span>Request</span>
            <span>Item</span>
            <span>Order</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
            <span className="text-right">Updated</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {requests.data.map((request) => (
              <li key={request.$id}>
                <Link
                  to="/requests/$requestId"
                  params={{ requestId: request.$id }}
                  className={`${columns} group px-5 py-3 transition-colors hover:bg-raised`}
                >
                  <span className="hidden font-mono text-13 text-muted md:block">{requestNumber(request)}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <ProductImage sku={request.itemSku} name={request.itemName} className="size-10" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{request.itemName}</span>
                      <span className="block font-mono text-xs text-subtle md:hidden">
                        {requestNumber(request)} · {request.orderNumber}
                      </span>
                    </span>
                  </span>
                  <span className="hidden font-mono text-13 text-muted md:block">{request.orderNumber}</span>
                  <span className="hidden text-right text-sm tabular md:block">{money(request.amountCents)}</span>
                  <span>
                    <StatusBadge status={request.status} audience="customer" size="sm" />
                  </span>
                  <RelativeTime value={request.$updatedAt} format="ago" className="hidden text-right text-13 text-muted md:block" />
                  <ChevronRight className="hidden size-4 text-subtle transition-transform group-hover:translate-x-0.5 md:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-5 py-2.5">
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-6 border-b border-border px-5 py-3 last:border-0">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
