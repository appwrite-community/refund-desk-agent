/** In-memory stand-ins for the Appwrite services the jobs use. Only `equal` filters are applied. */
export function fakeTablesDB(seed = {}) {
  const tables = new Map(Object.entries(seed).map(([tableId, rows]) => [tableId, new Map(rows.map((row) => [row.$id, row]))]));
  const table = (tableId) => {
    if (!tables.has(tableId)) tables.set(tableId, new Map());
    return tables.get(tableId);
  };
  const error = (code, type) => Object.assign(new Error(type), { code, type });
  const updatedTables = [];
  let sequence = 100;
  return {
    tables,
    updatedTables,
    rows: (tableId) => [...table(tableId).values()],
    row: (tableId, rowId) => table(tableId).get(rowId),
    async getRow({ tableId, rowId }) {
      const row = table(tableId).get(rowId);
      if (!row) throw error(404, 'row_not_found');
      return row;
    },
    async createRow({ tableId, rowId, data, permissions = [] }) {
      if (table(tableId).has(rowId)) throw error(409, 'row_already_exists');
      const row = { $id: rowId, $sequence: String(sequence++), $createdAt: new Date().toISOString(), $permissions: permissions, ...data };
      table(tableId).set(rowId, row);
      return row;
    },
    async updateRow({ tableId, rowId, data }) {
      updatedTables.push(tableId);
      const row = { ...table(tableId).get(rowId), ...data };
      table(tableId).set(rowId, row);
      return row;
    },
    async listRows({ tableId, queries = [] }) {
      const filters = queries.map((query) => JSON.parse(query)).filter((query) => query.method === 'equal');
      const rows = [...table(tableId).values()].filter((row) =>
        filters.every((filter) => filter.values.includes(row[filter.attribute])),
      );
      return { rows, total: rows.length };
    },
  };
}

/** Records delayed executions. Pass `fail` to make queueing throw. */
export function fakeFunctions({ fail = false } = {}) {
  const executions = [];
  return {
    executions,
    async createExecution(params) {
      if (fail) throw Object.assign(new Error('The current API key is missing the required scope.'), { code: 401, type: 'general_unauthorized_scope' });
      const execution = { $id: `sched${executions.length + 1}`, status: 'scheduled', ...params };
      executions.push(execution);
      return execution;
    },
  };
}

/** A staff team with the given confirmed members. */
export function fakeTeams(members = {}) {
  return {
    async listMemberships({ queries = [] }) {
      const userIds = queries.map((query) => JSON.parse(query)).find((query) => query.attribute === 'userId')?.values ?? [];
      const memberships = userIds
        .filter((userId) => members[userId])
        .map((userId) => ({ userId, userName: members[userId], confirm: true, roles: ['support'] }));
      return { memberships, total: memberships.length };
    },
  };
}

/** A model that answers structured-output calls with `content`, or throws it when it is an Error. */
export function fakeModel(content) {
  return {
    chat: {
      completions: {
        create: async () => {
          if (content instanceof Error) throw content;
          return { choices: [{ message: { content: JSON.stringify(content) } }] };
        },
      },
    },
  };
}
