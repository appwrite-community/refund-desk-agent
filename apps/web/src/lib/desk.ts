import { DATABASE_ID, TABLES, tablesDB } from './appwrite';
import type { Viewer } from './queries';
import type { Approval, Decision, RefundRequest } from './types';

export type DecisionInput = {
  decision: Decision;
  requireReturn: boolean;
  staffNote: string | null;
};

/**
 * Records a staff decision. This update is the event that starts the next
 * refund-agent execution, which reads the decision back from this row.
 */
export function decide(approval: Approval, viewer: Viewer, input: DecisionInput) {
  return tablesDB.updateRow<Approval>({
    databaseId: DATABASE_ID,
    tableId: TABLES.approvals,
    rowId: approval.$id,
    data: {
      decision: input.decision,
      requireReturn: input.requireReturn,
      staffNote: input.staffNote,
      decidedBy: viewer.user.$id,
      decidedByName: viewer.user.name,
      decidedAt: new Date().toISOString(),
    },
  });
}

/** Marks a returned item as received. The next scheduled return check refunds it. */
export function markReturnReceived(request: RefundRequest) {
  return tablesDB.updateRow<RefundRequest>({
    databaseId: DATABASE_ID,
    tableId: TABLES.requests,
    rowId: request.$id,
    data: { returnStatus: 'received', returnReceivedAt: new Date().toISOString() },
  });
}
