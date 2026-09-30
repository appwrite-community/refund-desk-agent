import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AgentAvatar } from '@/components/Avatars';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { ago } from '@/lib/format';
import { latestStepQuery } from '@/lib/queries';
import { requestNumber, type RefundRequest } from '@/lib/types';
import { cn } from '@/lib/utils';

/** "Working on #1043" while a run is active, otherwise when the agent last ran. */
export function AgentStatus({ requests }: { requests: RefundRequest[] | undefined }) {
  const now = useNow(15_000);
  const latest = useQuery(latestStepQuery);
  const active = (requests ?? []).filter((request) => request.status === 'working');
  const working = active.length > 0;

  return (
    <div className={cn('rounded-md border bg-surface p-3 transition-colors', working ? 'border-iris/30' : 'border-border')}>
      <div className="flex items-center gap-2.5">
        <AgentAvatar size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-13 font-medium">
            Refund agent
            <span className={cn('size-1.5 rounded-full', working ? 'animate-agent-pulse bg-iris' : 'bg-subtle')} aria-hidden />
          </p>
          <div className="truncate text-xs text-muted" aria-live="polite">
            {!requests || latest.isPending ? (
              <Skeleton className="mt-1 h-3 w-24" />
            ) : working ? (
              <>
                Working on{' '}
                {active.slice(0, 2).map((request, index) => (
                  <span key={request.$id}>
                    {index > 0 && ', '}
                    <Link
                      to="/desk/$queue/$requestId"
                      params={{ queue: 'agent-working', requestId: request.$id }}
                      className="font-medium text-iris underline-offset-2 hover:underline"
                    >
                      {requestNumber(request)}
                    </Link>
                  </span>
                ))}
                {active.length > 2 && ` and ${active.length - 2} more`}
              </>
            ) : latest.data ? (
              `Idle · last run ${ago(latest.data.$createdAt, now)}`
            ) : (
              'Idle · no runs yet'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
