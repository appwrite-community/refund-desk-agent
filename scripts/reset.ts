// Deletes the refund requests made while trying the demo, with their timeline,
// approvals, answers, refunds, photos, and queued return checks, so every flow
// can run again. Seeded people, orders, and resolved requests stay.
import { Query, type Models } from 'node-appwrite';
import { describeError, functions, storage, tablesDB } from './lib/client.ts';
import { AGENT_FUNCTION_ID, BUCKET, DATABASE } from './schema.ts';
import { HISTORY } from './seed-data.ts';

const databaseId = DATABASE.id;
const seeded = new Set(HISTORY.map((item) => item.id));
const PAGE = 100;

async function listAllRows(tableId: string) {
  const rows: Models.DefaultRow[] = [];
  for (;;) {
    const cursor = rows.at(-1)?.$id;
    const page = await tablesDB.listRows({
      databaseId,
      tableId,
      queries: [Query.limit(PAGE), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    });
    rows.push(...page.rows);
    if (page.rows.length < PAGE) return rows;
  }
}

async function listAllFiles() {
  const files: Models.File[] = [];
  for (;;) {
    const cursor = files.at(-1)?.$id;
    const page = await storage.listFiles({
      bucketId: BUCKET.bucketId,
      queries: [Query.limit(PAGE), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    });
    files.push(...page.files);
    if (page.files.length < PAGE) return files;
  }
}

try {
  const demoRequests = (await listAllRows('refund_requests')).filter((row) => !seeded.has(row.$id));
  for (let start = 0; start < demoRequests.length; start += PAGE) {
    const ids = demoRequests.slice(start, start + PAGE).map((row) => row.$id);
    for (const tableId of ['run_steps', 'approvals', 'replies', 'payments']) {
      await tablesDB.deleteRows({ databaseId, tableId, queries: [Query.equal('requestId', ids)] });
    }
    await tablesDB.deleteRows({ databaseId, tableId: 'refund_requests', queries: [Query.equal('$id', ids)] });
  }

  // Seeded photos use the request ID as the file ID. Everything else came from the demo.
  const demoFiles = (await listAllFiles()).filter((file) => !seeded.has(file.$id));
  for (const file of demoFiles) await storage.deleteFile({ bucketId: BUCKET.bucketId, fileId: file.$id });

  // Return checks the agent queued as delayed executions. Their requests are gone.
  const { executions } = await functions.listExecutions({
    functionId: AGENT_FUNCTION_ID,
    queries: [Query.equal('status', ['scheduled']), Query.limit(PAGE)],
  });
  for (const execution of executions) {
    await functions.deleteExecution({ functionId: AGENT_FUNCTION_ID, executionId: execution.$id });
  }

  console.log(
    `Deleted ${demoRequests.length} demo requests, ${demoFiles.length} photos, and ${executions.length} queued return checks.`,
  );
} catch (err) {
  console.error(`Reset failed: ${describeError(err)}`);
  process.exitCode = 1;
}
