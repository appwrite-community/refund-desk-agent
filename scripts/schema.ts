import { Compression, Permission, ProjectKeyScopes, Role } from 'node-appwrite';

// Everything `pnpm provision` creates. The functions keep their own copy of
// these IDs in functions/*/src/config.js, because each one deploys on its own.

export const DATABASE = { id: 'refund_desk', name: 'Refund desk' };
export const STAFF_TEAM = { id: 'staff', name: 'Staff' };

const staff = Role.team(STAFF_TEAM.id);

export type Column =
  | { key: string; type: 'varchar'; size: number; required: boolean; array?: boolean }
  | { key: string; type: 'text'; required: boolean }
  | { key: string; type: 'integer'; required: boolean; min?: number; default?: number }
  | { key: string; type: 'boolean'; required: boolean }
  | { key: string; type: 'datetime'; required: boolean }
  | { key: string; type: 'enum'; elements: string[]; required: boolean };

export type Index = {
  key: string;
  type: 'key' | 'unique';
  columns: string[];
  orders?: ('asc' | 'desc')[];
};

export type Table = {
  id: string;
  name: string;
  permissions: string[];
  rowSecurity: boolean;
  columns: Column[];
  indexes: Index[];
};

const id = (key: string, required = true): Column => ({ key, type: 'varchar', size: 36, required });

