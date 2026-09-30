import { Account, Client, Functions, Realtime, Storage, TablesDB, Teams } from 'appwrite';

export const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export const functions = new Functions(client);
export const teams = new Teams(client);
export const realtime = new Realtime(client);

export const DATABASE_ID = 'refund_desk';

export const TABLES = {
  orders: 'orders',
  payments: 'payments',
  policies: 'policies',
  requests: 'refund_requests',
  steps: 'run_steps',
  approvals: 'approvals',
  replies: 'replies',
} as const;

export const BUCKET_ID = 'request_photos';
export const STAFF_TEAM_ID = 'staff';
export const INTAKE_FUNCTION_ID = 'intake';
