// Creates or updates every Appwrite resource the refund desk needs, then
// deploys both functions. Safe to run again: existing resources are kept and
// missing columns, indexes, and variables are added.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ID, OrderBy, Query, Runtime, TablesDBIndexType } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { create as createTarball } from 'tar';
import {
  createIfMissing,
  describeError,
  functions,
  project,
  storage,
  tablesDB,
  teams,
} from './lib/client.ts';
import { waitFor } from './lib/wait.ts';
import { BUCKET, DATABASE, FUNCTIONS, STAFF_TEAM, TABLES, type Column, type FunctionConfig, type Table } from './schema.ts';

const databaseId = DATABASE.id;

async function provisionDatabase() {
  await createIfMissing(() => tablesDB.create({ databaseId, name: DATABASE.name }));
  console.log(`Database ${databaseId}`);
}

async function provisionTeam() {
  await createIfMissing(() => teams.create({ teamId: STAFF_TEAM.id, name: STAFF_TEAM.name }));
  console.log(`Team ${STAFF_TEAM.id}`);
}

function createColumn(tableId: string, column: Column) {
  const base = { databaseId, tableId, key: column.key, required: column.required };
  switch (column.type) {
    case 'varchar':
      return tablesDB.createVarcharColumn({ ...base, size: column.size, array: column.array });
    case 'text':
      return tablesDB.createTextColumn(base);
    case 'integer':
      return tablesDB.createIntegerColumn({ ...base, min: column.min, xdefault: column.default });
    case 'boolean':
      return tablesDB.createBooleanColumn(base);
    case 'datetime':
      return tablesDB.createDatetimeColumn(base);
    case 'enum':
      return tablesDB.createEnumColumn({ ...base, elements: column.elements });
  }
}

async function provisionTable(table: Table) {
  const tableId = table.id;
  const created = await createIfMissing(() =>
    tablesDB.createTable({
      databaseId,
      tableId,
      name: table.name,
      permissions: table.permissions,
      rowSecurity: table.rowSecurity,
    }),
  );
  if (!created) {
    await tablesDB.updateTable({
      databaseId,
      tableId,
      name: table.name,
      permissions: table.permissions,
      rowSecurity: table.rowSecurity,
    });
  }

  const { columns: existing } = await tablesDB.listColumns({ databaseId, tableId, queries: [Query.limit(100)] });
  const existingKeys = new Set(existing.map((column) => column.key));
  for (const column of table.columns) {
    if (!existingKeys.has(column.key)) await createColumn(tableId, column);
  }
  await waitFor(`columns of ${tableId}`, async () => {
    const { columns } = await tablesDB.listColumns({ databaseId, tableId, queries: [Query.limit(100)] });
    const failed = columns.find((column) => column.status === 'failed');
    if (failed) throw new Error(`Column ${tableId}.${failed.key} failed: ${failed.error}`);
    return columns.every((column) => column.status === 'available') ? true : undefined;
  });

  const { indexes: existingIndexes } = await tablesDB.listIndexes({ databaseId, tableId });
  const existingIndexKeys = new Set(existingIndexes.map((index) => index.key));
  for (const index of table.indexes) {
    if (existingIndexKeys.has(index.key)) continue;
    await tablesDB.createIndex({
      databaseId,
      tableId,
      key: index.key,
      type: index.type === 'unique' ? TablesDBIndexType.Unique : TablesDBIndexType.Key,
      columns: index.columns,
      orders: index.orders?.map((order) => (order === 'desc' ? OrderBy.Desc : OrderBy.Asc)),
    });
  }
  await waitFor(`indexes of ${tableId}`, async () => {
    const { indexes } = await tablesDB.listIndexes({ databaseId, tableId });
    const failed = indexes.find((index) => index.status === 'failed');
    if (failed) throw new Error(`Index ${tableId}.${failed.key} failed: ${failed.error}`);
    return indexes.every((index) => index.status === 'available') ? true : undefined;
  });
  console.log(`Table ${tableId} (${table.columns.length} columns, ${table.indexes.length} indexes)`);
}

async function provisionBucket() {
  const created = await createIfMissing(() => storage.createBucket(BUCKET));
  if (!created) await storage.updateBucket(BUCKET);
  console.log(`Bucket ${BUCKET.bucketId}`);
}

/** Lets a web app on localhost call this project from the browser. */
async function provisionWebPlatform() {
  const { platforms } = await project.listPlatforms();
  const hasLocalhost = platforms.some((platform) => 'hostname' in platform && platform.hostname === 'localhost');
  if (!hasLocalhost) {
    await project.createWebPlatform({ platformId: ID.unique(), name: 'Refund desk (local)', hostname: 'localhost' });
  }
  console.log('Web platform localhost');
}

async function provisionFunction(config: FunctionConfig) {
  const settings = {
    functionId: config.id,
    name: config.name,
    runtime: Runtime.Node22,
    execute: config.execute,
    events: config.events,
    timeout: config.timeout,
    scopes: config.scopes,
    logging: true,
    entrypoint: 'src/main.js',
    commands: 'npm install',
  };
  const created = await createIfMissing(() => functions.create(settings));
  if (!created) await functions.update(settings);

  const { variables } = await functions.listVariables({ functionId: config.id });
  for (const variable of config.variables) {
    if (variable.value === undefined) {
      console.log(`  ${config.id}: ${variable.key} is not set in your environment, keeping the current value`);
      continue;
    }
    const current = variables.find((existing) => existing.key === variable.key);
    const params = { functionId: config.id, key: variable.key, value: variable.value, secret: variable.secret };
    if (current) await functions.updateVariable({ ...params, variableId: current.$id });
    else await functions.createVariable({ ...params, variableId: ID.unique() });
  }

  await deployFunction(config.id);
}

/** Packages functions/<id> (without node_modules and tests) and waits for the build. */
async function deployFunction(functionId: string) {
  const workDir = mkdtempSync(join(tmpdir(), `${functionId}-`));
  const tarball = join(workDir, 'code.tar.gz');
  try {
    await createTarball(
      {
        gzip: true,
        file: tarball,
        cwd: join(import.meta.dirname, '..', 'functions', functionId),
        filter: (path) => !/(^|\/)(node_modules|test)(\/|$)/.test(path),
      },
      ['.'],
    );
    const deployment = await functions.createDeployment({
      functionId,
      code: InputFile.fromPath(tarball, 'code.tar.gz'),
      activate: true,
    });
    const ready = await waitFor(
      `deployment ${deployment.$id} of ${functionId}`,
      async () => {
        const current = await functions.getDeployment({ functionId, deploymentId: deployment.$id });
        if (current.status === 'failed' || current.status === 'canceled') {
          throw new Error(`Build of ${functionId} ${current.status}:\n${current.buildLogs}`);
        }
        return current.status === 'ready' ? current : undefined;
      },
      { timeoutMs: 300_000, intervalMs: 2_000 },
    );
    console.log(`Function ${functionId}: deployment ${ready.$id} is ready`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

try {
  await provisionDatabase();
  await provisionTeam();
  for (const table of TABLES) await provisionTable(table);
  await provisionBucket();
  await provisionWebPlatform();
  for (const config of FUNCTIONS) await provisionFunction(config);
  console.log('Done. Next: pnpm seed');
} catch (err) {
  console.error(`Provisioning failed: ${describeError(err)}`);
  process.exitCode = 1;
}