export const TABLES: Table[] = [
  {
    // Stands in for the store's order system. Each row is readable by its customer.
    id: 'orders',
    name: 'Orders',
    permissions: [Permission.read(staff)],
    rowSecurity: true,
    columns: [
      { key: 'number', type: 'varchar', size: 16, required: true },
      id('customerId'),
      { key: 'customerName', type: 'varchar', size: 128, required: true },
      { key: 'placedAt', type: 'datetime', required: true },
      { key: 'deliveredAt', type: 'datetime', required: false },
      { key: 'status', type: 'enum', elements: ['processing', 'shipped', 'delivered'], required: true },
      { key: 'items', type: 'text', required: true },
      { key: 'totalCents', type: 'integer', required: true, min: 0 },
      { key: 'cardBrand', type: 'varchar', size: 16, required: true },
      { key: 'cardLast4', type: 'varchar', size: 4, required: true },
    ],
    indexes: [
      { key: 'unique_number', type: 'unique', columns: ['number'] },
      { key: 'by_customer', type: 'key', columns: ['customerId', 'placedAt'], orders: ['asc', 'desc'] },
    ],
  },
  {
    // A mock payment provider ledger: charges from the seed, refunds from the agent.
    id: 'payments',
    name: 'Payments',
    permissions: [Permission.read(staff)],
    rowSecurity: true,
    columns: [
      { key: 'kind', type: 'enum', elements: ['charge', 'refund'], required: true },
      id('orderId'),
      id('requestId', false),
      id('customerId'),
      { key: 'amountCents', type: 'integer', required: true, min: 1 },
      { key: 'cardBrand', type: 'varchar', size: 16, required: true },
      { key: 'cardLast4', type: 'varchar', size: 4, required: true },
      { key: 'reference', type: 'varchar', size: 24, required: true },
    ],
    indexes: [
      { key: 'by_customer', type: 'key', columns: ['customerId', 'kind'] },
      { key: 'by_order', type: 'key', columns: ['orderId'] },
    ],
  },
  {
    id: 'policies',
    name: 'Policies',
    permissions: [Permission.read(Role.any())],
    rowSecurity: false,
    columns: [
      { key: 'title', type: 'varchar', size: 120, required: true },
      { key: 'body', type: 'text', required: true },
      { key: 'order', type: 'integer', required: true },
    ],
    indexes: [],
  },
  {
    // One row per refund request. Customers can read their own rows, so nothing
    // internal goes here. Staff can update it to mark a return as received.
    id: 'refund_requests',
    name: 'Refund requests',
    permissions: [Permission.read(staff), Permission.update(staff)],
    rowSecurity: true,
    columns: [
      id('orderId'),
      { key: 'orderNumber', type: 'varchar', size: 16, required: true },
      id('customerId'),
      { key: 'customerName', type: 'varchar', size: 128, required: true },
      { key: 'itemSku', type: 'varchar', size: 32, required: true },
      { key: 'itemName', type: 'varchar', size: 128, required: true },
      { key: 'amountCents', type: 'integer', required: true, min: 1 },
      {
        key: 'reason',
        type: 'enum',
        elements: ['damaged', 'defective', 'wrong_item', 'changed_mind'],
        required: true,
      },
      { key: 'details', type: 'varchar', size: 1000, required: true },
      id('photoId', false),
      { key: 'photoToken', type: 'varchar', size: 512, required: false },
      {
        key: 'status',
        type: 'enum',
        elements: [
          'submitted',
          'working',
          'needs_approval',
          'needs_customer',
          'awaiting_return',
          'refunded',
          'declined',
          'closed',
        ],
        required: true,
      },
      id('pendingApprovalId', false),
      { key: 'question', type: 'varchar', size: 500, required: false },
      id('refundId', false),
      { key: 'returnCode', type: 'varchar', size: 16, required: false },
      { key: 'returnStatus', type: 'enum', elements: ['awaiting', 'received'], required: false },
      { key: 'returnReceivedAt', type: 'datetime', required: false },
      { key: 'returnCheckAt', type: 'datetime', required: false },
      { key: 'returnChecks', type: 'integer', required: false, min: 0, default: 0 },
    ],
    indexes: [
      { key: 'one_request_per_item', type: 'unique', columns: ['orderId', 'itemSku'] },
      { key: 'by_customer', type: 'key', columns: ['customerId', '$createdAt'], orders: ['asc', 'desc'] },
      { key: 'by_status', type: 'key', columns: ['status', '$updatedAt'], orders: ['asc', 'desc'] },
    ],
  },
  {
    // The timeline. Every tool call writes a row; customer-visible rows also get
    // read(user:<customerId>).
    id: 'run_steps',
    name: 'Run steps',
    permissions: [Permission.read(staff)],
    rowSecurity: true,
    columns: [
      id('requestId'),
      id('runId'),
      {
        key: 'kind',
        type: 'enum',
        elements: ['trigger', 'tool', 'action', 'message', 'error', 'finish'],
        required: true,
      },
      { key: 'actor', type: 'enum', elements: ['agent', 'staff', 'customer', 'system'], required: true },
      { key: 'actorName', type: 'varchar', size: 128, required: true },
      { key: 'title', type: 'varchar', size: 160, required: true },
      { key: 'detail', type: 'varchar', size: 2000, required: false },
      { key: 'tool', type: 'varchar', size: 32, required: false },
      { key: 'status', type: 'enum', elements: ['running', 'succeeded', 'failed'], required: true },
      { key: 'durationMs', type: 'integer', required: false, min: 0 },
      { key: 'visibility', type: 'enum', elements: ['staff', 'customer'], required: true },
    ],
    indexes: [{ key: 'by_request', type: 'key', columns: ['requestId', '$createdAt'], orders: ['asc', 'asc'] }],
  },
  {
    // The agent creates approvals and never updates them. A staff update is the
    // event that resumes the agent.
    id: 'approvals',
    name: 'Approvals',
    permissions: [Permission.read(staff), Permission.update(staff)],
    rowSecurity: false,
    columns: [
      id('requestId'),
      {
        key: 'recommendation',
        type: 'enum',
        elements: ['refund', 'refund_after_return', 'decline', 'ask_customer', 'manual_review'],
        required: true,
      },
      { key: 'amountCents', type: 'integer', required: true, min: 0 },
      { key: 'findings', type: 'varchar', size: 240, required: false, array: true },
      { key: 'concerns', type: 'varchar', size: 240, required: false, array: true },
      { key: 'reasoning', type: 'varchar', size: 2000, required: true },
      { key: 'draftQuestion', type: 'varchar', size: 500, required: false },
      { key: 'requireReturn', type: 'boolean', required: true },
      { key: 'decision', type: 'enum', elements: ['approve', 'decline', 'ask_customer'], required: false },
      { key: 'staffNote', type: 'varchar', size: 1000, required: false },
      id('decidedBy', false),
      { key: 'decidedByName', type: 'varchar', size: 128, required: false },
      { key: 'decidedAt', type: 'datetime', required: false },
    ],
    indexes: [{ key: 'by_request', type: 'key', columns: ['requestId', '$createdAt'], orders: ['asc', 'desc'] }],
  },
  {
    // Customer answers to a question from staff.
    id: 'replies',
    name: 'Replies',
    permissions: [Permission.read(staff)],
    rowSecurity: true,
    columns: [
      id('requestId'),
      id('customerId'),
      { key: 'message', type: 'varchar', size: 2000, required: true },
      id('photoId', false),
      { key: 'photoToken', type: 'varchar', size: 512, required: false },
    ],
    indexes: [{ key: 'by_request', type: 'key', columns: ['requestId', '$createdAt'], orders: ['asc', 'asc'] }],
  },
];

