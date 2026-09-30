import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ChevronsUpDown, LogOut, ScrollText } from 'lucide-react';
import type { ReactNode } from 'react';
import { PersonAvatar } from '@/components/Avatars';
import { Logo } from '@/components/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { deskRequestsQuery, type Viewer } from '@/lib/queries';
import { signOut } from '@/lib/session';
import type { RefundRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AgentStatus } from './AgentStatus';
import { inQueue, QUEUES, type Queue } from './queues';

const ROLE_LABELS: Record<string, string> = { lead: 'Support lead', support: 'Support' };

export function DeskLayout({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const requests = useQuery(deskRequestsQuery);

  return (
    <div className="flex h-dvh flex-col overflow-hidden desk:flex-row">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-border desk:flex" aria-label="Desk">
        <div className="flex h-14 items-center px-4">
          <Link to="/desk" className="rounded-sm" aria-label="Pourhaven Desk home">
            <Logo surface="desk" />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pt-2 scrollbar-thin" aria-label="Queues">
          <p className="px-2 pb-1.5 text-xs font-medium text-subtle">Queues</p>
          <ul className="space-y-px">
            {QUEUES.slice(0, -1).map((queue) => (
              <QueueLink key={queue.slug} queue={queue} requests={requests.data} failed={requests.isError} />
            ))}
          </ul>
          <div className="mx-2 my-2.5 h-px bg-border" />
          <ul>
            <QueueLink queue={QUEUES.at(-1)!} requests={requests.data} failed={requests.isError} />
          </ul>
        </nav>
        <div className="space-y-2 p-2">
          <AgentStatus requests={requests.data} failed={requests.isError} />
          <UserMenu viewer={viewer} />
        </div>
      </aside>

      <MobileBar requests={requests.data} viewer={viewer} />
      <main className="min-h-0 min-w-0 flex-1">{children}</main>
    </div>
  );
}

function QueueLink({ queue, requests, failed }: { queue: Queue; requests: RefundRequest[] | undefined; failed: boolean }) {
  const count = requests?.filter((request) => inQueue(queue, request)).length;
  const urgent = queue.slug === 'needs-approval' && Boolean(count);
  const working = queue.slug === 'agent-working' && Boolean(count);

  return (
    <li>
      <Link
        to="/desk/$queue"
        params={{ queue: queue.slug }}
        className="group flex h-8 items-center gap-2.5 rounded-sm px-2 text-13 text-muted transition-colors hover:bg-raised hover:text-foreground data-[status=active]:bg-raised data-[status=active]:text-foreground"
      >
        <span className="relative">
          <queue.icon className={cn('size-4', working && 'text-iris')} strokeWidth={1.75} aria-hidden />
          {working && <span className="absolute -top-0.5 -right-0.5 size-1.5 animate-agent-pulse rounded-full bg-iris" aria-hidden />}
        </span>
        <span className="flex-1 truncate font-medium">{queue.label}</span>
        {failed ? null : count === undefined ? (
          <Skeleton className="h-3.5 w-4" />
        ) : (
          <span
            className={cn(
              'min-w-5 rounded-full px-1.5 text-center text-xs tabular',
              urgent ? 'bg-amber/14 py-px font-medium text-amber' : 'text-subtle',
            )}
          >
            {count}
          </span>
        )}
      </Link>
    </li>
  );
}

function UserMenu({ viewer }: { viewer: Viewer }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const name = viewer.user.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-sm p-2 text-left transition-colors hover:bg-raised data-[state=open]:bg-raised">
        <PersonAvatar name={name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-13 font-medium">{name}</span>
          <span className="block truncate text-xs text-muted">{ROLE_LABELS[viewer.staffRole ?? ''] ?? 'Staff'}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-subtle" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-[216px]">
        <DropdownMenuLabel className="text-foreground">
          <span className="block text-13 font-medium">{name}</span>
          <span className="block truncate text-xs font-normal text-muted">{viewer.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/policy">
            <ScrollText aria-hidden />
            Refund policy
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut(queryClient).then(() => navigate({ to: '/sign-in' }))}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Below 900 px the sidebar becomes a top bar with a queue picker. */
function MobileBar({ requests, viewer }: { requests: RefundRequest[] | undefined; viewer: Viewer }) {
  const navigate = useNavigate();
  const { queue: slug } = useParams({ strict: false });
  const current = QUEUES.find((queue) => queue.slug === slug) ?? QUEUES[0]!;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 desk:hidden">
      <Link to="/desk" aria-label="Pourhaven Desk home">
        <Logo surface="desk" />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="ml-auto flex h-8 items-center gap-2 rounded-sm border border-border-strong bg-raised px-2.5 text-13 font-medium">
          <current.icon className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
          {current.label}
          <ChevronsUpDown className="size-3.5 text-subtle" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuRadioGroup value={current.slug} onValueChange={(queue) => void navigate({ to: '/desk/$queue', params: { queue } })}>
            {QUEUES.map((queue) => (
              <DropdownMenuRadioItem key={queue.slug} value={queue.slug}>
                <span className="flex-1">{queue.label}</span>
                <span className="text-xs text-subtle tabular">{requests?.filter((request) => inQueue(queue, request)).length ?? ''}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <PersonAvatar name={viewer.user.name} />
    </header>
  );
}
