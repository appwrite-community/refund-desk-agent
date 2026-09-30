import { queryOptions } from '@tanstack/react-query';
import { AppwriteException, Query, type Models } from 'appwrite';
import { account, DATABASE_ID, STAFF_TEAM_ID, TABLES, tablesDB, teams } from './appwrite';
import type { Approval, Order, Payment, Policy, RefundRequest, Reply, RunStep } from './types';

export type Viewer = {
  user: Models.User<Models.Preferences>;
  /** The staff team role ("lead" or "support"), or null for customers. */
  staffRole: string | null;
};

/** The signed-in user and whether they are on the staff team. Null when signed out. */
export async function fetchViewer(): Promise<Viewer | null> {
  let user: Models.User<Models.Preferences>;
  try {
    user = await account.get();
  } catch (err) {
    if (err instanceof AppwriteException && err.code === 401) return null;
    throw err;
  }
  // teams.list() returns only the teams the signed-in user belongs to.
  const { teams: joined } = await teams.list();
  if (!joined.some((team) => team.$id === STAFF_TEAM_ID)) return { user, staffRole: null };

  const { memberships } = await teams.listMemberships({
    teamId: STAFF_TEAM_ID,
    queries: [Query.equal('userId', [user.$id])],
  });
  return { user, staffRole: memberships[0]?.roles[0] ?? 'support' };
}

export const viewerQuery = queryOptions({
  queryKey: ['viewer'],
  queryFn: fetchViewer,
  staleTime: Infinity,
});

const MAX_ROWS = 100;

export const ordersQuery = (customerId: string) =>
  queryOptions({
    queryKey: ['orders', customerId],
    queryFn: async () => {
      const { rows } = await tablesDB.listRows<Order>({
        databaseId: DATABASE_ID,
        tableId: TABLES.orders,
        queries: [Query.equal('customerId', [customerId]), Query.orderDesc('placedAt'), Query.limit(MAX_ROWS)],
      });
      return rows;
    },
  });

export const orderQuery = (orderId: string) =>
  queryOptions({
    queryKey: ['order', orderId],
    queryFn: () => tablesDB.getRow<Order>({ databaseId: DATABASE_ID, tableId: TABLES.orders, rowId: orderId }),
    staleTime: 5 * 60 * 1000,
  });

export const customerRequestsQuery = (customerId: string) =>
  queryOptions({
    queryKey: ['requests', 'customer', customerId],
    queryFn: async () => {
      const { rows } = await tablesDB.listRows<RefundRequest>({
        databaseId: DATABASE_ID,
        tableId: TABLES.requests,
        queries: [Query.equal('customerId', [customerId]), Query.orderDesc('$createdAt'), Query.limit(MAX_ROWS)],
      });
      return rows;
    },
  });

/** Every request on the desk. Staff read all rows through the table permissions. */
export const deskRequestsQuery = queryOptions({
  queryKey: ['requests', 'desk'],
  queryFn: async () => {
    const { rows } = await tablesDB.listRows<RefundRequest>({
      databaseId: DATABASE_ID,
      tableId: TABLES.requests,
      queries: [Query.orderDesc('$createdAt'), Query.limit(MAX_ROWS)],
    });
    return rows;
  },
});

export const requestQuery = (requestId: string) =>
  queryOptions({
    queryKey: ['request', requestId],
    queryFn: () =>
      tablesDB.getRow<RefundRequest>({ databaseId: DATABASE_ID, tableId: TABLES.requests, rowId: requestId }),
    retry: (count, err) => !(err instanceof AppwriteException && err.code === 404) && count < 2,
  });

/** Timeline rows for one request, oldest first. Customers only receive the rows shared with them. */
export const stepsQuery = (requestId: string) =>
  queryOptions({
    queryKey: ['steps', requestId],
    queryFn: async () => {
      const { rows } = await tablesDB.listRows<RunStep>({
        databaseId: DATABASE_ID,
        tableId: TABLES.steps,
        queries: [Query.equal('requestId', [requestId]), Query.orderAsc('$createdAt'), Query.limit(MAX_ROWS)],
      });
      return rows;
    },
  });

export const approvalsQuery = (requestId: string) =>
  queryOptions({
    queryKey: ['approvals', requestId],
    queryFn: async () => {
      const { rows } = await tablesDB.listRows<Approval>({
        databaseId: DATABASE_ID,
        tableId: TABLES.approvals,
        queries: [Query.equal('requestId', [requestId]), Query.orderDesc('$createdAt'), Query.limit(MAX_ROWS)],
      });
      return rows;
    },
  });

export const repliesQuery = (requestId: string) =>
  queryOptions({
    queryKey: ['replies', requestId],
    queryFn: async () => {
      const { rows } = await tablesDB.listRows<Reply>({
        databaseId: DATABASE_ID,
        tableId: TABLES.replies,
        queries: [Query.equal('requestId', [requestId]), Query.orderAsc('$createdAt'), Query.limit(MAX_ROWS)],
      });
      return rows;
    },
  });

export const paymentQuery = (paymentId: string) =>
  queryOptions({
    queryKey: ['payment', paymentId],
    queryFn: () => tablesDB.getRow<Payment>({ databaseId: DATABASE_ID, tableId: TABLES.payments, rowId: paymentId }),
    staleTime: Infinity,
  });

export const policiesQuery = queryOptions({
  queryKey: ['policies'],
  queryFn: async () => {
    const { rows } = await tablesDB.listRows<Policy>({
      databaseId: DATABASE_ID,
      tableId: TABLES.policies,
      queries: [Query.orderAsc('order'), Query.limit(MAX_ROWS)],
    });
    return rows;
  },
  staleTime: 5 * 60 * 1000,
});

/** The most recent timeline row across all requests, for the agent status card. */
export const latestStepQuery = queryOptions({
  queryKey: ['steps', 'latest'],
  queryFn: async () => {
    const { rows } = await tablesDB.listRows<RunStep>({
      databaseId: DATABASE_ID,
      tableId: TABLES.steps,
      queries: [Query.orderDesc('$createdAt'), Query.limit(1)],
    });
    return rows[0] ?? null;
  },
});
