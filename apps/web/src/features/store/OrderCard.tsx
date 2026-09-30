import { Link } from '@tanstack/react-router';
import { ArrowRight, PackageCheck, Truck } from 'lucide-react';
import { Chip } from '@/components/Chip';
import { ProductImage } from '@/components/ProductImage';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { daysSince, money, shortDate, timestamp } from '@/lib/format';
import { parseItems, requestNumber, type Order, type RefundRequest } from '@/lib/types';

const REFUNDABLE_DAYS = 365;

export function OrderCard({ order, requests }: { order: Order; requests: RefundRequest[] }) {
  const items = parseItems(order);
  const requestFor = (sku: string) => requests.find((request) => request.orderId === order.$id && request.itemSku === sku);

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface" aria-label={`Order ${order.number}`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3.5">
        <h2 className="font-mono text-13 font-medium tracking-tight">{order.number}</h2>
        <Tooltip content={timestamp(order.placedAt)}>
          <span className="text-13 text-muted">Placed {shortDate(order.placedAt)}</span>
        </Tooltip>
        {order.deliveredAt ? (
          <Chip icon={PackageCheck} size="sm">
            Delivered {shortDate(order.deliveredAt)}
          </Chip>
        ) : (
          <Chip icon={Truck} tone="sky" size="sm">
            {order.status === 'shipped' ? 'Shipped' : 'Processing'}
          </Chip>
        )}
        <span className="ml-auto text-13 text-muted">
          {order.cardBrand} <span className="tracking-widest">••••</span> {order.cardLast4}
        </span>
        <span className="text-13 font-medium tabular">{money(order.totalCents)}</span>
      </header>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const request = requestFor(item.sku);
          return (
            <li key={item.sku} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5 sm:flex-nowrap">
              <ProductImage sku={item.sku} name={item.name} className="size-14" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-13 text-muted">
                  {item.quantity > 1 ? `${item.quantity} × ${money(item.unitPriceCents)}` : `Qty 1`}
                </p>
              </div>
              <span className="w-20 text-right text-sm tabular">{money(item.unitPriceCents * item.quantity)}</span>
              <div className="flex w-full justify-end sm:w-60">
                {request ? <RequestLink request={request} /> : <RefundAction order={order} sku={item.sku} />}
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function RequestLink({ request }: { request: RefundRequest }) {
  return (
    <Link
      to="/requests/$requestId"
      params={{ requestId: request.$id }}
      className="group inline-flex items-center gap-2.5 rounded-sm py-1 text-13 font-medium whitespace-nowrap text-foreground"
    >
      <StatusBadge status={request.status} audience="customer" size="sm" />
      <span className="underline-offset-4 group-hover:underline">Request {requestNumber(request)}</span>
      <ArrowRight className="size-3.5 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function RefundAction({ order, sku }: { order: Order; sku: string }) {
  const blocked = !order.deliveredAt
    ? 'Refunds open once the order is delivered.'
    : daysSince(order.deliveredAt) > REFUNDABLE_DAYS
      ? 'Refunds are available for a year after delivery.'
      : null;

  if (blocked) {
    return (
      <Tooltip content={blocked}>
        <span tabIndex={0} className="rounded-sm">
          <Button variant="secondary" size="sm" disabled>
            Request a refund
          </Button>
        </span>
      </Tooltip>
    );
  }
  return (
    <Button asChild variant="secondary" size="sm">
      <Link to="/orders/$orderId/refund" params={{ orderId: order.$id }} search={{ item: sku }}>
        Request a refund
      </Link>
    </Button>
  );
}
