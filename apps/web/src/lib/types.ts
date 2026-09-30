import type { Models } from 'appwrite';

export type Reason = 'damaged' | 'defective' | 'wrong_item' | 'changed_mind';

export type RequestStatus =
  | 'submitted'
  | 'working'
  | 'needs_approval'
  | 'needs_customer'
  | 'awaiting_return'
  | 'refunded'
  | 'declined'
  | 'closed';

export type Recommendation = 'refund' | 'refund_after_return' | 'decline' | 'ask_customer' | 'manual_review';

export type Decision = 'approve' | 'decline' | 'ask_customer';

export type OrderItem = {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type Order = Models.Row & {
  number: string;
  customerId: string;
  customerName: string;
  placedAt: string;
  deliveredAt: string | null;
  status: 'processing' | 'shipped' | 'delivered';
  /** JSON array of OrderItem. */
  items: string;
  totalCents: number;
  cardBrand: string;
  cardLast4: string;
};

export type Payment = Models.Row & {
  kind: 'charge' | 'refund';
  orderId: string;
  requestId: string | null;
  customerId: string;
  amountCents: number;
  cardBrand: string;
  cardLast4: string;
  reference: string;
};

export type Policy = Models.Row & {
  title: string;
  body: string;
  order: number;
};

export type RefundRequest = Models.Row & {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  itemSku: string;
  itemName: string;
  amountCents: number;
  reason: Reason;
  details: string;
  photoId: string | null;
  photoToken: string | null;
  status: RequestStatus;
  pendingApprovalId: string | null;
  question: string | null;
  refundId: string | null;
  returnCode: string | null;
  returnStatus: 'awaiting' | 'received' | null;
  returnReceivedAt: string | null;
  returnCheckAt: string | null;
  returnChecks: number | null;
};

export type RunStep = Models.Row & {
  requestId: string;
  /** The execution that wrote the step. */
  runId: string;
  kind: 'trigger' | 'tool' | 'action' | 'message' | 'error' | 'finish';
  actor: 'agent' | 'staff' | 'customer' | 'system';
  actorName: string;
  title: string;
  detail: string | null;
  tool: string | null;
  status: 'running' | 'succeeded' | 'failed';
  durationMs: number | null;
  visibility: 'staff' | 'customer';
};

export type Approval = Models.Row & {
  requestId: string;
  recommendation: Recommendation;
  amountCents: number;
  findings: string[];
  concerns: string[];
  reasoning: string;
  draftQuestion: string | null;
  requireReturn: boolean;
  decision: Decision | null;
  staffNote: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
};

export type Reply = Models.Row & {
  requestId: string;
  customerId: string;
  message: string;
  photoId: string | null;
  photoToken: string | null;
};

export function parseItems(order: Order): OrderItem[] {
  return JSON.parse(order.items) as OrderItem[];
}

/** The short number customers and staff use, for example #1043. */
export function requestNumber(row: Pick<Models.Row, '$sequence'>) {
  return `#${1000 + Number(row.$sequence)}`;
}
