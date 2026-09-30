import {
  Archive,
  CircleCheck,
  CircleDashed,
  CircleX,
  Hourglass,
  MessageCircleQuestionMark,
  PackageOpen,
  PackageX,
  Shuffle,
  Sparkles,
  Undo2,
  ZapOff,
  type LucideIcon,
} from 'lucide-react';
import { money } from './format';
import type { Reason, Recommendation, RequestStatus } from './types';

export type Tone = 'iris' | 'amber' | 'sky' | 'slate' | 'green' | 'rose';

type StatusMeta = {
  /** Label on the staff desk. */
  label: string;
  /** Label on the customer's pages. */
  customerLabel: string;
  tone: Tone;
  icon: LucideIcon;
};

export const STATUS: Record<RequestStatus, StatusMeta> = {
  submitted: { label: 'Submitted', customerLabel: 'Received', tone: 'slate', icon: CircleDashed },
  working: { label: 'Agent working', customerLabel: 'In review', tone: 'iris', icon: Sparkles },
  needs_approval: { label: 'Needs approval', customerLabel: 'With our team', tone: 'amber', icon: Hourglass },
  needs_customer: {
    label: 'Waiting on customer',
    customerLabel: 'Needs your answer',
    tone: 'sky',
    icon: MessageCircleQuestionMark,
  },
  awaiting_return: { label: 'Awaiting return', customerLabel: 'Send it back', tone: 'slate', icon: PackageOpen },
  refunded: { label: 'Refunded', customerLabel: 'Refunded', tone: 'green', icon: CircleCheck },
  declined: { label: 'Declined', customerLabel: 'Declined', tone: 'rose', icon: CircleX },
  closed: { label: 'Closed', customerLabel: 'Closed', tone: 'slate', icon: Archive },
};

export const RESOLVED: RequestStatus[] = ['refunded', 'declined', 'closed'];

export const REASONS: Record<Reason, { label: string; hint: string; icon: LucideIcon }> = {
  damaged: { label: 'Arrived damaged', hint: 'Broken, cracked, or dented in the box', icon: PackageX },
  defective: { label: 'Stopped working', hint: 'It worked at first, then stopped', icon: ZapOff },
  wrong_item: { label: 'Wrong item received', hint: 'The box had something you did not order', icon: Shuffle },
  changed_mind: { label: 'Changed my mind', hint: 'Unused and in the original packaging', icon: Undo2 },
};

export const REASON_ORDER: Reason[] = ['damaged', 'defective', 'wrong_item', 'changed_mind'];

export function recommendationLabel(recommendation: Recommendation, amountCents: number) {
  switch (recommendation) {
    case 'refund':
      return `Refund ${money(amountCents)}`;
    case 'refund_after_return':
      return `Refund ${money(amountCents)} after return`;
    case 'decline':
      return 'Decline';
    case 'ask_customer':
      return 'Ask the customer';
    case 'manual_review':
      return 'Review manually';
  }
}

export const recommendationTone = (recommendation: Recommendation): Tone =>
  recommendation === 'decline' ? 'rose' : recommendation === 'ask_customer' ? 'sky' : recommendation === 'manual_review' ? 'amber' : 'green';

/** Text, soft background, and border classes for each tone. */
export const TONE_CLASSES: Record<Tone, { text: string; soft: string; dot: string }> = {
  iris: { text: 'text-iris', soft: 'bg-iris/12 border-iris/24', dot: 'bg-iris' },
  amber: { text: 'text-amber', soft: 'bg-amber/12 border-amber/24', dot: 'bg-amber' },
  sky: { text: 'text-sky', soft: 'bg-sky/12 border-sky/24', dot: 'bg-sky' },
  slate: { text: 'text-slate', soft: 'bg-slate/12 border-slate/24', dot: 'bg-slate' },
  green: { text: 'text-green', soft: 'bg-green/12 border-green/24', dot: 'bg-green' },
  rose: { text: 'text-rose', soft: 'bg-rose/12 border-rose/24', dot: 'bg-rose' },
};
