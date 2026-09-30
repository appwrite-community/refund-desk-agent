import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Channel, Query, type Models, type RealtimeResponseEvent, type RealtimeSubscription } from 'appwrite';
import { useEffect, useRef } from 'react';
import { DATABASE_ID, realtime, TABLES } from './appwrite';
import { latestStepQuery } from './queries';
import type { RefundRequest } from './types';

const table = (tableId: string) => Channel.tablesdb(DATABASE_ID).table(tableId);

type RowChange<T> = { table: string; type: 'create' | 'update' | 'delete'; row: T };

/** Reads the table and change type from an event such as tablesdb.refund_desk.tables.run_steps.rows.<id>.update */
function rowChange<T extends Models.Row>(event: RealtimeResponseEvent<T>): RowChange<T> | null {
  for (const name of event.events) {
    const match = name.match(/^tablesdb\.[^.]+\.tables\.([^.]+)\.rows\.[^.]+\.(create|update|delete)$/);
    if (match) return { table: match[1]!, type: match[2] as RowChange<T>['type'], row: event.payload };
  }
  return null;
}

const byCreation = (a: Models.Row, b: Models.Row) =>
  a.$createdAt.localeCompare(b.$createdAt) || Number(a.$sequence) - Number(b.$sequence);

/** Inserts or replaces a row in a cached list, keeping creation order. */
function upsert<T extends Models.Row>(rows: T[] | undefined, change: RowChange<T>, order = byCreation) {
  if (!rows) return rows;
  const rest = rows.filter((row) => row.$id !== change.row.$id);
  return change.type === 'delete' ? rest : [...rest, change.row].sort(order);
}

const newestFirst = (a: Models.Row, b: Models.Row) => byCreation(b, a);

function applyRequestChange(queryClient: QueryClient, change: RowChange<RefundRequest>) {
  queryClient.setQueryData(['request', change.row.$id], change.row);
  queryClient.setQueryData<RefundRequest[]>(['requests', 'desk'], (rows) => upsert(rows, change, newestFirst));
  queryClient.setQueryData<RefundRequest[]>(['requests', 'customer', change.row.customerId], (rows) =>
    upsert(rows, change, newestFirst),
  );
}

/**
 * Keeps request lists live. Staff receive every request; a customer receives
 * only their own rows, because Realtime applies the same permissions as reads.
 */
export function useRequestsRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const pending = realtime.subscribe(table(TABLES.requests).row(), (event: RealtimeResponseEvent<RefundRequest>) => {
      const change = rowChange(event);
      if (!change) return;
      applyRequestChange(queryClient, change);
      void queryClient.invalidateQueries({ queryKey: latestStepQuery.queryKey });
    });
    return () => void pending.then((subscription) => subscription.unsubscribe());
  }, [queryClient]);
}

const caseQueries = (requestId: string) => [Query.equal('requestId', [requestId])];

/**
 * Streams the open request's timeline, approvals, and replies on the desk.
 * One subscription covers the three tables; Appwrite filters events on the
 * server with the requestId query. Opening another request swaps the query on
 * the same subscription instead of subscribing again.
 */
export function useCaseRealtime(requestId: string) {
  const queryClient = useQueryClient();
  const subscription = useRef<Promise<RealtimeSubscription> | null>(null);
  const subscribedTo = useRef(requestId);

  useEffect(() => {
    const pending = realtime.subscribe(
      [table(TABLES.steps).row(), table(TABLES.approvals).row(), table(TABLES.replies).row()],
      (event: RealtimeResponseEvent<Models.Row & { requestId: string }>) => {
        const change = rowChange(event);
        if (!change) return;
        const key = { run_steps: 'steps', approvals: 'approvals', replies: 'replies' }[change.table];
        if (!key) return;
        queryClient.setQueryData<Models.Row[]>([key, change.row.requestId], (rows) =>
          upsert(rows, change, key === 'approvals' ? newestFirst : byCreation),
        );
      },
      caseQueries(subscribedTo.current),
    );
    subscription.current = pending;
    return () => void pending.then((active) => active.unsubscribe());
  }, [queryClient]);

  useEffect(() => {
    if (subscribedTo.current === requestId) return;
    subscribedTo.current = requestId;
    void subscription.current?.then((active) => active.update({ queries: caseQueries(requestId) }));
  }, [requestId]);
}

/** Streams one request and its customer-visible updates on the customer's request page. */
export function useCustomerRequestRealtime(requestId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const request = realtime.subscribe(
      table(TABLES.requests).row(requestId),
      (event: RealtimeResponseEvent<RefundRequest>) => {
        const change = rowChange(event);
        if (change) applyRequestChange(queryClient, change);
      },
    );
    const steps = realtime.subscribe(
      table(TABLES.steps).row(),
      (event: RealtimeResponseEvent<Models.Row>) => {
        const change = rowChange(event);
        if (change) queryClient.setQueryData<Models.Row[]>(['steps', requestId], (rows) => upsert(rows, change));
      },
      caseQueries(requestId),
    );
    return () => {
      void request.then((subscription) => subscription.unsubscribe());
      void steps.then((subscription) => subscription.unsubscribe());
    };
  }, [queryClient, requestId]);
}