export const BUCKET = {
  bucketId: 'request_photos',
  name: 'Request photos',
  // Any signed-in customer can upload; intake then locks each file to its owner.
  permissions: [Permission.create(Role.users()), Permission.read(staff)],
  fileSecurity: true,
  maximumFileSize: 5 * 1024 * 1024,
  allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  compression: Compression.None,
  encryption: true,
  antivirus: true,
};

const AGENT_EVENTS = [
  `tablesdb.${DATABASE.id}.tables.refund_requests.rows.*.create`,
  `tablesdb.${DATABASE.id}.tables.approvals.rows.*.update`,
  `tablesdb.${DATABASE.id}.tables.replies.rows.*.create`,
];

export type FunctionConfig = {
  id: string;
  name: string;
  execute: string[];
  events: string[];
  timeout: number;
  scopes: ProjectKeyScopes[];
  variables: { key: string; value: string | undefined; secret: boolean }[];
};

export const FUNCTIONS: FunctionConfig[] = [
  {
    id: 'intake',
    name: 'Intake',
    execute: [Role.users()],
    events: [],
    timeout: 15,
    scopes: [
      ProjectKeyScopes.RowsRead,
      ProjectKeyScopes.RowsWrite,
      ProjectKeyScopes.FilesRead,
      ProjectKeyScopes.FilesWrite,
      ProjectKeyScopes.TokensWrite,
    ],
    variables: [],
  },
  {
    id: 'refund-agent',
    name: 'Refund agent',
    // Nobody can call the agent directly. Events and its own delayed executions start it.
    execute: [],
    events: AGENT_EVENTS,
    timeout: 300,
    scopes: [
      ProjectKeyScopes.RowsRead,
      ProjectKeyScopes.RowsWrite,
      ProjectKeyScopes.FilesRead,
      ProjectKeyScopes.TeamsRead,
      ProjectKeyScopes.ExecutionsWrite,
    ],
    variables: [
      { key: 'OPENROUTER_API_KEY', value: process.env.OPENROUTER_API_KEY, secret: true },
      { key: 'OPENROUTER_MODEL', value: process.env.OPENROUTER_MODEL ?? 'openai/gpt-6-luna', secret: false },
      { key: 'AUTO_REFUND_LIMIT_CENTS', value: process.env.AUTO_REFUND_LIMIT_CENTS ?? '5000', secret: false },
      { key: 'REFUND_WINDOW_DAYS', value: process.env.REFUND_WINDOW_DAYS ?? '30', secret: false },
      {
        key: 'RETURN_CHECK_DELAY_MINUTES',
        value: process.env.RETURN_CHECK_DELAY_MINUTES ?? '10080',
        secret: false,
      },
    ],
  },
];
