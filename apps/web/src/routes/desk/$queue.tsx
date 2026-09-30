import { createFileRoute, notFound, Outlet, useParams } from '@tanstack/react-router';
import { RequestList } from '@/features/desk/RequestList';
import { findQueue, type Sort } from '@/features/desk/queues';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/desk/$queue')({
  validateSearch: (search: Record<string, unknown>): { sort?: Sort } => ({
    sort: search.sort === 'oldest' || search.sort === 'newest' ? search.sort : undefined,
  }),
  beforeLoad: ({ params }) => {
    const queue = findQueue(params.queue);
    if (!queue) throw notFound();
    return { queue };
  },
  component: QueueView,
});

function QueueView() {
  const { queue } = Route.useRouteContext();
  const { sort } = Route.useSearch();
  const { requestId } = useParams({ strict: false });

  return (
    <div className="flex h-full min-h-0">
      <div className={cn('w-full shrink-0 border-r border-border desk:w-[320px]', requestId && 'hidden desk:block')}>
        <RequestList queue={queue} sort={sort ?? queue.defaultSort} selectedId={requestId} />
      </div>
      <div className={cn('min-w-0 flex-1', !requestId && 'hidden desk:block')}>
        <Outlet />
      </div>
    </div>
  );
}
