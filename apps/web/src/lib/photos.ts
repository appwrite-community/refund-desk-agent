import { BUCKET_ID, storage } from './appwrite';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_EDGE = 1600;

export class PhotoError extends Error {}

/**
 * Phone photos are often 4000 px and several megabytes. Scale the long edge to
 * 1600 px and re-encode as JPEG before upload, which also drops EXIF location.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new PhotoError('Use a JPG, PNG, or WebP photo.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError('That photo could not be read.');
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new PhotoError('That photo could not be read.');
  const name = `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
  return new File([blob], name, { type: 'image/jpeg' });
}

/**
 * Request photos are private. The intake function creates a file token, and the
 * token URL works in an <img> tag without a session cookie.
 */
export const photoUrl = (fileId: string, token: string) => storage.getFileView({ bucketId: BUCKET_ID, fileId, token });

export const productImage = (sku: string) => `/products/${sku}.webp`;
