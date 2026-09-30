import { useMutation } from '@tanstack/react-query';
import { AppwriteException } from 'appwrite';
import { CalendarClock, PackageCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Chip } from '@/components/Chip';
import { CopyButton } from '@/components/CopyButton';
import { Button } from '@/components/ui/button';
import { markReturnReceived } from '@/lib/desk';
import { dateTime, money, shortDate } from '@/lib/format';
import type { RefundRequest } from '@/lib/types';
import { Panel } from './Panel';

/** A refund that waits for the item. A delayed execution checks for it later. */
export function ReturnCard({ request }: { request: RefundRequest }) {
  const received = request.returnStatus === 'received';
  const mutation = useMutation({
    mutationFn: () => markReturnReceived(request),
    onError: (err) =>
      toast.error('Could not mark the return as received', {
        description: err instanceof AppwriteException ? err.message : 'Check your connection and try again.',
      }),
  });

  return (
    <Panel
      title="Return"
      aside={
        received ? (
          <Chip tone="green" icon={PackageCheck}>
            Received {request.returnReceivedAt ? shortDate(request.returnReceivedAt) : ''}
          </Chip>
        ) : (
          <Chip icon={Truck}>Awaiting shipment</Chip>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-px bg-border">
        <div className="bg-surface px-5 py-3.5">
          <dt className="text-xs text-subtle">Return code</dt>
          <dd className="mt-1 flex items-center gap-2 font-mono text-sm font-medium tracking-wide">
            {request.returnCode}
            {request.returnCode && <CopyButton value={request.returnCode} label="Copy return code" />}
          </dd>
        </div>
        <div className="bg-surface px-5 py-3.5">
          <dt className="text-xs text-subtle">Refund on arrival</dt>
          <dd className="mt-1 text-sm font-medium tabular">{money(request.amountCents)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3.5">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-13 text-muted">
          <CalendarClock className="size-4 shrink-0 text-subtle" strokeWidth={1.75} aria-hidden />
          <span>
            Next check <span className="text-foreground">{request.returnCheckAt ? dateTime(request.returnCheckAt) : 'not scheduled'}</span>
            <span className="text-subtle"> (scheduled execution)</span>
          </span>
        </p>
        {!received && (
          <Button size="sm" pending={mutation.isPending} onClick={() => mutation.mutate()}>
            Mark as received
          </Button>
        )}
      </div>
    </Panel>
  );
}
