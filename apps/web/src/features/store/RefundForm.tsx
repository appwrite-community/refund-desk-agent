import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { AppwriteException } from 'appwrite';
import { ArrowLeft, ArrowRight, BadgeDollarSign, CircleAlert, CircleCheck, FileCheck, PackageSearch, RotateCw, Users, type LucideIcon } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AgentAvatar } from '@/components/Avatars';
import { ProductImage } from '@/components/ProductImage';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupIndicator, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/use-page-title';
import { deliveredAgo, money, shortDate } from '@/lib/format';
import { IntakeError, submitRequest, uploadPhoto } from '@/lib/intake';
import { customerRequestsQuery, orderQuery } from '@/lib/queries';
import { REASON_ORDER, REASONS } from '@/lib/status';
import { parseItems, requestNumber, type Order, type OrderItem, type Reason, type RefundRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PhotoDropzone } from './PhotoDropzone';

const MAX_DETAILS = 1000;

type Failure = { kind: 'exists'; requestId?: string; number?: number } | { kind: 'error'; message: string };

export function RefundForm({ orderId, sku, customerId }: { orderId: string; sku: string; customerId: string }) {
  usePageTitle('Request a refund');
  const order = useQuery(orderQuery(orderId));
  const requests = useQuery(customerRequestsQuery(customerId));

  if (order.isError) {
    const missing = order.error instanceof AppwriteException && order.error.code === 404;
    return missing ? (
      <NotFound />
    ) : (
      <ErrorState title="We could not load this order." onRetry={() => void order.refetch()} />
    );
  }
  if (order.isPending || requests.isPending) return <RefundFormSkeleton />;

  const item = parseItems(order.data).find((line) => line.sku === sku);
  if (!item) return <NotFound />;
  const existing = requests.data?.find((request) => request.orderId === orderId && request.itemSku === sku);

  return (
    <>
      <BackLink />
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Request a refund</h1>
        <p className="mt-1.5 text-sm text-muted">
          {item.name} from order <span className="font-mono text-13 text-foreground">{order.data.number}</span>
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {existing ? <AlreadyAsked request={existing} /> : <Form order={order.data} item={item} />}
        <Summary order={order.data} item={item} />
      </div>
    </>
  );
}

