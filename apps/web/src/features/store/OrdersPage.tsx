import { useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/States';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/use-page-title';
import { customerRequestsQuery, ordersQuery } from '@/lib/queries';
import { OrderCard } from './OrderCard';
import { PageHeader } from './PageHeader';

export function OrdersPage({ customerId }: { customerId: string }) {
  usePageTitle('Your orders');
  const orders = useQuery(ordersQuery(customerId));
  const requests = useQuery(customerRequestsQuery(customerId));

  return (
    <>
      <PageHeader title="Your orders">
        Something wrong with an item? Ask for a refund from the order, and our refund agent reviews it in about a minute.
      </PageHeader>
      {orders.isError || requests.isError ? (
        <ErrorState
          title="We could not load your orders."
          onRetry={() => {
            void orders.refetch();
            void requests.refetch();
          }}
        />
      ) : orders.isPending || requests.isPending ? (
        <div className="space-y-4">
          {[2, 1, 1].map((rows, index) => (
            <OrderCardSkeleton key={index} rows={rows} />
          ))}
        </div>
      ) : orders.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong">
          <EmptyState icon={ShoppingBag} title="No orders yet">
            When you order from Pourhaven, your orders show up here.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.data.map((order) => (
            <OrderCard key={order.$id} order={order} requests={requests.data} />
          ))}
        </div>
      )}
    </>
  );
}

function OrderCardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-4 border-b border-border px-5 py-3.5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="ml-auto h-4 w-24" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-0">
          <Skeleton className="size-14 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <Skeleton className="h-8 w-36" />
        </div>
      ))}
    </div>
  );
}
