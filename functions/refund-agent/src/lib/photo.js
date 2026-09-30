import { BUCKET_ID } from '../config.js';
import { PHOTO_PROMPT, PHOTO_SCHEMA, photoQuestion } from '../prompts.js';
import { structuredOutput } from './model.js';

const VERDICTS = ['yes', 'no', 'unclear'];

/**
 * A separate vision call with a fixed answer shape. Tool results are text, so
 * the photo cannot go back to the agent as a tool result. This call reads the
 * file from Storage and returns a verdict the refund rules can check.
 */
export async function inspectPhoto(ctx, { fileId, itemName, reason, customerText }) {
  const file = await ctx.storage.getFile({ bucketId: BUCKET_ID, fileId });
  const bytes = await ctx.storage.getFileView({ bucketId: BUCKET_ID, fileId });
  const dataUrl = `data:${file.mimeType};base64,${Buffer.from(bytes).toString('base64')}`;

  const inspection = await structuredOutput(ctx.openai, ctx.config.model, {
    name: 'photo_inspection',
    schema: PHOTO_SCHEMA,
    messages: [
      { role: 'system', content: PHOTO_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: photoQuestion({ itemName, reason, customerText }) },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
  });
  if (!VERDICTS.includes(inspection.supportsClaim) || typeof inspection.description !== 'string') {
    throw new Error('The photo inspection returned an unexpected answer.');
  }
  return inspection;
}