function Form({ order, item }: { order: Order; item: OrderItem }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  // A photo that uploaded before intake failed is reused on the next try.
  const uploaded = useRef<{ file: File; fileId: string } | null>(null);

  const photoRequired = reason !== 'changed_mind';
  const errors = {
    reason: !reason ? 'Choose what went wrong.' : null,
    details: !details.trim() ? 'Tell us what happened.' : null,
    photo: photoRequired && !photo ? 'Add a photo of the item.' : null,
  };
  const valid = !errors.reason && !errors.details && !errors.photo;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!valid || !reason) return;
    setPending(true);
    setFailure(null);
    try {
      let photoId: string | null = null;
      if (photo) {
        if (uploaded.current?.file !== photo) {
          setProgress(0);
          const file = await uploadPhoto(photo, ({ progress: percent }) => setProgress(percent / 100));
          uploaded.current = { file: photo, fileId: file.$id };
        }
        photoId = uploaded.current.fileId;
        setProgress(1);
      }
      const { requestId } = await submitRequest({ orderId: order.$id, itemSku: item.sku, reason, details: details.trim(), photoId });
      await queryClient.invalidateQueries({ queryKey: ['requests', 'customer'] });
      await navigate({ to: '/requests/$requestId', params: { requestId } });
    } catch (err) {
      setProgress(null);
      setPending(false);
      if (err instanceof IntakeError && err.code === 'request_exists') {
        setFailure({ kind: 'exists', requestId: err.details.requestId as string | undefined, number: err.details.number as number | undefined });
      } else if (err instanceof IntakeError || err instanceof AppwriteException) {
        setFailure({ kind: 'error', message: err.message });
      } else {
        setFailure({ kind: 'error', message: 'Could not reach Pourhaven. Check your connection and try again.' });
      }
    }
  }

  // Another tab or device submitted the same item first: intake answers 409 with that request.
  const alreadyAsked = failure?.kind === 'exists' && failure.requestId ? { requestId: failure.requestId, number: failure.number ? `#${failure.number}` : '' } : null;

  return (
    <form onSubmit={onSubmit} noValidate className="overflow-hidden rounded-lg border border-border bg-surface">
      {alreadyAsked && (
        <div role="status" className="flex flex-wrap items-center gap-3 border-b border-sky/24 bg-sky/8 px-6 py-3.5">
          <CircleCheck className="size-4 shrink-0 text-sky" aria-hidden />
          <p className="flex-1 text-13">You already asked for a refund for this item.</p>
          <Link
            to="/requests/$requestId"
            params={{ requestId: alreadyAsked.requestId }}
            className="inline-flex items-center gap-1 text-13 font-medium underline-offset-4 hover:underline"
          >
            View request {alreadyAsked.number}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}

      <fieldset className="border-b border-border px-6 py-6" disabled={pending || Boolean(alreadyAsked)}>
        <legend className="sr-only">What went wrong?</legend>
        <p className="mb-3 text-13 font-medium" aria-hidden>
          What went wrong?
        </p>
        <RadioGroup
          value={reason ?? ''}
          onValueChange={(value) => setReason(value as Reason)}
          className="grid-cols-1 sm:grid-cols-2"
          aria-label="What went wrong?"
          aria-invalid={showErrors && errors.reason ? true : undefined}
        >
          {REASON_ORDER.map((value) => {
            const meta = REASONS[value];
            return (
              <RadioGroupItem
                key={value}
                value={value}
                className={cn(
                  'group relative flex items-start gap-3 rounded-md border border-border-strong bg-background/40 p-3.5 text-left transition-colors duration-150',
                  'hover:border-[#44444d] hover:bg-raised data-[state=checked]:border-foreground/70 data-[state=checked]:bg-raised',
                  showErrors && errors.reason && 'border-rose/50',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-raised text-muted transition-colors group-data-[state=checked]:border-foreground/30 group-data-[state=checked]:text-foreground">
                  <meta.icon className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 pr-5">
                  <span className="block text-sm font-medium">{meta.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{meta.hint}</span>
                </span>
                <span className="absolute top-3.5 right-3.5 flex size-4 items-center justify-center rounded-full border border-border-strong group-data-[state=checked]:border-foreground">
                  <RadioGroupIndicator className="size-2 rounded-full bg-foreground" />
                </span>
              </RadioGroupItem>
            );
          })}
        </RadioGroup>
        {showErrors && errors.reason && <FieldError>{errors.reason}</FieldError>}
      </fieldset>

      <div className="space-y-6 px-6 py-6">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <Label htmlFor="details">What happened?</Label>
            <span className={cn('text-xs tabular', details.length > MAX_DETAILS - 50 ? 'text-amber' : 'text-subtle')} aria-live="polite">
              {details.length}/{MAX_DETAILS}
            </span>
          </div>
          <Textarea
            id="details"
            rows={4}
            maxLength={MAX_DETAILS}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Tell us what you noticed. For example: the spout was bent when I opened the box."
            disabled={pending || Boolean(alreadyAsked)}
            aria-invalid={showErrors && errors.details ? true : undefined}
            aria-describedby={showErrors && errors.details ? 'details-error' : undefined}
          />
          {showErrors && errors.details && <FieldError id="details-error">{errors.details}</FieldError>}
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <Label id="photo-label">Photo of the item</Label>
            <span className="text-xs text-subtle">{photoRequired ? 'Required' : 'Optional'}</span>
          </div>
          <PhotoDropzone
            file={photo}
            onChange={setPhoto}
            progress={progress}
            disabled={pending || Boolean(alreadyAsked)}
            invalid={showErrors && Boolean(errors.photo)}
            describedBy={showErrors && errors.photo ? 'photo-error' : 'photo-label'}
          />
          {showErrors && errors.photo && <FieldError id="photo-error">{errors.photo}</FieldError>}
        </div>
      </div>

      {failure?.kind === 'error' && (
        <div role="alert" className="mx-6 mb-5 flex items-center gap-3 rounded-md border border-rose/24 bg-rose/8 px-4 py-3">
          <CircleAlert className="size-4 shrink-0 text-rose" aria-hidden />
          <p className="flex-1 text-13">{failure.message}</p>
          <Button type="submit" size="sm" variant="secondary">
            <RotateCw aria-hidden />
            Try again
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border bg-background/40 px-6 py-4">
        <Button type="submit" pending={pending} disabled={Boolean(alreadyAsked)}>
          Submit request
        </Button>
        <p className="text-xs text-muted">
          {pending && progress !== null && progress < 1 ? 'Uploading your photo.' : 'Our refund agent starts reviewing as soon as you submit.'}
        </p>
      </div>
    </form>
  );
}

function AlreadyAsked({ request }: { request: RefundRequest }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-8 text-center">
      <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-md border border-border-strong bg-raised text-muted">
        <FileCheck className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="text-base font-semibold tracking-[-0.01em]">You already asked for a refund for this item</h2>
      <p className="mx-auto mt-1.5 flex max-w-sm flex-wrap items-center justify-center gap-2 text-sm text-muted">
        Request {requestNumber(request)} <StatusBadge status={request.status} audience="customer" size="sm" />
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-6">
        <Link to="/requests/$requestId" params={{ requestId: request.$id }}>
          View request {requestNumber(request)}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

function Summary({ order, item }: { order: Order; item: OrderItem }) {
  return (
    <aside className="rounded-lg border border-border bg-surface lg:sticky lg:top-24" aria-label="Refund summary">
      <div className="flex items-center gap-3.5 border-b border-border p-5">
        <ProductImage sku={item.sku} name={item.name} className="size-16" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-balance">{item.name}</p>
          <p className="mt-0.5 text-13 text-muted">{item.quantity > 1 ? `${item.quantity} × ${money(item.unitPriceCents)}` : 'Qty 1'}</p>
        </div>
      </div>
      <dl className="space-y-2.5 border-b border-border p-5 text-13">
        <Row label="Order">
          <span className="font-mono">{order.number}</span>
        </Row>
        <Row label="Delivered">{order.deliveredAt ? `${shortDate(order.deliveredAt)} (${deliveredAgo(order.deliveredAt).replace('Delivered ', '')})` : 'Not yet'}</Row>
        <Row label="Paid with">
          {order.cardBrand} <span className="tracking-widest">••••</span> {order.cardLast4}
        </Row>
        <div className="flex items-baseline justify-between pt-2">
          <dt className="text-muted">Refund amount</dt>
          <dd className="text-2xl font-semibold tracking-[-0.02em] tabular">{money(item.unitPriceCents * item.quantity)}</dd>
        </div>
      </dl>
      <div className="p-5">
        <p className="mb-3.5 text-xs font-medium tracking-wide text-subtle uppercase">What happens next</p>
        <ol className="space-y-3.5">
          <Step marker={<AgentAvatar size="xs" />}>Our refund agent reviews your request, usually in about a minute.</Step>
          <Step marker={<IconMarker icon={BadgeDollarSign} />}>Small, clear cases are refunded right away.</Step>
          <Step marker={<IconMarker icon={Users} />}>Everything else goes to our support team, who reply within one business day.</Step>
        </ol>
      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function Step({ marker, children }: { marker: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-13 text-muted">
      <span className="mt-px">{marker}</span>
      <span>{children}</span>
    </li>
  );
}

function IconMarker({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-5 items-center justify-center rounded-full border border-border-strong bg-raised text-muted">
      <Icon className="size-3" strokeWidth={2} aria-hidden />
    </span>
  );
}

function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2 flex items-center gap-1.5 text-13 text-rose">
      <CircleAlert className="size-3.5" aria-hidden />
      {children}
    </p>
  );
}

function BackLink() {
  return (
    <Link to="/orders" className="mb-6 inline-flex items-center gap-1.5 rounded-sm text-13 text-muted transition-colors hover:text-foreground">
      <ArrowLeft className="size-3.5" aria-hidden />
      Orders
    </Link>
  );
}

function NotFound() {
  return (
    <>
      <BackLink />
      <div className="rounded-lg border border-dashed border-border-strong">
        <EmptyState
          icon={PackageSearch}
          title="We could not find that item"
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/orders">Go to your orders</Link>
            </Button>
          }
        >
          The order or item may belong to another account.
        </EmptyState>
      </div>
    </>
  );
}

function RefundFormSkeleton() {
  return (
    <>
      <Skeleton className="mb-6 h-4 w-16" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2.5 mb-8 h-4 w-72" />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-border bg-surface p-6">
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[74px] rounded-md" />
            ))}
          </div>
          <Skeleton className="mt-8 mb-2 h-4 w-28" />
          <Skeleton className="h-24 rounded-sm" />
          <Skeleton className="mt-6 mb-2 h-4 w-28" />
          <Skeleton className="h-40 rounded-md" />
        </div>
        <Skeleton className="h-[420px] rounded-lg" />
      </div>
    </>
  );
}
