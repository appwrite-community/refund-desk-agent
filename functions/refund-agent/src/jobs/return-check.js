import { DATABASE_ID, RETURN_ADDRESS, TABLES } from '../config.js';
import { findRow } from '../lib/context.js';
import { shortDate } from '../lib/format.js';
import { checkTime, completeRefund, scheduleReturnCheck } from '../lib/refunds.js';
import { runOnce } from '../lib/timeline.js';

/**
 * A delayed execution queued when staff approved a refund after a return.
 * No model: if the item arrived, refund it; if not, remind the customer once
 * and check again; after the second miss, close the request.
 */
export async function returnCheckJob(ctx, { requestId, attempt }) {
  const request = await findRow(ctx, TABLES.requests, requestId);
  if (request?.status !== 'awaiting_return' || request.returnChecks !== attempt - 1) {
    ctx.log(`Return check ${attempt} for ${requestId} is not due. Nothing to do.`);
    return;
  }

  const received = request.returnStatus === 'received';
  const trigger = {
    claimId: `chk_${request.$id}_${attempt}`,
    actor: 'system',
    actorName: 'Return check',
    title: `Checked for the return (check ${attempt} of 2)`,
    detail: received ? 'The item arrived.' : 'The item has not arrived.',
    visibility: 'staff',
  };
  await runOnce(ctx, request, trigger, async (run) => {
    if (received) {
      const order = await ctx.tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.orders, rowId: request.orderId });
      await completeRefund(ctx, run, request, order, request.amountCents, { from: 'store' });
      await run.finish('Refunded');
      return;
    }

    if (attempt === 1) {
      const checkAt = checkTime(ctx.config.returnCheckDelayMinutes);
      const execution = await scheduleReturnCheck(ctx, request, 2, checkAt);
      await ctx.tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.requests,
        rowId: request.$id,
        data: { status: 'awaiting_return', returnChecks: 1, returnCheckAt: checkAt.toISOString() },
      });
      await run.action(`Scheduled another return check for ${shortDate(checkAt)}`, `Delayed execution ${execution.$id}.`);
      await run.tellCustomer(
        'Reminder: send the item back',
        `We have not received the ${request.itemName} yet. Ship it with return code ${request.returnCode} ` +
          `to ${RETURN_ADDRESS}. We check again on ${shortDate(checkAt)}.`,
        { from: 'store' },
      );
      await run.finish('Waiting for the return');
      return;
    }

    await ctx.tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.requests,
      rowId: request.$id,
      data: { status: 'closed', returnChecks: attempt, returnCheckAt: null },
    });
    await run.tellCustomer('Request closed', `We did not receive the ${request.itemName}, so this request is closed.`, {
      from: 'store',
    });
    await run.finish('Closed');
  });
}
