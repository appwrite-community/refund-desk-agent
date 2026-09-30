import { ID, Permission, Role } from 'node-appwrite';
import { AGENT_NAME, DATABASE_ID, STORE_NAME, TABLES } from '../config.js';
import { escalate } from './approvals.js';
import { describeError, truncate } from './format.js';

/**
 * Claims a trigger and opens a run. The first write of every run is its trigger
 * step, saved under an ID derived from the trigger (for example
 * `req_<requestId>`). If an execution for the same trigger already wrote it,
 * Appwrite answers 409 and this run stops, so each trigger is handled once.
 */
export async function startRun(ctx, request, trigger) {
  const run = new Run(ctx, request);
  try {
    await run.add({
      rowId: trigger.claimId,
      kind: 'trigger',
      actor: trigger.actor,
      actorName: trigger.actorName,
      title: trigger.title,
      detail: trigger.detail,
      visibility: trigger.visibility,
    });
    return run;
  } catch (err) {
    if (err.code === 409 && err.type === 'row_already_exists') {
      ctx.log(`${trigger.claimId} is already handled by another execution.`);
      return null;
    }
    throw err;
  }
}

/**
 * Runs `work` once per trigger. The request shows as `working` while the run
 * lasts. If the run throws before it hands the request on, a person gets it.
 */
export async function runOnce(ctx, request, trigger, work) {
  const run = await startRun(ctx, request, trigger);
  if (!run) return;
  await setStatus(ctx, request, 'working');
  try {
    await work(run);
  } catch (err) {
    ctx.error(`Run failed: ${describeError(err)}`);
    await run.error('The agent hit a problem', describeError(err));
    const current = await ctx.tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.requests, rowId: request.$id });
    if (current.status === 'working') {
      await escalate(ctx, run, current, 'The agent hit an error while working on this request.');
    }
  }
}

export async function setStatus(ctx, request, status) {
  await ctx.tablesDB.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.requests, rowId: request.$id, data: { status } });
}

/** Writes the run_steps rows of one execution: the timeline staff and customers watch. */
export class Run {
  constructor(ctx, request) {
    this.ctx = ctx;
    this.request = request;
  }

  /** Creates a step. Customer-visible steps also get read access for the customer. */
  async add({ rowId = ID.unique(), visibility = 'staff', ...step }) {
    const row = await this.ctx.tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.steps,
      rowId,
      data: {
        requestId: this.request.$id,
        runId: this.ctx.executionId,
        actor: 'agent',
        actorName: AGENT_NAME,
        status: 'succeeded',
        visibility,
        ...step,
        title: truncate(step.title, 160),
        detail: truncate(step.detail ?? null, 2000),
      },
      permissions: visibility === 'customer' ? [Permission.read(Role.user(this.request.customerId))] : [],
    });
    return row;
  }

  async update(stepId, data) {
    const patch = { ...data };
    if ('title' in patch) patch.title = truncate(patch.title, 160);
    if ('detail' in patch) patch.detail = truncate(patch.detail, 2000);
    return this.ctx.tablesDB.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.steps, rowId: stepId, data: patch });
  }

  /**
   * Records one tool call: a `running` step first, so the dashboard shows it
   * live, then the result and duration. `work` returns { result, title, detail }.
   */
  async tool(name, runningTitle, work) {
    const step = await this.add({ kind: 'tool', tool: name, title: runningTitle, status: 'running' });
    const startedAt = Date.now();
    try {
      const { result, title, detail } = await work();
      await this.update(step.$id, { status: 'succeeded', title, detail, durationMs: Date.now() - startedAt });
      return result;
    } catch (err) {
      await this.update(step.$id, {
        status: 'failed',
        title: `${runningTitle} failed`,
        detail: describeError(err),
        durationMs: Date.now() - startedAt,
      });
      throw err;
    }
  }

  /** A message the customer sees on their request page. */
  async tellCustomer(title, text, { from = 'agent' } = {}) {
    await this.add({
      kind: 'message',
      title,
      detail: text,
      visibility: 'customer',
      ...(from === 'store' ? { actor: 'system', actorName: STORE_NAME } : {}),
    });
  }

  async action(title, detail) {
    await this.add({ kind: 'action', title, detail });
  }

  async finish(title, detail) {
    await this.add({ kind: 'finish', title, detail });
  }

  async error(title, detail) {
    await this.add({ kind: 'error', title, detail, status: 'failed' });
  }
}
