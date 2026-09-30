import { ExecutionMethod, ID, type Models, type UploadProgress } from 'appwrite';
import { BUCKET_ID, functions, INTAKE_FUNCTION_ID, storage } from './appwrite';
import type { Reason } from './types';

/** An error answer from the intake function, for example 409 request_exists. */
export class IntakeError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/**
 * Customers never write refund rows directly. They call the intake function,
 * which checks the order, locks the photo, and writes the row for them.
 */
async function callIntake<T>(path: string, body: object): Promise<T> {
  const execution = await functions.createExecution({
    functionId: INTAKE_FUNCTION_ID,
    xpath: path,
    method: ExecutionMethod.POST,
    body: JSON.stringify(body),
  });
  const response = parseJson(execution.responseBody);
  if (execution.responseStatusCode >= 200 && execution.responseStatusCode < 300) return response as T;

  const { error, message, ...details } = response as { error?: string; message?: string };
  throw new IntakeError(
    execution.responseStatusCode,
    error ?? 'internal_error',
    message ?? 'Something went wrong. Try again.',
    details,
  );
}

function parseJson(text: string): object {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}

export type NewRequest = {
  orderId: string;
  itemSku: string;
  reason: Reason;
  details: string;
  photoId: string | null;
};

export const submitRequest = (input: NewRequest) =>
  callIntake<{ requestId: string; number: number }>('/requests', input);

export const submitReply = (requestId: string, input: { message: string; photoId: string | null }) =>
  callIntake<{ replyId: string }>(`/requests/${requestId}/replies`, input);

/** Uploads a photo. Without explicit permissions, only the uploader can read it until intake locks it. */
export const uploadPhoto = (file: File, onProgress?: (progress: UploadProgress) => void): Promise<Models.File> =>
  storage.createFile({ bucketId: BUCKET_ID, fileId: ID.unique(), file, onProgress });
