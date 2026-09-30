import { Client, Functions, Storage, TablesDB, Teams } from 'node-appwrite';
import { DATABASE_ID, loadConfig } from '../config.js';
import { createModelClient } from './model.js';

/**
 * Everything a job needs for one execution. The Appwrite client uses the
 * execution's own API key from the `x-appwrite-key` header, limited to the
 * scopes set on the function.
 */
export function createContext({ req, log, error }) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const config = loadConfig();
  return {
    executionId: req.headers['x-appwrite-execution-id'],
    // For event executions: the user whose request caused the event. Empty for API key writes.
    userId: req.headers['x-appwrite-user-id'] || null,
    config,
    log,
    error,
    tablesDB: new TablesDB(client),
    storage: new Storage(client),
    teams: new Teams(client),
    functions: new Functions(client),
    openai: createModelClient(config),
  };
}

/** Reads a row, or returns null when it does not exist. */
export async function findRow(ctx, tableId, rowId) {
  try {
    return await ctx.tablesDB.getRow({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}
