import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowDownUp, RotateCw, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { EmptyState } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNow } from '@/hooks/use-now';
import { age, money, timestamp } from '@/lib/format';
import { deskRequestsQuery } from '@/lib/queries';
import { STATUS, TONE_CLASSES } from '@/lib/status';
import { requestNumber, type RefundRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { inQueue, sortRequests, type Queue, type Sort } from './queues';

type RequestListProps = {
  queue: Queue;
  sort: Sort;
  selectedId: string | undefined;
};

/** The middle pane: one queue of requests. j and k move through it. */
export function RequestList({ queue, sort, selectedId }: RequestListProps) {
  const navigate = useNavigate();
  const requests = useQuery(deskRequestsQuery);
  const now = useNow(30_000);
  const list = useRef<HTMLUListElement>(null);

  // The open request stays in the list after its status moves it to another queue.
  const rows = useMemo(
    () => sortRequests((requests.data ?? []).filter((request) => inQueue(queue, request) || request.$id === selectedId), sort),
    [requests.data, queue, selectedId, sort],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.key !== 'j' && event.key !== 'k')) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable], [role=dialog], [role=menu]')) return;
      const links = [...(list.current?.querySelectorAll<HTMLAnchorElement>('a[data-row]') ?? [])];
      if (links.length === 0) return;
      event.preventDefault();
      const current = links.findIndex((link) => link === document.activeElement || link.dataset.selected === 'true');
      const next = event.key === 'j' ? Math.min(links.length - 1, current + 1) : Math.max(0, current - 1);
      links[next]?.focus();
      links[next]?.scrollIntoView({ block: 'nearest' });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const count = requests.data?.filter((request) => inQueue(queue, request)).length;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={queue.label}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <h1 className="text-sm font-semibold">{queue.label}</h1>
        {count !== undefined && <span className="text-13 text-subtle tabular">{count}</span>}
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-foreground data-[state=open]:bg-raised">
            <ArrowDownUp className="size-3.5" aria-hidden />
            {sort === 'oldest' ? 'Oldest first' : 'Newest first'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => void navigate({ to: '.', search: (prev) => ({ ...prev, sort: value as Sort }) })}
            >
              <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {requests.isError ? (
          <EmptyState
            icon={TriangleAlert}
            title="Could not load requests"
            className="h-full"
            action={
              <Button size="sm" variant="secondary" onClick={() => void requests.refetch()}>
                <RotateCw aria-hidden />
                Try again
              </Button>
            }
          >
            Check your connection. The list updates live again once it loads.
          </EmptyState>
        ) : requests.isPending ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={queue.icon} title={queue.empty.title} className="h-full">
            {queue.empty.body}
          </EmptyState>
        ) : (
          <ul ref={list} className="p-1.5">
            {rows.map((request) => (
              <Row key={request.$id} request={request} queue={queue} selected={request.$id === selectedId} now={now} />
            ))}
          </ul>
        )}
      </div>

      {rows.length > 0 && (
        <footer className="hidden h-9 shrink-0 items-center gap-3 border-t border-border px-4 text-xs text-subtle desk:flex">
          <span className="flex items-center gap-1">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd>
            to move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd>
            to open
          </span>
        </footer>
      )}
    </section>
  );
}

function Row({ request, queue, selected, now }: { request: RefundRequest; queue: Queue; selected: boolean; now: number }) {
  const status = STATUS[request.status];
  const working = request.status === 'working';

  return (
    <li className="animate-rise">
      <Link
        to="/desk/$queue/$requestId"
        params={{ queue: queue.slug, requestId: request.$id }}
        search={(prev) => prev}
        data-row
        data-selected={selected}
        aria-current={selected ? 'page' : undefined}
        className={cn(
          'relative flex gap-3 rounded-md px-3 py-3 transition-colors duration-150 outline-offset-[-2px]',
          selected ? 'bg-raised' : 'hover:bg-surface',
        )}
      >
        {selected && <span className="absolute top-3 bottom-3 left-0 w-0.5 rounded-full bg-foreground" aria-hidden />}
        <Tooltip content={status.label} side="left">
          <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center', TONE_CLASSES[status.tone].text)}>
            {working ? (
              <span className="size-2 animate-agent-pulse rounded-full bg-iris" />
            ) : (
              <status.icon className="size-4" strokeWidth={1.75} aria-hidden />
            )}
            <span className="sr-only">{status.label}</span>
          </span>
        </Tooltip>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{request.customerName}</span>
            <span className="text-13 font-medium tabular">{money(request.amountCents)}</span>
          </span>
          <span className="mt-0.5 flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate text-13 text-muted">
              <span className="font-mono text-xs text-subtle">{requestNumber(request)}</span>
              <span className="text-border-strong"> · </span>
              {request.itemName}
            </span>
            <time dateTime={request.$updatedAt} title={timestamp(request.$updatedAt)} className="text-xs text-subtle tabular">
              {age(request.$updatedAt, now)}
            </time>
          </span>
        </span>
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1 p-1.5" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex gap-3 px-3 py-3">
          <Skeleton className="size-4 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-3.5 w-44" />
          </div>
        </div>
      ))}
    </div>
  );
}
