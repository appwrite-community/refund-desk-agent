import { CircleCheck, Hourglass, Inbox, MessageCircleQuestionMark, PackageOpen, Sparkles, type LucideIcon } from 'lucide-react';
import type { RefundRequest, RequestStatus } from '@/lib/types';

export type Sort = 'oldest' | 'newest';

export type Queue = {
  slug: string;
  label: string;
  icon: LucideIcon;
  statuses: RequestStatus[] | null;
  defaultSort: Sort;
  empty: { title: string; body: string };
};

export const QUEUES: Queue[] = [
  {
    slug: 'needs-approval',
    label: 'Needs approval',
    icon: Hourglass,
    statuses: ['needs_approval'],
    defaultSort: 'oldest',
    empty: { title: 'Nothing needs approval', body: 'The agent handled everything that came in.' },
  },
  {
    slug: 'agent-working',
    label: 'Agent working',
    icon: Sparkles,
    statuses: ['submitted', 'working'],
    defaultSort: 'newest',
    empty: { title: 'The agent is idle', body: 'New requests show up here while the agent reviews them.' },
  },
  {
    slug: 'waiting-on-customer',
    label: 'Waiting on customer',
    icon: MessageCircleQuestionMark,
    statuses: ['needs_customer'],
    defaultSort: 'newest',
    empty: { title: 'No open questions', body: 'When you ask a customer something, the request waits here for the answer.' },
  },
  {
    slug: 'returns',
    label: 'Returns',
    icon: PackageOpen,
    statuses: ['awaiting_return'],
    defaultSort: 'newest',
    empty: { title: 'No returns on the way', body: 'Refunds that need the item back wait here until it arrives.' },
  },
  {
    slug: 'resolved',
    label: 'Resolved',
    icon: CircleCheck,
    statuses: ['refunded', 'declined', 'closed'],
    defaultSort: 'newest',
    empty: { title: 'Nothing resolved yet', body: 'Refunded, declined, and closed requests collect here.' },
  },
  {
    slug: 'all',
    label: 'All requests',
    icon: Inbox,
    statuses: null,
    defaultSort: 'newest',
    empty: { title: 'No refund requests yet', body: 'Requests appear here as soon as customers submit them.' },
  },
];

export const findQueue = (slug: string) => QUEUES.find((queue) => queue.slug === slug);

export const inQueue = (queue: Queue, request: RefundRequest) => !queue.statuses || queue.statuses.includes(request.status);

/** The queue a request belongs in, for links from anywhere. */
export const queueFor = (status: RequestStatus) =>
  QUEUES.find((queue) => queue.statuses?.includes(status)) ?? QUEUES.at(-1)!;

export function sortRequests(requests: RefundRequest[], sort: Sort) {
  const direction = sort === 'oldest' ? 1 : -1;
  return [...requests].sort((a, b) => direction * a.$updatedAt.localeCompare(b.$updatedAt));
}
